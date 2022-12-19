import {
  type Attributes,
  type Context,
  type Link,
  type SpanKind,
  trace,
} from "@opentelemetry/api"
import {
  type Sampler,
  type SamplingResult,
  SamplingDecision,
} from "@opentelemetry/sdk-trace-base"
import * as oboe from "@swotel/bindings"
import { inspect } from "util"

import { type SwoConfiguration } from "./config"
import { getTraceOptions, traceParent } from "./context"
import { OboeError } from "./error"

const TRACESTATE_KEY = "sw"

export class SwoSampler implements Sampler {
  constructor(private readonly config: SwoConfiguration) {}

  shouldSample(
    context: Context,
    _traceId: string,
    _spanName: string,
    _spanKind: SpanKind,
    _attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    const spanContext = trace.getSpanContext(context)

    let traceparent: string | null = null
    if (
      spanContext &&
      trace.isSpanContextValid(spanContext) &&
      spanContext.isRemote
    ) {
      traceparent = traceParent(spanContext)
    }

    const traceOptions = getTraceOptions(context)

    const decisions = oboe.Context.getDecisions({
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
      tracestate: spanContext?.traceState?.get(TRACESTATE_KEY),
    })

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
    return { decision }
  }

  toString(): string {
    return `SwoSampler ${inspect(
      { triggerTraceEnabled: this.config.triggerTraceEnabled ?? false },
      { breakLength: Infinity, compact: true },
    )}`
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
}
