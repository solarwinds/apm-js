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

import { Dice } from "./dice.js"
import { counters } from "./metrics.js"
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
const DICE_SCALE = 1_000_000

export const SW_KEYS_ATTRIBUTE = "SWKeys"
export const PARENT_ID_ATTRIBUTE = "sw.tracestate_parent_id"
export const SAMPLE_RATE_ATTRIBUTE = "SampleRate"
export const SAMPLE_SOURCE_ATTRIBUTE = "SampleSource"
export const BUCKET_CAPACITY_ATTRIBUTE = "BucketCapacity"
export const BUCKET_RATE_ATTRIBUTE = "BucketRate"
export const TRIGGERED_TRACE_ATTRIBUTE = "TriggeredTrace"

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
  settings?: Settings
  traceState?: string
  headers: RequestHeaders

  traceOptions?: TraceOptions & { response: TraceOptionsResponse }
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
  readonly #counters = counters()
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

    const s: SampleState = {
      decision: SamplingDecision.NOT_RECORD,
      attributes,

      params,
      settings: this.#getSettings(...params),
      traceState: parentSpan?.spanContext().traceState?.get("sw"),
      headers: this.requestHeaders(...params),
    }

    this.#counters.requestCount.add(1, {}, context)

    if (s.headers["X-Trace-Options"]) {
      s.traceOptions = {
        ...parseTraceOptions(s.headers["X-Trace-Options"], this.logger),
        response: {},
      }

      this.logger.debug("X-Trace-Options present", s.traceOptions)

      if (s.headers["X-Trace-Options-Signature"]) {
        this.logger.debug("X-Trace-Options-Signature present; validating")

        s.traceOptions.response.auth = validateSignature(
          s.headers["X-Trace-Options"],
          s.headers["X-Trace-Options-Signature"],
          s.settings?.signatureKey,
          s.traceOptions.timestamp,
        )

        // if the request has an invalid signature we always short circuit
        if (s.traceOptions.response.auth !== Auth.OK) {
          this.logger.debug(
            "X-Trace-Options-Signature invalid; tracing disabled",
          )

          this.#setResponseHeaders(s)
          return { decision: SamplingDecision.NOT_RECORD }
        }
      }

      if (!s.traceOptions.triggerTrace) {
        s.traceOptions.response.triggerTrace = TriggerTrace.NOT_REQUESTED
      }

      // apply span attributes
      if (s.traceOptions.swKeys) {
        s.attributes[SW_KEYS_ATTRIBUTE] = s.traceOptions.swKeys
      }
      for (const [k, v] of Object.entries(s.traceOptions.custom)) {
        s.attributes[k] = v
      }

      // list ignored keys in response
      if (s.traceOptions.ignored.length > 0) {
        s.traceOptions.response.ignored = s.traceOptions.ignored.map(([k]) => k)
      }
    }

    if (!s.settings) {
      this.logger.debug("settings unavailable; sampling disabled")

      if (s.traceOptions?.triggerTrace) {
        this.logger.debug("trigger trace requested but unavailable")
        s.traceOptions.response.triggerTrace =
          TriggerTrace.SETTINGS_NOT_AVAILABLE
      }

      this.#setResponseHeaders(s)
      return { decision: SamplingDecision.NOT_RECORD, attributes: s.attributes }
    }

    // https://swicloud.atlassian.net/wiki/spaces/NIT/pages/3815473156/Tracing+Decision+Tree
    if (s.traceState && TRACESTATE_REGEXP.test(s.traceState)) {
      this.logger.debug("context is valid for parent-based sampling")
      this.#parentBasedAlgo(s)
    } else if (s.settings.flags & Flags.SAMPLE_START) {
      if (s.traceOptions?.triggerTrace) {
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

    this.logger.debug("final sampling state", s)

    this.#setResponseHeaders(s)
    return { decision: s.decision, attributes: s.attributes }
  }

  #parentBasedAlgo(s: SampleState) {
    const [context] = s.params

    // this is guaranteed to be valid if the regexp matched
    s.attributes[PARENT_ID_ATTRIBUTE] = s.traceState!.slice(0, 16)

    if (s.traceOptions?.triggerTrace) {
      this.logger.debug("trigger trace requested but ignored")
      s.traceOptions.response.triggerTrace = TriggerTrace.IGNORED
    }

    if (s.settings!.flags & Flags.SAMPLE_THROUGH_ALWAYS) {
      this.logger.debug("SAMPLE_THROUGH_ALWAYS is set; parent-based sampling")

      // this is guaranteed to be valid if the regexp matched
      const flags = Number.parseInt(s.traceState!.slice(-2), 16)
      const sampled = flags & TraceFlags.SAMPLED

      if (sampled) {
        this.logger.debug("parent is sampled; record and sample")

        this.#counters.traceCount.add(1, {}, context)
        this.#counters.throughTraceCount.add(1, {}, context)

        s.decision = SamplingDecision.RECORD_AND_SAMPLED
      } else {
        this.logger.debug("parent is not sampled; record only")
        s.decision = SamplingDecision.RECORD
      }
    } else {
      this.logger.debug("SAMPLE_THROUGH_ALWAYS is unset; sampling disabled")

      if (s.settings!.flags & Flags.SAMPLE_START) {
        this.logger.debug("SAMPLE_START is set; record")
        s.decision = SamplingDecision.RECORD
      } else {
        this.logger.debug("SAMPLE_START is unset; don't record")
        s.decision = SamplingDecision.NOT_RECORD
      }
    }
  }

  #triggerTraceAlgo(s: SampleState) {
    const [context] = s.params

    if (s.settings!.flags & Flags.TRIGGERED_TRACE) {
      this.logger.debug("TRIGGERED_TRACE set; trigger tracing")

      let bucket: TokenBucket
      // if there's an auth response present we know it's a valid signed request
      // otherwise we would never have reached this code
      if (s.traceOptions!.response.auth) {
        this.logger.debug("signed request; using relaxed rate")
        bucket = this.#buckets[BucketType.TRIGGER_RELAXED]
      } else {
        this.logger.debug("unsigned request; using strict rate")
        bucket = this.#buckets[BucketType.TRIGGER_STRICT]
      }

      s.attributes[TRIGGERED_TRACE_ATTRIBUTE] = true
      s.attributes[BUCKET_CAPACITY_ATTRIBUTE] = bucket.capacity
      s.attributes[BUCKET_RATE_ATTRIBUTE] = bucket.rate

      if (bucket.consume()) {
        this.logger.debug("sufficient capacity; record and sample")

        this.#counters.triggeredTraceCount.add(1, {}, context)
        this.#counters.traceCount.add(1, {}, context)

        s.traceOptions!.response.triggerTrace = TriggerTrace.OK
        s.decision = SamplingDecision.RECORD_AND_SAMPLED
      } else {
        this.logger.debug("insufficient capacity; record only")

        s.traceOptions!.response.triggerTrace = TriggerTrace.RATE_EXCEEDED
        s.decision = SamplingDecision.RECORD
      }
    } else {
      this.logger.debug("TRIGGERED_TRACE unset; record only")

      s.traceOptions!.response.triggerTrace =
        TriggerTrace.TRIGGER_TRACING_DISABLED
      s.decision = SamplingDecision.RECORD
    }
  }

  #diceRollAlgo(s: SampleState) {
    const [context] = s.params

    const dice = new Dice({ rate: s.settings!.sampleRate, scale: DICE_SCALE })
    s.attributes[SAMPLE_RATE_ATTRIBUTE] = dice.rate
    s.attributes[SAMPLE_SOURCE_ATTRIBUTE] = s.settings!.sampleSource

    this.#counters.sampleCount.add(1, {}, context)

    if (dice.roll()) {
      this.logger.debug("dice roll success; checking capacity")

      const bucket = this.#buckets[BucketType.DEFAULT]
      s.attributes[BUCKET_CAPACITY_ATTRIBUTE] = bucket.capacity
      s.attributes[BUCKET_RATE_ATTRIBUTE] = bucket.rate

      if (bucket.consume()) {
        this.logger.debug("sufficient capacity; record and sample")

        this.#counters.traceCount.add(1, {}, context)

        s.decision = SamplingDecision.RECORD_AND_SAMPLED
      } else {
        this.logger.debug("insufficient capacity; record only")

        this.#counters.tokenBucketExhaustionCount.add(1, {}, context)

        s.decision = SamplingDecision.RECORD
      }
    } else {
      this.logger.debug("dice roll failure; record only")
      s.decision = SamplingDecision.RECORD
    }
  }

  #disabledAlgo(s: SampleState) {
    if (s.traceOptions?.triggerTrace) {
      this.logger.debug("trigger trace requested but tracing disabled")
      s.traceOptions.response.triggerTrace = TriggerTrace.TRACING_DISABLED
    }

    if (s.settings!.flags & Flags.SAMPLE_THROUGH_ALWAYS) {
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
    if (settings.timestamp > (this.#settings?.timestamp ?? 0)) {
      this.#settings = settings

      for (const [type, bucket] of Object.entries(this.#buckets)) {
        const settings = this.#settings.buckets[type as BucketType]
        if (settings) {
          bucket.update(settings)
        }
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

    if (s.traceOptions?.response) {
      headers["X-Trace-Options-Response"] = stringifyTraceOptionsResponse(
        s.traceOptions.response,
      )
    }

    this.setResponseHeaders(headers, ...s.params)
  }

  /** See {@link Sampler.toString} */
  abstract toString(): string

  #getSettings(...params: SampleParams): Settings | undefined {
    if (!this.#settings) {
      return
    }

    const expiry = (this.#settings.timestamp + this.#settings.ttl) * 1000
    if (Date.now() > expiry) {
      this.logger.debug("settings expired, removing")
      this.#settings = undefined
      return
    }

    return merge(this.#settings, this.localSettings(...params))
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
