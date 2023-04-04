import { randomBytes, randomInt } from "node:crypto"

import { type SpanContext, SpanKind, TraceFlags } from "@opentelemetry/api"
import { hrTime } from "@opentelemetry/core"
import { Resource } from "@opentelemetry/resources"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import type * as oboe from "@swotel/bindings"

import { type TraceOptions } from "../src/context"

function pick<T>(choices: T[]): T {
  return choices[randomInt(choices.length)]!
}

export function traceId(): string {
  return randomBytes(16).toString("hex")
}

export function spanId(): string {
  return randomBytes(8).toString("hex")
}

export function traceOptions(
  override: Partial<TraceOptions> = {},
): TraceOptions {
  const base: TraceOptions = {
    header: "",
    custom: {},
    ignored: [],
  }
  return { ...base, ...override }
}

export function spanContext(override: Partial<SpanContext> = {}): SpanContext {
  const base: SpanContext = {
    traceId: traceId(),
    spanId: spanId(),
    traceFlags: TraceFlags.NONE,
  }
  return { ...base, ...override }
}

export function readableSpan(
  override: Partial<ReadableSpan> = {},
): ReadableSpan {
  const sc = spanContext({})
  const base: ReadableSpan = {
    name: `Span ${sc.spanId.slice(0, 8)}`,
    kind: pick([SpanKind.INTERNAL, SpanKind.CLIENT, SpanKind.SERVER]),
    spanContext: () => sc,
    startTime: hrTime(),
    endTime: hrTime(),
    status: { code: 0 },
    attributes: {},
    links: [],
    events: [],
    duration: hrTime(),
    ended: pick([true, false]),
    resource: new Resource({}),
    instrumentationLibrary: { name: pick(["http", "fs"]) },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  }

  return { ...base, ...override }
}

export function oboeDecisions(
  override: Partial<oboe.Context.DecisionsResult> = {},
): oboe.Context.DecisionsResult {
  const base: oboe.Context.DecisionsResult = {
    do_metrics: pick([0, 1]),
    do_sample: pick([0, 1]),
    sample_rate: 0,
    sample_source: 0,
    bucket_rate: 0,
    bucket_cap: 0,
    type: 0,
    auth: 0,
    status_msg: "",
    auth_msg: "",
    status: 0,
  }
  return { ...base, ...override }
}
