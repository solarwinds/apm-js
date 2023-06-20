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
  context,
  INVALID_SPANID,
  ROOT_CONTEXT,
  type Span,
  trace,
  TraceFlags,
} from "@opentelemetry/api"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"

import { cache } from "../src/cache"
import {
  getTraceOptions,
  parentSpanContext,
  setTraceOptions,
  setTransactionName,
  swValue,
  traceParent,
} from "../src/context"
import { SwoParentInfoSpanProcessor } from "../src/parent-info-processor"
import * as mock from "./mock"

describe("getTraceOptions", () => {
  it("returns undefined if no trace options are set", () => {
    expect(getTraceOptions(ROOT_CONTEXT)).toBeUndefined()
  })

  it("returns the trace options if they are set", () => {
    const traceOptions = mock.traceOptions()

    const context = setTraceOptions(ROOT_CONTEXT, traceOptions)
    expect(getTraceOptions(context)).toEqual(traceOptions)
  })
})

describe("swValue", () => {
  describe("given a span context", () => {
    it("returns the right value for NONE flags", () => {
      const spanId = mock.spanId()
      const spanContext = mock.spanContext({
        spanId,
        traceFlags: TraceFlags.NONE,
      })

      expect(swValue(spanContext)).toBe(`${spanId}-00`)
    })

    it("returns the right value for SAMPLED flags", () => {
      const spanId = mock.spanId()
      const spanContext = mock.spanContext({
        spanId,
        traceFlags: TraceFlags.SAMPLED,
      })

      expect(swValue(spanContext)).toBe(`${spanId}-01`)
    })
  })

  describe("given a parent span context and decisions", () => {
    it("uses the invalid span id if the parent span context is undefined", () => {
      const decisions = mock.oboeDecisions()

      expect(swValue(undefined, decisions)).toStartWith(INVALID_SPANID)
    })

    it("returns the right value when do_sample is not set", () => {
      const spanId = mock.spanId()
      const parentSpanContext = mock.spanContext({ spanId })
      const decisions = mock.oboeDecisions({ do_sample: 0 })

      expect(swValue(parentSpanContext, decisions)).toBe(`${spanId}-00`)
    })

    it("returns the right value when do_sample is set", () => {
      const spanId = mock.spanId()
      const parentSpanContext = mock.spanContext({ spanId })
      const decisions = mock.oboeDecisions({ do_sample: 1 })

      expect(swValue(parentSpanContext, decisions)).toBe(`${spanId}-01`)
    })
  })
})

describe("traceParent", () => {
  it("returns the right value", () => {
    const traceId = mock.traceId()
    const spanContext = mock.spanContext({ traceId })

    expect(traceParent(spanContext)).toBe(
      `00-${traceId}-${swValue(spanContext)}`,
    )
  })
})

describe("parentSpanContext", () => {
  it("returns undefined for root spans", () => {
    const readableSpan = mock.readableSpan({ parentSpanId: undefined })

    expect(parentSpanContext(readableSpan)).toBeUndefined()
  })

  it("returns the valid span context for spans with a parent", () => {
    const traceId = mock.traceId()
    const parentSpanId = mock.spanId()
    const spanContext = mock.spanContext({ traceId })
    const readableSpan = mock.readableSpan({
      parentSpanId,
      spanContext: () => spanContext,
    })

    expect(parentSpanContext(readableSpan)).toEqual({
      ...spanContext,
      spanId: parentSpanId,
    })
  })
})

describe("setTransactionName", () => {
  it("returns false if there is no active span", () => {
    expect(setTransactionName(ROOT_CONTEXT, "foo")).toBe(false)
  })

  it("returns false if there is no cache entry", () => {
    expect(
      setTransactionName(trace.setSpan(ROOT_CONTEXT, mock.span()), "foo"),
    ).toBe(false)
  })

  it("returns true and sets the transaction name of the root span if there is a cache entry", () => {
    const txname = "foo"

    const provider = new NodeTracerProvider()
    provider.addSpanProcessor(new SwoParentInfoSpanProcessor())
    provider.register()

    const tracer = trace.getTracer("test")

    let parent: Span
    tracer.startActiveSpan("parent", (s) => {
      parent = s

      tracer.startActiveSpan("child", (s) => {
        expect(setTransactionName(context.active(), txname)).toBe(true)

        s.end()
      })

      s.end()
    })

    expect(cache.get(parent!.spanContext())?.txname).toBe(txname)
  })
})
