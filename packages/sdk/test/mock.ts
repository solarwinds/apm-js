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

import { randomBytes, randomInt } from "node:crypto"

import {
  type Attributes,
  type Context,
  createTraceState,
  type DiagLogger,
  DiagLogLevel,
  type SpanContext,
  SpanKind,
  type SpanOptions,
  TraceFlags,
  type TraceState,
} from "@opentelemetry/api"
import { hrTime, type InstrumentationScope } from "@opentelemetry/core"
import { Resource } from "@opentelemetry/resources"
import {
  BasicTracerProvider,
  type ReadableSpan,
  type Span,
  Tracer,
  type TracerConfig,
} from "@opentelemetry/sdk-trace-base"
import type { oboe } from "@solarwinds-apm/bindings"

import { type SwConfiguration } from "../src"
import { type TraceOptions } from "../src/context"

export function pick<T>(choices: T[]): T {
  return choices[randomInt(choices.length)]!
}

export function config(
  override: Partial<SwConfiguration> = {},
): SwConfiguration {
  const base: SwConfiguration = {
    token: "",
    serviceName: "",
    enabled: true,
    oboeLogLevel: 6,
    otelLogLevel: DiagLogLevel.ALL,
    runtimeMetrics: true,
    triggerTraceEnabled: true,
    insertTraceContextIntoLogs: true,
    insertTraceContextIntoQueries: true,
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

export function instrumentationScope(
  override: Partial<InstrumentationScope> = {},
): InstrumentationScope {
  const base: InstrumentationScope = {
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

export function tracer(is?: InstrumentationScope, tc?: TracerConfig): Tracer {
  is ??= instrumentationScope()
  tc ??= tracerConfig()

  return new Tracer(is, tc, new BasicTracerProvider(tc))
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
    instrumentationLibrary: instrumentationScope(),
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  }

  return { ...base, ...override }
}

export function oboeDecisions(
  override: Partial<oboe.DecisionResult> = {},
): oboe.DecisionResult {
  const base: oboe.DecisionResult = {
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
