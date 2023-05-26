import { type Context, trace, TraceFlags } from "@opentelemetry/api"
import {
  NoopSpanProcessor,
  type ReadableSpan,
  type Span,
} from "@opentelemetry/sdk-trace-base"

import { cache } from "./cache"

export class SwoParentInfoSpanProcessor extends NoopSpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const spanContext = span.spanContext()
    const parentSpanContext = trace.getSpanContext(parentContext)

    cache.setParentInfo(spanContext, {
      id: parentSpanContext?.spanId,
      remote: parentSpanContext?.isRemote,
    })
  }

  onEnd(span: ReadableSpan): void {
    const spanContext = span.spanContext()
    // clear hear unless sampled in which case the collector takes care of it
    if (!(spanContext.traceFlags & TraceFlags.SAMPLED)) {
      cache.clear(spanContext)
    }
  }
}
