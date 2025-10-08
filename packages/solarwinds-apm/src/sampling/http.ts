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

import { IS_NODE } from "../env.js"
import { type Configuration } from "../shared/config.js"
import { componentLogger } from "../shared/logger.js"
import { Sampler } from "./sampler.js"

const REQUEST_INTERVAL = 60 * 1000 // 1m
const REQUEST_TIMEOUT = 10 * 1000 // 10s

/** Retrieves the hostname (or User-Agent in browsers) in URL encoded format */
export async function hostname() {
  if (IS_NODE) {
    const { hostname } = await import("node:os")
    return encodeURIComponent(hostname())
  } else {
    return encodeURIComponent(navigator.userAgent)
  }
}

/** Retrieves the fetch function to use */
export async function fetcher(proxy: string | undefined) {
  if (IS_NODE) {
    const { fetch, ProxyAgent } = await import("undici")

    const dispatcher = proxy
      ? new ProxyAgent({ uri: proxy, proxyTunnel: true })
      : undefined
    const fetcher: typeof fetch = (info, init) =>
      fetch(info, { dispatcher, ...init })

    return fetcher
  } else {
    return fetch
  }
}

export class HttpSampler extends Sampler {
  readonly #url: URL
  readonly #proxy: string | undefined
  readonly #headers: HeadersInit
  readonly #service: string

  readonly #hostname = hostname()
  readonly #fetch: ReturnType<typeof fetcher>

  #lastWarningMessage: string | undefined = undefined

  constructor(config: Configuration, initial?: Settings) {
    super(config, componentLogger(HttpSampler), initial)

    this.#url = config.collector
    this.#service = encodeURIComponent(config.service)

    this.#headers = { ...config.headers }
    if (this.#url.hostname.endsWith(".solarwinds.com")) {
      this.#headers.authorization = `Bearer ${config.token}`
    }

    this.#proxy = "proxy" in config ? String(config.proxy) : undefined
    this.#fetch = fetcher(this.#proxy)

    setTimeout(() => {
      this.#loop().catch(this.#catch.bind(this))
    }, 0)
    unref(
      setInterval(() => {
        this.#loop().catch(this.#catch.bind(this))
      }, REQUEST_INTERVAL),
    )
  }

  override toString(): string {
    const proxy = this.#proxy ? ` via ${this.#proxy}` : ""
    return `HTTP Sampler (${this.#url.host}${proxy})`
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

  /** Resets last memorised warning */
  #reset() {
    this.#lastWarningMessage = undefined
  }

  /** Settings update loop */
  async #loop() {
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
      await this.#fetch,
    )(url, {
      method: "GET",
      headers: this.#headers,
      signal: abort.signal,
    })
    this.logger.debug(`received sampling settings response`, response)
    clearTimeout(cancel)

    const unparsed: unknown = await response.json()
    const parsed = this.updateSettings(unparsed)

    if (parsed) {
      this.#reset()
    } else {
      this.#warn("Retrieved sampling settings are invalid.")
    }
  }

  /** Error catcher */
  #catch(error: unknown) {
    let message = "Failed to retrieve sampling settings"
    if (error instanceof Error) {
      message += ` (${error.message})`
    }
    message += ", tracing will be disabled until valid ones are available."
    this.#warn(message, error)
  }
}
