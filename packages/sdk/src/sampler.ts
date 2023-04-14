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
import * as oboe from "@swotel/bindings"

import { type SwoConfiguration } from "./config"
import {
  COMMA_W3C,
  EQUALS_W3C,
  getTraceOptions,
  swValue,
  type TraceOptions,
  traceParent,
  TRACESTATE_SW_KEY,
  TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
} from "./context"
import { OboeError } from "./error"

const ATTRIBUTES_SW_KEYS_KEY = "SWKeys"
const ATTRIBUTES_TRACESTATE_CAPTURE_KEY = "sw.w3c.tracestate"

const TRACE_OPTIONS_RESPONSE_AUTH = "auth"
const TRACE_OPTIONS_RESPONSE_TRIGGER = "trigger-trace"
const TRACE_OPTIONS_RESPONSE_IGNORED = "ignored"
const TRACE_OPTIONS_RESPONSE_TRIGGER_IGNORED = "ignored"
const TRACE_OPTIONS_RESPONSE_TRIGGER_NOT_REQUESTED = "not-requested"

export class SwoSampler implements Sampler {
  constructor(
    private readonly config: SwoConfiguration,
    private readonly logger: DiagLogger,
  ) {}

  shouldSample(
    parentContext: Context,
    _traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
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
        new OboeError("Context", "getDecisions", decisions.status),
      )
      this.logger.debug(
        decisions.status_msg,
        decisions.auth_msg,
        decisions.status,
      )
      return { decision: SamplingDecision.NOT_RECORD }
    }

    const decision = SwoSampler.otelSamplingDecisionFromOboe(decisions)
    const traceState = SwoSampler.traceState(
      decisions,
      parentSpanContext,
      traceOptions,
    )
    const newAttributes = SwoSampler.attributes(
      attributes,
      decisions,
      parentSpanContext,
      traceOptions,
      traceState,
    )
    return { decision, traceState, attributes: newAttributes }
  }

  toString(): string {
    return `SwoSampler ${inspect(
      { triggerTraceEnabled: this.config.triggerTraceEnabled ?? false },
      { breakLength: Infinity, compact: true },
    )}`
  }

  private oboeDecisions(
    parentSpanContext: SpanContext | undefined,
    traceOptions: TraceOptions | undefined,
    tracingMode: oboe.Context.DecisionsOptions["custom_tracing_mode"],
  ): oboe.Context.DecisionsResult {
    let traceparent: string | null = null
    if (
      parentSpanContext &&
      trace.isSpanContextValid(parentSpanContext) &&
      parentSpanContext.isRemote
    ) {
      traceparent = traceParent(parentSpanContext)
    }

    return oboe.Context.getDecisions({
      in_xtrace: traceparent,
      custom_sample_rate: oboe.SETTINGS_UNSET,
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
    })
  }

  private tracingMode(
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
  ): oboe.Context.DecisionsOptions["custom_tracing_mode"] {
    if (!this.config.transactionSettings) {
      return oboe.SETTINGS_UNSET
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
        identifier = `${identifier}:${netHostPort}`
      }
      identifier = `${identifier}${httpTarget}`
    } else {
      identifier = `${kindName}:${spanName}`
    }

    for (const { tracing, matcher } of this.config.transactionSettings) {
      if (matcher(identifier)) {
        return tracing ? oboe.TRACE_ENABLED : oboe.TRACE_DISABLED
      }
    }

    return oboe.SETTINGS_UNSET
  }

  private static otelSamplingDecisionFromOboe(
    decision: oboe.Context.DecisionsResult,
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
    decisions: oboe.Context.DecisionsResult,
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
    decisions: oboe.Context.DecisionsResult,
    parentSpanContext: SpanContext | undefined,
    traceOptions: TraceOptions | undefined,
  ): TraceState {
    traceState = traceState.set(
      TRACESTATE_SW_KEY,
      swValue(parentSpanContext, decisions),
    )

    if (traceOptions) {
      traceState = traceState.set(
        TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
        this.traceOptionsResponse(decisions, parentSpanContext, traceOptions),
      )
    }

    return traceState
  }

  private static traceOptionsResponse(
    decisions: oboe.Context.DecisionsResult,
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

      if (traceOptions.ignored.length > 0) {
        response.push(
          [
            TRACE_OPTIONS_RESPONSE_IGNORED,
            traceOptions.ignored.map(([k]) => k).join(COMMA_W3C),
          ].join(EQUALS_W3C),
        )
      }
    }

    return response.join(";")
  }

  private static attributes(
    attributes: Attributes,
    decisions: oboe.Context.DecisionsResult,
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
