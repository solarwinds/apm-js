import {
  type Context,
  createContextKey,
  INVALID_SPANID,
  type SpanContext,
} from "@opentelemetry/api"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import type * as oboe from "@swotel/bindings"

import { cache } from "./cache"

const TRACE_OPTIONS_KEY = createContextKey("SWO X-Trace-Options")
const TRACEPARENT_VERSION = "00"

export const TRACESTATE_SW_KEY = "sw"
export const TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY = "xtrace_options_response"

export const EQUALS_W3C = "####"
export const COMMA_W3C = "...."

export interface TraceOptions {
  header: string
  signature?: string

  triggerTrace?: boolean
  timestamp?: number
  swKeys?: string

  custom: Record<string, string>
  ignored: [string, string | undefined][]
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

export function swValue(spanContext: SpanContext): string
export function swValue(
  parentSpanContext: SpanContext | undefined,
  decisions: oboe.Context.DecisionsResult,
): string
export function swValue(
  ...args:
    | [spanContext: SpanContext]
    | [
        parentSpanContext: SpanContext | undefined,
        decisions: oboe.Context.DecisionsResult,
      ]
): string {
  const spanId = args[0]?.spanId ?? INVALID_SPANID

  const flagsInt = args.length === 2 ? args[1].do_sample : args[0].traceFlags
  const flags = flagsInt.toString(16).padStart(2, "0")

  return `${spanId}-${flags}`
}

export function traceParent(spanContext: SpanContext): string {
  const traceId = spanContext.traceId
  const sw = swValue(spanContext)

  return `${TRACEPARENT_VERSION}-${traceId}-${sw}`
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
    isRemote: cache.get(spanContext)?.parentRemote,
  }
}
