/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import { type OutgoingHttpHeaders } from "node:http"

import { context, diag, type DiagLogger } from "@opentelemetry/api"
import { suppressTracing, TimeoutError } from "@opentelemetry/core"
import { unref } from "@solarwinds-apm/module"
import { type Settings } from "@solarwinds-apm/sampling"

import { type Configuration as NodeConfiguration } from "../config.js"
import { IS_NODE } from "../env.js"
import { type Configuration } from "../exporters/config.js"
import { agentFactory } from "../exporters/proxy.js"
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

/** Retrieves the HTTP getter function to use */
export async function getter(config: Configuration, logger: DiagLogger = diag) {
  if (IS_NODE) {
    const agent = await agentFactory(config as NodeConfiguration)(
      config.collector.protocol,
    )

    return async function get(
      url: URL,
      options: { headers?: OutgoingHttpHeaders; signal?: AbortSignal },
    ) {
      const { get } =
        url.protocol === "http:"
          ? await import("node:http")
          : await import("node:https")

      return await new Promise<unknown>((resolve, reject) => {
        const request = get(url, { agent, ...options }, (response) => {
          logger.debug(`received sampling settings response`, response)
          let data = Buffer.alloc(0)

          response
            .on("error", reject)
            .on("data", (chunk: Buffer) => {
              data = Buffer.concat([data, chunk])
            })
            .on("end", () => {
              resolve(JSON.parse(data.toString("utf-8")))
            })
        })

        request
          .on("error", reject)
          .on("timeout", () => request.destroy(new TimeoutError()))
          .end()
      })
    }
  } else {
    return async function get(
      url: URL,
      options: { headers?: HeadersInit; signal?: AbortSignal },
    ) {
      const response = await fetch(url, options)
      logger.debug(`received sampling settings response`, response)

      const json: unknown = await response.json()
      return json
    }
  }
}

export class HttpSampler extends Sampler {
  readonly #url: URL
  readonly #headers: HeadersInit & OutgoingHttpHeaders
  readonly #service: string

  readonly #hostname = hostname()
  readonly #get: ReturnType<typeof getter>

  #lastWarningMessage: string | undefined = undefined

  constructor(config: Configuration, initial?: Settings) {
    super(config, componentLogger(HttpSampler), initial)

    this.#url = config.collector
    this.#service = encodeURIComponent(config.service)

    this.#headers = { ...config.headers }
    if (this.#url.hostname.endsWith(".solarwinds.com")) {
      this.#headers.authorization = `Bearer ${config.token}`
    }

    this.#get = getter(config, this.logger)

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

    const unparsed = await context.bind(
      suppressTracing(context.active()),
      await this.#get,
    )(url, {
      headers: this.#headers,
      signal: abort.signal,
    })
    clearTimeout(cancel)

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
