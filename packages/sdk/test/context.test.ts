import { INVALID_SPANID, ROOT_CONTEXT, TraceFlags } from "@opentelemetry/api"

import {
  getTraceOptions,
  parentSpanContext,
  setTraceOptions,
  swValue,
  traceParent,
} from "../src/context"
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

      expect(swValue(undefined, decisions)).toMatch(
        new RegExp(`^${INVALID_SPANID}-`),
      )
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
