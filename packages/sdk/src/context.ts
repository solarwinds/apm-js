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

import {
  type Context,
  createContextKey,
  type SpanContext,
  trace,
} from "@opentelemetry/api"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { oboe } from "@solarwinds-apm/bindings"

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

export function swValue(spanContext: SpanContext): string {
  const spanId = spanContext.spanId

  const flagsInt = spanContext.traceFlags
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
    spanId: parentId,
    isRemote: cache.get(spanContext)?.parentRemote,
  }
}

export function setTransactionName(context: Context, name: string): boolean {
  if (!name) return false

  const spanContext = trace.getSpanContext(context)
  if (!spanContext) return false

  const rootCache = cache.getRoot(spanContext)
  if (!rootCache) return false

  rootCache.txname = name
  return true
}

export function waitUntilAgentReady(timeout: number): number {
  return oboe.Context.isReady(timeout)
}
