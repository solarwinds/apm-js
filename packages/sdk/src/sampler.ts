/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

import { inspect } from "node:util"

import {
  type Attributes,
  type Context,
  createTraceState,
  type DiagLogger,
  type Link,
  type SpanContext,
  SpanKind,
  trace,
  type TraceState,
} from "@opentelemetry/api"
import {
  type Sampler,
  SamplingDecision,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-base"
import { SemanticAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"

import { type SwConfiguration } from "./config"
import {
  COMMA_W3C,
  EQUALS_W3C,
  getTraceOptions,
  type TraceOptions,
  traceParent,
  TRACESTATE_SW_KEY,
  TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
} from "./context"
import { OboeError } from "./error"
import { recordServerlessMetrics } from "./metrics/serverless"

const ATTRIBUTES_SW_KEYS_KEY = "SWKeys"
const ATTRIBUTES_TRACESTATE_CAPTURE_KEY = "sw.w3c.tracestate"

const TRACE_OPTIONS_RESPONSE_AUTH = "auth"
const TRACE_OPTIONS_RESPONSE_TRIGGER = "trigger-trace"
const TRACE_OPTIONS_RESPONSE_IGNORED = "ignored"
const TRACE_OPTIONS_RESPONSE_TRIGGER_IGNORED = "ignored"
const TRACE_OPTIONS_RESPONSE_TRIGGER_NOT_REQUESTED = "not-requested"

export class SwSampler implements Sampler {
  private readonly oboeDecisionFunction: (
    options: oboe.DecisionOptions,
  ) => oboe.DecisionResult
  private readonly recordMetricsFunction: () => void

  constructor(
    private readonly config: SwConfiguration,
    private readonly logger: DiagLogger,
    serverlessApi: oboe.OboeAPI | undefined,
  ) {
    if (serverlessApi) {
      this.oboeDecisionFunction =
        serverlessApi.getTracingDecision.bind(serverlessApi)
      this.recordMetricsFunction = () => {
        recordServerlessMetrics(serverlessApi)
      }
    } else {
      this.oboeDecisionFunction = oboe.Context.getDecisions
      this.recordMetricsFunction = () => {
        // noop
      }
    }
  }

  shouldSample(
    parentContext: Context,
    _traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    this.logger.debug("sampling", spanName, SpanKind[spanKind])

    const parentSpanContext = trace.getSpanContext(parentContext)
    const traceOptions = getTraceOptions(parentContext)

    const tracingMode = this.tracingMode(spanName, spanKind, attributes)
    const decisions = this.oboeDecisions(
      parentSpanContext,
      traceOptions,
      tracingMode,
    )

    if (decisions.status > oboe.TRACING_DECISIONS_OK) {
      this.logger.warn(
        "oboe decisions returned with an error status",
        new OboeError(
          "Context",
          "getDecisions",
          decisions.status,
          decisions.status_msg,
        ),
      )
      return { decision: SamplingDecision.NOT_RECORD }
    } else if (decisions.auth > oboe.TRACING_DECISIONS_AUTH_OK) {
      this.logger.debug(
        "oboe decisions auth returned with an error status",
        new OboeError(
          "Context",
          "getDecisions",
          decisions.auth,
          decisions.auth_msg,
        ),
      )
    }

    const decision = SwSampler.otelSamplingDecisionFromOboe(decisions)
    const traceState = SwSampler.traceState(
      decisions,
      parentSpanContext,
      traceOptions,
    )
    const newAttributes = SwSampler.attributes(
      attributes,
      decisions,
      parentSpanContext,
      traceOptions,
      traceState,
    )

    this.recordMetricsFunction()
    return { decision, traceState, attributes: newAttributes }
  }

  toString(): string {
    return `SwSampler ${inspect(
      { triggerTraceEnabled: this.config.triggerTraceEnabled },
      { breakLength: Infinity, compact: true },
    )}`
  }

  private oboeDecisions(
    parentSpanContext: SpanContext | undefined,
    traceOptions: TraceOptions | undefined,
    tracingMode: oboe.DecisionOptions["custom_tracing_mode"],
  ): oboe.DecisionResult {
    let traceparent: string | null = null
    if (
      parentSpanContext &&
      trace.isSpanContextValid(parentSpanContext) &&
      parentSpanContext.isRemote
    ) {
      traceparent = traceParent(parentSpanContext)
    }

    const input: oboe.DecisionOptions = {
      in_xtrace: traceparent,
      custom_tracing_mode: tracingMode,
      custom_trigger_mode: this.config.triggerTraceEnabled
        ? oboe.TRIGGER_ENABLED
        : oboe.TRIGGER_DISABLED,
      request_type: traceOptions?.triggerTrace
        ? oboe.REQUEST_TYPE_TRIGGER
        : oboe.REQUEST_TYPE_REGULAR,
      header_options: traceOptions?.header,
      header_signature: traceOptions?.signature,
      header_timestamp: traceOptions?.timestamp,
      tracestate: parentSpanContext?.traceState?.get(TRACESTATE_SW_KEY),
    }
    this.logger.debug("tracing decision input", input)
    const output = this.oboeDecisionFunction(input)
    this.logger.debug("tracing decision output", output)
    return output
  }

  private tracingMode(
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
  ): oboe.DecisionOptions["custom_tracing_mode"] {
    let base = oboe.SETTINGS_UNSET
    if (this.config.tracingMode === true) {
      base = oboe.TRACE_ENABLED
    } else if (this.config.tracingMode === false) {
      base = oboe.TRACE_DISABLED
    }

    if (!this.config.transactionSettings) {
      return base
    }

    const kindName = SpanKind[spanKind]

    const httpScheme = attributes[SemanticAttributes.HTTP_SCHEME]?.toString()
    const netHostName = attributes[SemanticAttributes.NET_HOST_NAME]?.toString()
    const netHostPort = attributes[SemanticAttributes.NET_HOST_PORT]?.toString()
    const httpTarget = attributes[SemanticAttributes.HTTP_TARGET]?.toString()

    let identifier: string
    if (httpScheme && netHostName && httpTarget) {
      identifier = `${httpScheme}://${netHostName}`
      if (netHostPort) {
        identifier += `:${netHostPort}`
      }
      identifier += httpTarget
    } else {
      identifier = `${kindName}:${spanName}`
    }

    for (const { tracing, matcher } of this.config.transactionSettings) {
      if (matcher(identifier)) {
        return tracing ? oboe.TRACE_ENABLED : oboe.TRACE_DISABLED
      }
    }

    return base
  }

  private static otelSamplingDecisionFromOboe(
    decision: oboe.DecisionResult,
  ): SamplingDecision {
    if (decision.do_sample) {
      return SamplingDecision.RECORD_AND_SAMPLED
    } else if (decision.do_metrics) {
      return SamplingDecision.RECORD
    } else {
      return SamplingDecision.NOT_RECORD
    }
  }

  private static traceState(
    decisions: oboe.DecisionResult,
    parentSpanContext: SpanContext | undefined,
    traceOptions: TraceOptions | undefined,
  ): TraceState {
    if (!parentSpanContext || !trace.isSpanContextValid(parentSpanContext)) {
      return this.updateTraceState(
        createTraceState(),
        decisions,
        parentSpanContext,
        traceOptions,
      )
    }

    const traceState = parentSpanContext.traceState ?? createTraceState()
    return this.updateTraceState(
      traceState,
      decisions,
      parentSpanContext,
      traceOptions,
    )
  }

  private static updateTraceState(
    traceState: TraceState,
    decisions: oboe.DecisionResult,
    parentSpanContext: SpanContext | undefined,
    traceOptions: TraceOptions | undefined,
  ): TraceState {
    if (traceOptions) {
      traceState = traceState.set(
        TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
        this.traceOptionsResponse(decisions, parentSpanContext, traceOptions),
      )
    }

    return traceState
  }

  private static traceOptionsResponse(
    decisions: oboe.DecisionResult,
    parentSpanContext: SpanContext | undefined,
    traceOptions: TraceOptions,
  ): string {
    const response: string[] = []

    if (traceOptions.signature && decisions.auth_msg) {
      response.push(
        [TRACE_OPTIONS_RESPONSE_AUTH, decisions.auth_msg].join(EQUALS_W3C),
      )
    }

    if (decisions.auth <= 0) {
      let triggerMessage: string
      if (traceOptions.triggerTrace) {
        if (
          parentSpanContext &&
          trace.isSpanContextValid(parentSpanContext) &&
          parentSpanContext.isRemote &&
          decisions.type === 0
        ) {
          triggerMessage = TRACE_OPTIONS_RESPONSE_TRIGGER_IGNORED
        } else {
          triggerMessage = decisions.status_msg
        }
      } else {
        triggerMessage = TRACE_OPTIONS_RESPONSE_TRIGGER_NOT_REQUESTED
      }
      response.push(
        [TRACE_OPTIONS_RESPONSE_TRIGGER, triggerMessage].join(EQUALS_W3C),
      )
    }

    if (traceOptions.ignored.length > 0) {
      response.push(
        [
          TRACE_OPTIONS_RESPONSE_IGNORED,
          traceOptions.ignored.map(([k]) => k).join(COMMA_W3C),
        ].join(EQUALS_W3C),
      )
    }

    return response.join(";")
  }

  private static attributes(
    attributes: Attributes,
    decisions: oboe.DecisionResult,
    parentSpanContext: SpanContext | undefined,
    traceOptions: TraceOptions | undefined,
    traceState: TraceState,
  ): Attributes | undefined {
    if (!decisions.do_sample) {
      return undefined
    }

    const newAttributes = { ...attributes }

    if (traceOptions?.swKeys) {
      newAttributes[ATTRIBUTES_SW_KEYS_KEY] = traceOptions.swKeys
    }

    if (traceOptions?.custom) {
      for (const [k, v] of Object.entries(traceOptions.custom)) {
        newAttributes[k] = v
      }
    }

    newAttributes.BucketCapacity = decisions.bucket_cap
    newAttributes.BucketRate = decisions.bucket_rate
    newAttributes.SampleRate = decisions.sample_rate
    newAttributes.SampleSource = decisions.sample_source

    const parentSw = parentSpanContext?.traceState?.get(TRACESTATE_SW_KEY)
    if (parentSw && parentSpanContext?.isRemote) {
      newAttributes["sw.tracestate_parent_id"] = parentSw.split("-")[0]
    }

    if (parentSpanContext && trace.isSpanContextValid(parentSpanContext)) {
      let attrTraceState = traceState

      const capture = attributes[ATTRIBUTES_TRACESTATE_CAPTURE_KEY]
      if (capture && typeof capture === "string") {
        attrTraceState = this.updateTraceState(
          createTraceState(capture),
          decisions,
          parentSpanContext,
          traceOptions,
        )
      }

      attrTraceState = attrTraceState.unset(
        TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
      )

      newAttributes[ATTRIBUTES_TRACESTATE_CAPTURE_KEY] =
        attrTraceState.serialize()
    }

    return Object.freeze(newAttributes)
  }
}
