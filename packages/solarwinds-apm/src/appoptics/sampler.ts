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
  type SpanContext,
  trace,
  TraceFlags,
} from "@opentelemetry/api"
import {
  SamplingDecision,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-base"
import { oboe } from "@solarwinds-apm/bindings"
import {
  type Auth,
  BUCKET_CAPACITY_ATTRIBUTE,
  BUCKET_RATE_ATTRIBUTE,
  type LocalSettings,
  parseTraceOptions,
  type RequestHeaders,
  SAMPLE_RATE_ATTRIBUTE,
  SAMPLE_SOURCE_ATTRIBUTE,
  type SampleParams,
  SpanType,
  spanType,
  stringifyTraceOptionsResponse,
  SW_KEYS_ATTRIBUTE,
  type TraceOptions,
  type TraceOptionsResponse,
  TracingMode,
  TRIGGERED_TRACE_ATTRIBUTE,
  type TriggerTrace,
} from "@solarwinds-apm/sampling"

import { type Configuration } from "../config.js"
import { componentLogger } from "../logger.js"
import { HEADERS_STORAGE } from "../propagation/headers.js"
import { swValue } from "../propagation/trace-context.js"
import { Sampler } from "../sampling/sampler.js"

export function traceParent(spanContext: SpanContext): string {
  return `00-${spanContext.traceId}-${swValue(spanContext)}`
}

export class AppopticsSampler extends Sampler {
  constructor(config: Configuration) {
    super(config, componentLogger(AppopticsSampler))
  }

  override shouldSample(...params: SampleParams): SamplingResult {
    const [context, , , , attributes] = params

    const parentSpan = trace.getSpan(context)
    const parentSpanContext = parentSpan?.spanContext()
    const type = spanType(parentSpan)
    this.logger.debug(`span type is ${SpanType[type]}`)

    // for local spans we always trust the parent
    if (type === SpanType.LOCAL) {
      if (parentSpanContext!.traceFlags & TraceFlags.SAMPLED) {
        return { decision: SamplingDecision.RECORD_AND_SAMPLED }
      } else {
        return { decision: SamplingDecision.NOT_RECORD }
      }
    }

    const customSettings = this.localSettings(...params)
    const headers = HEADERS_STORAGE.get(context)?.request ?? {}
    const traceOptions = headers["X-Trace-Options"]
      ? parseTraceOptions(headers["X-Trace-Options"], this.logger)
      : undefined

    const options = intoOboeDecisionOptions(
      parentSpanContext,
      type,
      customSettings,
      headers,
      traceOptions,
    )
    this.logger.debug("oboe sampling decisions options", options)
    const result = oboe.Context.getDecisions(options)
    this.logger.debug("oboe sampling decisions result", result)

    const { samplingResult, traceOptionsResponse } = fromOboeDecisionsResult(
      result,
      traceOptions,
    )

    this.setResponseHeaders(
      {
        ["X-Trace-Options-Response"]:
          stringifyTraceOptionsResponse(traceOptionsResponse),
      },
      context,
    )
    return {
      ...samplingResult,
      attributes: { ...attributes, ...samplingResult.attributes },
    }
  }

  override toString(): string {
    return "AppOptics Sampler"
  }

  override waitUntilReady(timeout: number): Promise<boolean> {
    return Promise.resolve(
      oboe.Context.isReady(timeout) === oboe.SERVER_RESPONSE_OK,
    )
  }
}

export function intoOboeDecisionOptions(
  parentSpanContext: SpanContext | undefined,
  type: SpanType,
  customSettings: LocalSettings,
  headers: RequestHeaders,
  traceOptions: TraceOptions | undefined,
): oboe.DecisionOptions {
  const in_xtrace =
    type === SpanType.ENTRY ? traceParent(parentSpanContext!) : null
  const tracestate = parentSpanContext?.traceState?.get("sw")

  const custom_tracing_mode =
    customSettings.tracingMode === TracingMode.ALWAYS
      ? oboe.TRACE_ENABLED
      : customSettings.tracingMode === TracingMode.NEVER
        ? oboe.TRACE_DISABLED
        : customSettings.tracingMode
  const custom_trigger_mode = customSettings.triggerMode
    ? oboe.TRIGGER_ENABLED
    : oboe.TRIGGER_DISABLED

  const request_type = traceOptions?.triggerTrace
    ? oboe.REQUEST_TYPE_TRIGGER
    : oboe.REQUEST_TYPE_REGULAR

  const header_options = headers["X-Trace-Options"]
  const header_signature = headers["X-Trace-Options-Signature"]
  const header_timestamp = traceOptions?.timestamp

  return {
    in_xtrace,
    tracestate,
    custom_tracing_mode,
    custom_trigger_mode,
    request_type,
    header_options,
    header_signature,
    header_timestamp,
  }
}

export function fromOboeDecisionsResult(
  result: oboe.DecisionResult,
  traceOptions: TraceOptions | undefined,
): {
  samplingResult: SamplingResult
  traceOptionsResponse: TraceOptionsResponse
} {
  const decision = result.do_sample
    ? SamplingDecision.RECORD_AND_SAMPLED
    : result.do_metrics
      ? SamplingDecision.RECORD
      : SamplingDecision.NOT_RECORD

  const attributes: Attributes = { ...traceOptions?.custom }
  if (result.do_sample) {
    attributes[BUCKET_CAPACITY_ATTRIBUTE] = result.bucket_cap
    attributes[BUCKET_RATE_ATTRIBUTE] = result.bucket_rate
    if (traceOptions?.triggerTrace) {
      attributes[TRIGGERED_TRACE_ATTRIBUTE] = true
    } else {
      attributes[SAMPLE_RATE_ATTRIBUTE] = result.sample_rate
      attributes[SAMPLE_SOURCE_ATTRIBUTE] = result.sample_source
    }
  }
  if (traceOptions?.swKeys) {
    attributes[SW_KEYS_ATTRIBUTE] = traceOptions.swKeys
  }

  const traceOptionsResponse: TraceOptionsResponse = {
    triggerTrace: traceOptions?.triggerTrace
      ? (result.status_msg as TriggerTrace)
      : undefined,
    auth: result.auth_msg ? (result.auth_msg as Auth) : undefined,
    ignored: traceOptions?.ignored.map(([k]) => k),
  }

  return {
    samplingResult: {
      decision,
      attributes,
    },
    traceOptionsResponse,
  }
}
