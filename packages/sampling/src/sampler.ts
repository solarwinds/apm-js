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

const TRACESTATE_REGEXP = /^[0-9a-f]{16}-[0-9a-f]{2}$/
const BUCKET_INTERVAL = 1000

export type SampleParams = Parameters<Sampler["shouldSample"]>

export enum SpanType {
  /** Root span without a parent */
  ROOT,
  /** Entry span with a remote parent */
  ENTRY,
  /** Local span with a local parent */
  LOCAL,
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
    const [context] = params
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

    const traceState = parentSpan?.spanContext().traceState?.get("sw")
    if (traceState && TRACESTATE_REGEXP.test(traceState)) {
      this.logger.debug("context is valid for parent-based sampling")

      if (settings.flags & Flags.SAMPLE_THROUGH_ALWAYS) {
        this.logger.debug(
          `${Flags[Flags.SAMPLE_THROUGH_ALWAYS]} is set; parent-based sampling`,
        )

        // this is guaranteed to be valid if the regexp matched
        const flags = Number.parseInt(traceState.slice(-2), 16)
        const sampled = flags & TraceFlags.SAMPLED

        if (sampled) {
          this.logger.debug(`parent is sampled; record and sample`)
          return { decision: SamplingDecision.RECORD_AND_SAMPLED }
        } else {
          this.logger.debug(`parent is not sampled; record only`)
          return { decision: SamplingDecision.RECORD }
        }
      } else {
        this.logger.debug(
          `${Flags[Flags.SAMPLE_THROUGH_ALWAYS]} is unset; sampling disabled`,
        )

        if (settings.flags & Flags.SAMPLE_START) {
          this.logger.debug(`${Flags[Flags.SAMPLE_START]} is set; record`)
          return { decision: SamplingDecision.RECORD }
        } else {
          this.logger.debug(
            `${Flags[Flags.SAMPLE_START]} is unset; don't record`,
          )
          return { decision: SamplingDecision.NOT_RECORD }
        }
      }
    }

    throw new Error("TODO: Trigger Trace & Dice Roll")
  }

  /**
   * Updates the current remote sampling settings. This should be called by
   * the subclass whenever the remote settings are updated.
   */
  protected updateSettings(settings: Settings): void {
    this.#settings = settings
    for (const type of [
      BucketType.DEFAULT,
      BucketType.TRIGGER_RELAXED,
      BucketType.TRIGGER_STRICT,
    ]) {
      const settings = this.#settings.buckets[type]
      if (settings) {
        this.#buckets[type].update(settings)
      }
    }
  }

  /**
   * Retrieves the local settings for the given span information.
   *
   * @param params - Parameters passed to {@link Sampler.shouldSample}
   */
  abstract localSettings(...params: SampleParams): LocalSettings

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
