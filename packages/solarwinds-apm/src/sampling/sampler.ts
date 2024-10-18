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
  type Link,
  SpanKind,
} from "@opentelemetry/api"
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_URL_PATH,
  ATTR_URL_SCHEME,
} from "@opentelemetry/semantic-conventions"
import {
  type LocalSettings,
  OboeSampler,
  type RequestHeaders,
  type ResponseHeaders,
  TracingMode,
} from "@solarwinds-apm/sampling"

import { type Configuration } from "../config.js"
import { HEADERS_STORAGE } from "../propagation/headers.js"
import {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_SCHEME,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_TARGET,
  ATTR_NET_HOST_NAME,
} from "../semattrs.old.js"

/**
 * Returns whether a span represents an HTTP request, and if so
 * some useful attributes of the request.
 *
 * @param kind - Span kind
 * @param attributes - Span attributes
 */
export function httpSpanMetadata(kind: SpanKind, attributes: Attributes) {
  // The method attribute is always required so we can tell whether this is HTTP from it
  if (
    kind !== SpanKind.SERVER ||
    !(
      ATTR_HTTP_REQUEST_METHOD in attributes ||
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ATTR_HTTP_METHOD in attributes
    )
  ) {
    return { http: false } as const
  }

  const method = String(
    attributes[ATTR_HTTP_REQUEST_METHOD] ??
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      attributes[ATTR_HTTP_METHOD],
  )
  const status = Number(
    attributes[ATTR_HTTP_RESPONSE_STATUS_CODE] ??
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      attributes[ATTR_HTTP_STATUS_CODE] ??
      0,
  )

  const scheme = String(
    attributes[ATTR_URL_SCHEME] ??
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      attributes[ATTR_HTTP_SCHEME] ??
      "http",
  )
  const hostname = String(
    attributes[ATTR_SERVER_ADDRESS] ??
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      attributes[ATTR_NET_HOST_NAME] ??
      "localhost",
  )
  const path = String(
    attributes[ATTR_URL_PATH] ??
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      attributes[ATTR_HTTP_TARGET],
  )
  const url = `${scheme}://${hostname}${path}`

  return {
    http: true,
    method,
    status,
    scheme,
    hostname,
    path,
    url,
  } as const
}

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
  readonly #transactionSettings: Configuration["transactionSettings"]

  constructor(config: Configuration, logger: DiagLogger) {
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
    _links: Link[],
  ): LocalSettings {
    const settings: LocalSettings = {
      tracingMode: this.#tracingMode,
      triggerMode: this.#triggerMode,
    }

    if (!this.#transactionSettings?.length) {
      return settings
    }

    const meta = httpSpanMetadata(spanKind, attributes)
    const identifier = meta.http
      ? meta.url
      : `${SpanKind[spanKind]}:${spanName}`

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
