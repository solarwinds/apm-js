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
  BucketType,
  Flags,
  type LocalSettings,
  OboeSampler,
  type RequestHeaders,
  type ResponseHeaders,
  SampleSource,
  type Settings,
  TracingMode,
} from "@solarwinds-apm/sampling"

import { HEADERS_STORAGE } from "../propagation/headers.js"
import {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_SCHEME,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_TARGET,
  ATTR_NET_HOST_NAME,
} from "../semattrs.old.js"
import { type Configuration } from "../shared/config.js"

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
    attributes[ATTR_HTTP_REQUEST_METHOD] ?? attributes[ATTR_HTTP_METHOD],
  )
  const status = Number(
    attributes[ATTR_HTTP_RESPONSE_STATUS_CODE] ??
      attributes[ATTR_HTTP_STATUS_CODE] ??
      0,
  )

  const scheme = String(
    attributes[ATTR_URL_SCHEME] ?? attributes[ATTR_HTTP_SCHEME] ?? "http",
  )
  const hostname = String(
    attributes[ATTR_SERVER_ADDRESS] ??
      attributes[ATTR_NET_HOST_NAME] ??
      "localhost",
  )
  const path = String(attributes[ATTR_URL_PATH] ?? attributes[ATTR_HTTP_TARGET])
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
 * Parses sampling settings from a raw JSON object
 *
 * @param unparsed - Raw JSON object
 * @returns - Valid parsed settings object or undefined
 */
export function parseSettings(
  unparsed: unknown,
): (Settings & { warning?: string }) | undefined {
  if (typeof unparsed !== "object" || unparsed === null) {
    return undefined
  }

  let sampleRate: number
  let timestamp: number
  let ttl: number
  if (
    "value" in unparsed &&
    typeof unparsed.value === "number" &&
    "timestamp" in unparsed &&
    typeof unparsed.timestamp === "number" &&
    "ttl" in unparsed &&
    typeof unparsed.ttl === "number"
  ) {
    sampleRate = unparsed.value
    timestamp = unparsed.timestamp
    ttl = unparsed.ttl
  } else {
    return undefined
  }

  let flags: Flags
  if ("flags" in unparsed && typeof unparsed.flags === "string") {
    flags = unparsed.flags.split(",").reduce((flags, f) => {
      const flag = {
        OVERRIDE: Flags.OVERRIDE,
        SAMPLE_START: Flags.SAMPLE_START,
        SAMPLE_THROUGH_ALWAYS: Flags.SAMPLE_THROUGH_ALWAYS,
        TRIGGER_TRACE: Flags.TRIGGERED_TRACE,
      }[f]

      if (flag) {
        flags |= flag
      }
      return flags
    }, Flags.OK)
  } else {
    return undefined
  }

  const buckets: Settings["buckets"] = {}
  let signatureKey: Uint8Array | undefined = undefined
  if (
    "arguments" in unparsed &&
    typeof unparsed.arguments === "object" &&
    unparsed.arguments !== null
  ) {
    if (
      "BucketCapacity" in unparsed.arguments &&
      typeof unparsed.arguments.BucketCapacity === "number" &&
      "BucketRate" in unparsed.arguments &&
      typeof unparsed.arguments.BucketRate === "number"
    ) {
      buckets[BucketType.DEFAULT] = {
        capacity: unparsed.arguments.BucketCapacity,
        rate: unparsed.arguments.BucketRate,
      }
    }

    if (
      "TriggerRelaxedBucketCapacity" in unparsed.arguments &&
      typeof unparsed.arguments.TriggerRelaxedBucketCapacity === "number" &&
      "TriggerRelaxedBucketRate" in unparsed.arguments &&
      typeof unparsed.arguments.TriggerRelaxedBucketRate === "number"
    ) {
      buckets[BucketType.TRIGGER_RELAXED] = {
        capacity: unparsed.arguments.TriggerRelaxedBucketCapacity,
        rate: unparsed.arguments.TriggerRelaxedBucketRate,
      }
    }

    if (
      "TriggerStrictBucketCapacity" in unparsed.arguments &&
      typeof unparsed.arguments.TriggerStrictBucketCapacity === "number" &&
      "TriggerStrictBucketRate" in unparsed.arguments &&
      typeof unparsed.arguments.TriggerStrictBucketRate === "number"
    ) {
      buckets[BucketType.TRIGGER_STRICT] = {
        capacity: unparsed.arguments.TriggerStrictBucketCapacity,
        rate: unparsed.arguments.TriggerStrictBucketRate,
      }
    }

    if (
      "SignatureKey" in unparsed.arguments &&
      typeof unparsed.arguments.SignatureKey === "string"
    ) {
      signatureKey = new TextEncoder().encode(unparsed.arguments.SignatureKey)
    }
  }

  let warning: string | undefined = undefined
  if ("warning" in unparsed && typeof unparsed.warning === "string") {
    warning = unparsed.warning
  }

  return {
    sampleSource: SampleSource.Remote,
    sampleRate,
    flags,
    timestamp,
    ttl,
    buckets,
    signatureKey,
    warning,
  }
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

  /** Resolves once the sampler has received settings */
  readonly #ready: Promise<void>
  #resolve!: () => void

  constructor(config: Configuration, logger: DiagLogger, initial?: Settings) {
    super(logger)

    if (config.tracingMode !== undefined) {
      this.#tracingMode = config.tracingMode
        ? TracingMode.ALWAYS
        : TracingMode.NEVER
    }
    this.#triggerMode = config.triggerTraceEnabled
    this.#transactionSettings = config.transactionSettings

    this.#ready = new Promise((resolve) => (this.#resolve = resolve))

    if (initial) {
      super.updateSettings(initial)
    }
  }

  waitUntilReady(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.#ready
        .then(() => {
          resolve(true)
        })
        .catch(() => {
          resolve(false)
        })
      setTimeout(() => {
        resolve(false)
      }, timeout)
    })
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

  protected override updateSettings(settings: unknown): Settings | undefined {
    const parsed = parseSettings(settings)
    if (parsed) {
      this.logger.debug("valid settings", parsed, settings)

      super.updateSettings(parsed)
      this.#resolve()

      if (parsed.warning) {
        this.logger.warn(parsed.warning)
      }

      return parsed
    } else {
      this.logger.debug("invalid settings", settings)
      return undefined
    }
  }
}
