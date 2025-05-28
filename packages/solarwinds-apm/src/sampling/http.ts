/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { context } from "@opentelemetry/api"
import { suppressTracing } from "@opentelemetry/core"
import { unref } from "@solarwinds-apm/module"
import { type Settings } from "@solarwinds-apm/sampling"

import { Backoff } from "../backoff.js"
import { environment } from "../env.js"
import { type Configuration } from "../shared/config.js"
import { componentLogger } from "../shared/logger.js"
import { Sampler } from "./sampler.js"

const REQUEST_TIMEOUT = 10 * 1000 // 10s
const RETRY_INITIAL_TIMEOUT = 500 // 500ms
const RETRY_MAX_TIMEOUT = 60 * 1000 // 60s
const RETRY_MAX_ATTEMPTS = 20
const MULTIPLIER = 1.5

/** Retrieves the hostname (or User-Agent in browsers) in URL encoded format */
export async function hostname(): Promise<string> {
  if (environment.IS_NODE) {
    const { hostname } = await import("node:os")
    return encodeURIComponent(hostname())
  } else {
    return encodeURIComponent(navigator.userAgent)
  }
}

export class HttpSampler extends Sampler {
  readonly #url: URL
  readonly #headers: HeadersInit
  readonly #service: string
  readonly #hostname = hostname()
  readonly #backoff = new Backoff({
    initial: RETRY_INITIAL_TIMEOUT,
    max: RETRY_MAX_TIMEOUT,
    retries: RETRY_MAX_ATTEMPTS,
    multiplier: MULTIPLIER,
  })

  #lastWarningMessage: string | undefined = undefined

  constructor(config: Configuration, initial?: Settings) {
    super(config, componentLogger(HttpSampler), initial)

    this.#url = config.collector
    this.#service = encodeURIComponent(config.service)

    this.#headers = { ...config.headers }
    if (this.#url.hostname.endsWith(".solarwinds.com")) {
      this.#headers.authorization = `Bearer ${config.token}`
    }

    setTimeout(() => {
      this.#loop()
    }, 0)
  }

  override toString(): string {
    return `HTTP Sampler (${this.#url.host})`
  }

  /** Logs a de-duplicated warning */
  #warn(message: string, ...args: unknown[]) {
    if (message !== this.#lastWarningMessage) {
      this.logger.warn(message, ...args)
      this.#lastWarningMessage = message
    } else {
      this.logger.debug(message, ...args)
    }
  }

  /** Resets last memorised warning and backoff */
  #reset() {
    this.#lastWarningMessage = undefined
    this.#backoff.reset()
  }

  /** Retries the request after an exponential backoff timeout */
  #retry() {
    const timeout = this.#backoff.backoff()
    if (timeout) {
      this.logger.debug(`retrying in ${(timeout / 1000).toFixed(1)}s`)
      unref(
        setTimeout(() => {
          this.#loop()
        }, timeout),
      )
    } else {
      this.logger.warn(
        "Reached max retry attempts for sampling settings retrieval.",
        "Tracing will remain disabled.",
      )
    }
  }

  /** Settings update loop */
  #loop() {
    ;(async () => {
      const url = new URL(
        `./v1/settings/${this.#service}/${await this.#hostname}`,
        this.#url,
      )
      this.logger.debug(`retrieving sampling settings from ${url.href}`)

      const abort = new AbortController()
      const cancel = setTimeout(() => {
        abort.abort("HTTP request timeout")
      }, REQUEST_TIMEOUT)

      const response = await context.bind(
        suppressTracing(context.active()),
        fetch,
      )(url, {
        method: "GET",
        headers: this.#headers,
        signal: abort.signal,
      })
      this.logger.debug(`received sampling settings response`, response)
      clearTimeout(cancel)

      const unparsed: unknown = await response.json()
      const parsed = this.updateSettings(unparsed)

      if (!parsed) {
        this.#warn("Retrieved sampling settings are invalid.")
        this.#retry()
        return
      }
      this.#reset()

      // this is pretty arbitrary but the goal is to update the settings
      // before the previous ones expire with some time to spare
      const expiry = (parsed.timestamp + parsed.ttl) * 1000
      const timeout = expiry - REQUEST_TIMEOUT * MULTIPLIER - Date.now()
      unref(
        setTimeout(
          () => {
            this.#loop()
          },
          Math.max(0, timeout),
        ),
      )
    })().catch((error: unknown) => {
      let message = "Failed to retrieve sampling settings"
      if (error instanceof Error) {
        message += ` (${error.message})`
      }
      message += ", tracing will be disabled until valid ones are available."
      this.#warn(message, error)

      this.#retry()
    })
  }
}
