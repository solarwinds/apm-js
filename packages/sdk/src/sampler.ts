import { inspect } from "node:util"

import {
  type Attributes,
  type Context,
  createTraceState,
  INVALID_SPANID,
  type Link,
  type SpanContext,
  type SpanKind,
  trace,
  type TraceState,
} from "@opentelemetry/api"
import {
  type Sampler,
  SamplingDecision,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-base"
import * as oboe from "@swotel/bindings"

import { type SwoConfiguration } from "./config"
import { getTraceOptions, type TraceOptions, traceParent } from "./context"
import { OboeError } from "./error"

const TRACESTATE_KEY = "sw"
const TRACESTATE_CAPTURE_KEY = "sw.w3c.tracestate"

export class SwoSampler implements Sampler {
  constructor(private readonly config: SwoConfiguration) {}

  shouldSample(
    parentContext: Context,
    _traceId: string,
    _spanName: string,
    _spanKind: SpanKind,
    attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    const parentSpanContext = trace.getSpanContext(parentContext)
    const traceOptions = getTraceOptions(parentContext)

    const decisions = this.oboeDecisions(parentSpanContext, traceOptions)

    if (decisions.status > oboe.TRACING_DECISIONS_OK) {
      console.warn(
        new OboeError("Context", "getDecisions", decisions.status),
        decisions.status_msg,
        decisions.auth_msg,
      )
      return { decision: SamplingDecision.NOT_RECORD }
    }

    // TODO: trace state and attributes

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
      custom_tracing_mode: oboe.SETTINGS_UNSET,
      custom_trigger_mode: this.config.triggerTraceEnabled
        ? oboe.TRIGGER_ENABLED
        : oboe.TRIGGER_DISABLED,
      request_type: traceOptions?.triggerTrace
        ? oboe.REQUEST_TYPE_TRIGGER
        : oboe.REQUEST_TYPE_REGULAR,
      header_options: traceOptions?.header,
      header_signature: traceOptions?.signature,
      header_timestamp: traceOptions?.timestamp,
      tracestate: parentSpanContext?.traceState?.get(TRACESTATE_KEY),
    })
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
    _traceOptions: TraceOptions | undefined,
  ): TraceState {
    const spanId = parentSpanContext?.spanId ?? INVALID_SPANID
    const traceFlags = decisions.do_sample.toString(16).padStart(2, "0")
    traceState = traceState.set(TRACESTATE_KEY, `${spanId}-${traceFlags}`)

    // TODO: X-Trace-Options-Response

    return traceState
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

    // TODO: X-Trace-Options

    newAttributes.BucketCapacity = decisions.bucket_cap
    newAttributes.BucketRate = decisions.bucket_rate
    newAttributes.SampleRate = decisions.sample_rate
    newAttributes.SampleSource = decisions.sample_source

    const parentSw = parentSpanContext?.traceState?.get(TRACESTATE_KEY)
    if (parentSw && parentSpanContext?.isRemote) {
      newAttributes["sw.tracestate_parent_id"] = parentSw.split("-")[0]
    }

    if (parentSpanContext && trace.isSpanContextValid(parentSpanContext)) {
      let attrTraceState = traceState

      const capture = attributes[TRACESTATE_CAPTURE_KEY]
      if (capture && typeof capture === "string") {
        attrTraceState = this.updateTraceState(
          createTraceState(capture),
          decisions,
          parentSpanContext,
          traceOptions,
        )
      }

      // TODO: Remove X-Trace-Option-Response

      newAttributes[TRACESTATE_CAPTURE_KEY] = attrTraceState.serialize()
    }

    return Object.freeze(newAttributes)
  }
}
