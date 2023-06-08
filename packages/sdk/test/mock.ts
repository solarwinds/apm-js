import { randomBytes, randomInt } from "node:crypto"

import {
  type Attributes,
  type Context,
  createTraceState,
  type DiagLogger,
  type SpanContext,
  SpanKind,
  type SpanOptions,
  TraceFlags,
  type TraceState,
} from "@opentelemetry/api"
import { hrTime, type InstrumentationLibrary } from "@opentelemetry/core"
import { Resource } from "@opentelemetry/resources"
import {
  BasicTracerProvider,
  type ReadableSpan,
  type Span,
  Tracer,
  type TracerConfig,
} from "@opentelemetry/sdk-trace-base"
import type { oboe } from "@swotel/bindings"

import { type SwoConfiguration } from "../src"
import { type TraceOptions } from "../src/context"

export function pick<T>(choices: T[]): T {
  return choices[randomInt(choices.length)]!
}

export function config(
  override: Partial<SwoConfiguration> = {},
): SwoConfiguration {
  const base: SwoConfiguration = {
    serviceKey: "",
    enabled: true,
    triggerTraceEnabled: true,
    insertTraceIdsIntoLogs: true,
  }

  return { ...base, ...override }
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

export function resource(attributes: Attributes = {}): Resource {
  return new Resource(attributes)
}

export function instrumentationLibrary(
  override: Partial<InstrumentationLibrary> = {},
): InstrumentationLibrary {
  const base: InstrumentationLibrary = {
    name: pick(["http", "fs", "crypto"]),
  }

  return { ...base, ...override }
}

export function tracerConfig(
  override: Partial<TracerConfig> = {},
): TracerConfig {
  const base: TracerConfig = {}

  return { ...base, ...override }
}

export function tracer(il?: InstrumentationLibrary, tc?: TracerConfig): Tracer {
  il ??= instrumentationLibrary()
  tc ??= tracerConfig()

  return new Tracer(il, tc, new BasicTracerProvider(tc))
}

export function spanOptions(override: Partial<SpanOptions> = {}): SpanOptions {
  const base: SpanOptions = {}

  return { ...base, ...override }
}

export function traceState(raw?: string): TraceState {
  return createTraceState(raw)
}

export function span(
  t?: Tracer,
  name?: string,
  so?: SpanOptions,
  context?: Context,
): Span {
  t ??= tracer()
  name ??= pick(["readFile", "writeFile", "connect", "listen", "send", "recv"])
  so ??= spanOptions()

  return t.startSpan(name, so, context) as Span
}

export function readableSpan(
  override: Partial<ReadableSpan> = {},
): ReadableSpan {
  const sc = spanContext()
  const base: ReadableSpan = {
    name: pick(["readFile", "writeFile", "connect", "listen", "send", "recv"]),
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
    instrumentationLibrary: instrumentationLibrary(),
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

export function logger(): DiagLogger {
  return {
    error: () => {
      /* noop */
    },
    warn: () => {
      /* noop */
    },
    info: () => {
      /* noop */
    },
    debug: () => {
      /* noop */
    },
    verbose: () => {
      /* noop */
    },
  }
}
