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
  type DiagLogger,
  type Span,
  trace,
  TraceFlags,
} from "@opentelemetry/api"
import {
  type Sampler,
  SamplingDecision,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-base"

import {
  BucketType,
  Flags,
  type LocalSettings,
  merge,
  type Settings,
} from "./settings.js"
import { TokenBucket } from "./token-bucket.js"
import {
  Auth,
  parseTraceOptions,
  type RequestHeaders,
  type ResponseHeaders,
  stringifyTraceOptionsResponse,
  type TraceOptions,
  type TraceOptionsResponse,
  TriggerTrace,
  validateSignature,
} from "./trace-options.js"

const TRACESTATE_REGEXP = /^[0-9a-f]{16}-[0-9a-f]{2}$/
const BUCKET_INTERVAL = 1000

const SW_KEYS_ATTRIBUTE = "SWKeys"
const BUCKET_CAPACITY_ATTRIBUTE = "BucketCapacity"
const BUCKET_RATE_ATTRIBUTE = "BucketRate"

export type SampleParams = Parameters<Sampler["shouldSample"]>

export enum SpanType {
  /** Root span without a parent */
  ROOT,
  /** Entry span with a remote parent */
  ENTRY,
  /** Local span with a local parent */
  LOCAL,
}

interface SampleState {
  decision: SamplingDecision
  attributes: Attributes

  params: SampleParams
  settings: Settings
  traceState?: string
  headers: RequestHeaders

  trace?: {
    options: TraceOptions
    optionsResponse: TraceOptionsResponse
  }
}

/**
 * This class implements all of the core sampling logic.
 * It is meant to be extended by specific samplers that regularly call
 * {@link updateSettings} and provide an implementation of {@link localSettings}.
 *
 * For instance, a classic sampler would retrieve the settings using gRPC,
 * while a serverless sampler would retrieve them from the file on disk.
 * By extending this class neither needs to reimplement shared sampling logic.
 */
export abstract class OboeSampler implements Sampler {
  readonly #buckets: Record<BucketType, TokenBucket> = {
    [BucketType.DEFAULT]: new TokenBucket({
      interval: BUCKET_INTERVAL,
    }),
    [BucketType.TRIGGER_RELAXED]: new TokenBucket({
      interval: BUCKET_INTERVAL,
    }),
    [BucketType.TRIGGER_STRICT]: new TokenBucket({
      interval: BUCKET_INTERVAL,
    }),
  }
  #settings: Settings | undefined = undefined

  constructor(protected readonly logger: DiagLogger) {
    for (const bucket of Object.values(this.#buckets)) {
      bucket.start()
      // unref the bucket so that it doesn't prevent the process from exiting
      bucket.unref()
    }
  }

  shouldSample(...params: SampleParams): SamplingResult {
    const [context, , , , attributes] = params

    const parentSpan = trace.getSpan(context)
    const type = spanType(parentSpan)
    this.logger.debug(`span type is ${SpanType[type]}`)

    // for local spans we always trust the parent
    if (type === SpanType.LOCAL) {
      if (parentSpan!.spanContext().traceFlags & TraceFlags.SAMPLED) {
        return { decision: SamplingDecision.RECORD_AND_SAMPLED }
      } else {
        return { decision: SamplingDecision.NOT_RECORD }
      }
    }

    const settings = this.#getSettings(...params)
    if (!settings) {
      this.logger.debug("settings unavailable; sampling disabled")
      return { decision: SamplingDecision.NOT_RECORD }
    }

    const s: SampleState = {
      decision: SamplingDecision.NOT_RECORD,
      attributes,

      params,
      settings,
      traceState: parentSpan?.spanContext().traceState?.get("sw"),
      headers: this.requestHeaders(...params),
    }

    if (s.headers["X-Trace-Options"]) {
      s.trace = {
        options: parseTraceOptions(s.headers["X-Trace-Options"], this.logger),
        optionsResponse: {},
      }

      this.logger.debug("X-Trace-Options present", s.trace.options)

      if (s.headers["X-Trace-Options-Signature"]) {
        this.logger.debug("X-Trace-Options-Signature present; validating")

        s.trace.optionsResponse.auth = validateSignature(
          s.headers["X-Trace-Options"],
          s.headers["X-Trace-Options-Signature"],
          s.settings.signatureKey,
          s.trace.options.timestamp,
        )

        if (s.trace.optionsResponse.auth !== Auth.OK) {
          this.logger.debug(
            "X-Trace-Options-Signature invalid; tracing disabled",
          )

          this.#setResponseHeaders(s)
          return { decision: SamplingDecision.NOT_RECORD }
        }
      }

      if (!s.trace.options.triggerTrace) {
        s.trace.optionsResponse.triggerTrace = TriggerTrace.NOT_REQUESTED
      }

      // apply span attributes
      if (s.trace.options.swKeys) {
        s.attributes[SW_KEYS_ATTRIBUTE] = s.trace.options.swKeys
      }
      for (const [k, v] of Object.entries(s.trace.options.custom)) {
        s.attributes[k] = v
      }

      // list ignored keys in response
      if (s.trace.options.ignored.length > 0) {
        s.trace.optionsResponse.ignored = s.trace.options.ignored.map(
          ([k]) => k,
        )
      }
    }

    if (s.traceState && TRACESTATE_REGEXP.test(s.traceState)) {
      this.logger.debug("context is valid for parent-based sampling")
      this.#parentBasedAlgo(s)
    } else {
      if (s.settings.flags & Flags.SAMPLE_START) {
        if (s.trace?.options.triggerTrace) {
          this.logger.debug("trigger trace requested")
          this.#triggerTraceAlgo(s)
        } else {
          this.logger.debug("defaulting to dice roll")
          this.#diceRollAlgo(s)
        }
      } else {
        this.logger.debug("SAMPLE_START is unset; sampling disabled")
        this.#disabledAlgo(s)
      }
    }

    this.logger.debug("final sampling state", s)

    this.#setResponseHeaders(s)
    return { decision: s.decision, attributes: s.attributes }
  }

  #parentBasedAlgo(s: SampleState) {
    if (s.trace?.options.triggerTrace) {
      this.logger.debug("trigger trace requested but ignored")
      s.trace.optionsResponse.triggerTrace = TriggerTrace.IGNORED
    }

    if (s.settings.flags & Flags.SAMPLE_THROUGH_ALWAYS) {
      this.logger.debug("SAMPLE_THROUGH_ALWAYS is set; parent-based sampling")

      // this is guaranteed to be valid if the regexp matched
      const flags = Number.parseInt(s.traceState!.slice(-2), 16)
      const sampled = flags & TraceFlags.SAMPLED

      if (sampled) {
        this.logger.debug("parent is sampled; record and sample")
        s.decision = SamplingDecision.RECORD_AND_SAMPLED
      } else {
        this.logger.debug("parent is not sampled; record only")
        s.decision = SamplingDecision.RECORD
      }
    } else {
      this.logger.debug("SAMPLE_THROUGH_ALWAYS is unset; sampling disabled")

      if (s.settings.flags & Flags.SAMPLE_START) {
        this.logger.debug("SAMPLE_START is set; record")
        s.decision = SamplingDecision.RECORD
      } else {
        this.logger.debug("SAMPLE_START is unset; don't record")
        s.decision = SamplingDecision.NOT_RECORD
      }
    }
  }

  #triggerTraceAlgo(s: SampleState) {
    if (s.settings.flags & Flags.TRIGGERED_TRACE) {
      this.logger.debug("TRIGGERED_TRACE set; trigger tracing")

      let bucket: TokenBucket
      if (s.trace!.optionsResponse.auth) {
        this.logger.debug("signed request; using relaxed rate")
        bucket = this.#buckets[BucketType.TRIGGER_RELAXED]
      } else {
        this.logger.debug("unsigned request; using strict rate")
        bucket = this.#buckets[BucketType.TRIGGER_STRICT]
      }

      s.attributes[BUCKET_CAPACITY_ATTRIBUTE] = bucket.capacity
      s.attributes[BUCKET_RATE_ATTRIBUTE] = bucket.rate

      if (bucket.consume()) {
        s.decision = SamplingDecision.RECORD_AND_SAMPLED
      } else {
        s.decision = SamplingDecision.NOT_RECORD
      }
    } else {
      this.logger.debug("TRIGGERED_TRACE unset; record only")

      s.trace!.optionsResponse.triggerTrace =
        TriggerTrace.TRIGGER_TRACING_DISABLED
      s.decision = SamplingDecision.RECORD
    }
  }

  #diceRollAlgo(_s: SampleState) {
    throw new Error("TODO")
  }

  #disabledAlgo(s: SampleState) {
    if (s.trace?.options.triggerTrace) {
      this.logger.debug("trigger trace requested but tracing disabled")
      s.trace.optionsResponse.triggerTrace = TriggerTrace.TRACING_DISABLED
    }

    if (s.settings.flags & Flags.SAMPLE_THROUGH_ALWAYS) {
      this.logger.debug("SAMPLE_THROUGH_ALWAYS is set; record")
      s.decision = SamplingDecision.RECORD
    } else {
      this.logger.debug("SAMPLE_THROUGH_ALWAYS is unset; don't record")
      s.decision = SamplingDecision.NOT_RECORD
    }
  }

  /**
   * Updates the current remote sampling settings. This should be called by
   * the subclass whenever the remote settings are updated.
   */
  protected updateSettings(settings: Settings): void {
    this.#settings = settings
    for (const [type, bucket] of Object.entries(this.#buckets)) {
      const settings = this.#settings.buckets[type as BucketType]
      if (settings) {
        bucket.update(settings)
      }
    }
  }

  /**
   * Retrieves the local settings for the given span information.
   *
   * @param params - Parameters passed to {@link Sampler.shouldSample}
   */
  protected abstract localSettings(...params: SampleParams): LocalSettings

  /**
   * Retrieves the trace options request headers for the given span information.
   *
   * @param params - Parameters passed to {@link Sampler.shouldSample}
   *
   * @returns Headers set on the request that initiated the trace
   */
  protected abstract requestHeaders(...params: SampleParams): RequestHeaders

  /**
   * Sets the trace options response headers for the given span information
   *
   * @param headers - Headers to be set on the response to the request that initiated the trace
   * @param params - Parameters passed to {@link Sampler.shouldSample}
   */
  protected abstract setResponseHeaders(
    headers: ResponseHeaders,
    ...params: SampleParams
  ): void

  #setResponseHeaders(s: SampleState) {
    const headers: ResponseHeaders = {}

    if (s.trace?.optionsResponse) {
      headers["X-Trace-Options-Response"] = stringifyTraceOptionsResponse(
        s.trace.optionsResponse,
      )
    }

    this.setResponseHeaders(headers, ...s.params)
  }

  /** See {@link Sampler.toString} */
  abstract toString(): string

  #getSettings(...params: SampleParams): Settings | undefined {
    return (
      this.#settings && merge(this.#settings, this.localSettings(...params))
    )
  }
}

export function spanType(parentSpan: Span | undefined): SpanType {
  const parentSpanContext = parentSpan?.spanContext()

  if (!parentSpanContext || !trace.isSpanContextValid(parentSpanContext)) {
    return SpanType.ROOT
  } else if (parentSpanContext.isRemote) {
    return SpanType.ENTRY
  } else {
    return SpanType.LOCAL
  }
}
