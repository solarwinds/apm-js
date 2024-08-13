/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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

import {
  type Attributes,
  type Context,
  type DiagLogger,
  SpanKind,
} from "@opentelemetry/api"
import {
  SEMATTRS_HTTP_SCHEME,
  SEMATTRS_HTTP_TARGET,
  SEMATTRS_NET_HOST_NAME,
} from "@opentelemetry/semantic-conventions"
import {
  type LocalSettings,
  OboeSampler,
  type RequestHeaders,
  type ResponseHeaders,
  TracingMode,
} from "@solarwinds-apm/sampling"
import { type SwConfiguration } from "@solarwinds-apm/sdk"

import { HEADERS_STORAGE } from "../propagation/headers.js"

/**
 * Abstract core sampler to extend from other samplers
 *
 * This extends {@link OboeSampler} to retrieve local settings from
 * the configuration and manage request headers retrieval and
 * response headers setting. The only piece of logic left to implement
 * by specific sampler is remote setting retrieval.
 */
export abstract class Sampler extends OboeSampler {
  readonly #tracingMode: TracingMode | undefined
  readonly #triggerMode: boolean
  readonly #transactionSettings: SwConfiguration["transactionSettings"]

  constructor(config: SwConfiguration, logger: DiagLogger) {
    super(logger)

    if (config.tracingMode !== undefined) {
      this.#tracingMode = config.tracingMode
        ? TracingMode.ALWAYS
        : TracingMode.NEVER
    }
    this.#triggerMode = config.triggerTraceEnabled
    this.#transactionSettings = config.transactionSettings
  }

  /** Computes local settings for the current configuration */
  protected override localSettings(
    _context: Context,
    _traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
  ): LocalSettings {
    const settings: LocalSettings = {
      tracingMode: this.#tracingMode,
      triggerMode: this.#triggerMode,
    }

    if (!this.#transactionSettings?.length) {
      return settings
    }

    const kind = SpanKind[spanKind]

    const scheme = attributes[SEMATTRS_HTTP_SCHEME]?.toString()
    const address = attributes[SEMATTRS_NET_HOST_NAME]?.toString()
    const path = attributes[SEMATTRS_HTTP_TARGET]?.toString()

    let identifier: string
    if (scheme && address && path) {
      identifier = `${scheme}://${address}${path}`
    } else {
      identifier = `${kind}:${spanName}`
    }

    for (const { tracing, matcher } of this.#transactionSettings) {
      if (matcher(identifier)) {
        settings.tracingMode = tracing ? TracingMode.ALWAYS : TracingMode.NEVER
        break
      }
    }

    return settings
  }

  /** Retrieves request headers in the {@link HEADERS_STORAGE} */
  protected override requestHeaders(context: Context): RequestHeaders {
    return HEADERS_STORAGE.get(context)?.request ?? {}
  }

  /** Sets response headers in the {@link HEADERS_STORAGE} */
  protected override setResponseHeaders(
    headers: ResponseHeaders,
    context: Context,
  ): void {
    const storage = HEADERS_STORAGE.get(context)
    if (storage) {
      Object.assign(storage.response, headers)
    }
  }
}
