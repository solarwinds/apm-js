import { type Context, trace } from "@opentelemetry/api"
import { NoopSpanProcessor, type Span } from "@opentelemetry/sdk-trace-base"

import { cache } from "./cache"

export class SwoParentInfoSpanProcessor extends NoopSpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    const spanContext = span.spanContext()
    const parentSpanContext = trace.getSpanContext(parentContext)

    cache.setParentRemote(spanContext, parentSpanContext?.isRemote)
  }
}
