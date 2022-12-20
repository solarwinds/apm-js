import {
  type Context,
  type SpanContext,
  createContextKey,
} from "@opentelemetry/api"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"

const TRACE_OPTIONS_KEY = createContextKey("SWO X-Trace-Options")
const TRACEPARENT_VERSION = "00"

export interface TraceOptions {
  header: string

  signature?: string
  triggerTrace?: boolean
  timestamp: number
}

export function getTraceOptions(context: Context): TraceOptions | undefined {
  return context.getValue(TRACE_OPTIONS_KEY) as TraceOptions | undefined
}

export function setTraceOptions(
  context: Context,
  traceOptions: TraceOptions,
): Context {
  return context.setValue(TRACE_OPTIONS_KEY, traceOptions)
}

export function traceParent(spanContext: SpanContext): string {
  const traceId = spanContext.traceId
  const spanId = spanContext.spanId
  const flags = spanContext.traceFlags.toString(16).padStart(2, "0")

  return `${TRACEPARENT_VERSION}-${traceId}-${spanId}-${flags}`
}

export function parentSpanContext(span: ReadableSpan): SpanContext | undefined {
  const spanContext = span.spanContext()

  const parentId = span.parentSpanId
  if (!parentId) return undefined

  return {
    traceId: spanContext.traceId,
    traceFlags: spanContext.traceFlags,
    traceState: spanContext.traceState,
    spanId: parentId,
  }
}
