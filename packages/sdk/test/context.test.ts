import {
  INVALID_SPANID,
  ROOT_CONTEXT,
  type SpanContext,
  TraceFlags,
} from "@opentelemetry/api"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import type * as oboe from "@swotel/bindings"

import {
  getTraceOptions,
  parentSpanContext,
  setTraceOptions,
  swValue,
  type TraceOptions,
  traceParent,
} from "../src/context"

const spanId = "01234567890abcdef"
const traceId = "01234567890abcdef01234567890abcdef"
const traceOptions: TraceOptions = {
  header: "",
  custom: {},
  ignored: [],
}
const spanContext: SpanContext = {
  traceId: "",
  spanId: "",
  traceFlags: 0,
}
const decisions: oboe.Context.DecisionsResult = {
  do_metrics: 0,
  do_sample: 0,
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
const readableSpan: ReadableSpan = {
  name: "",
  kind: 0,
  spanContext: () => spanContext,
  startTime: [0, 0],
  endTime: [0, 0],
  status: { code: 0 },
  attributes: {},
  links: [],
  events: [],
  duration: [0, 0],
  ended: false,
  resource: {
    attributes: {},
    merge() {
      return this
    },
  },
  instrumentationLibrary: { name: "" },
  droppedAttributesCount: 0,
  droppedEventsCount: 0,
  droppedLinksCount: 0,
}

describe("getTraceOptions", () => {
  it("returns undefined if no trace options are set", () => {
    expect(getTraceOptions(ROOT_CONTEXT)).toBeUndefined()
  })

  it("returns the trace options if they are set", () => {
    const context = setTraceOptions(ROOT_CONTEXT, traceOptions)
    expect(getTraceOptions(context)).toEqual(traceOptions)
  })
})

describe("swValue", () => {
  describe("given a span context", () => {
    it("returns the right value for NONE flags", () => {
      expect(
        swValue({ ...spanContext, spanId, traceFlags: TraceFlags.NONE }),
      ).toBe(`${spanId}-00`)
    })

    it("returns the right value for SAMPLED flags", () => {
      expect(
        swValue({ ...spanContext, spanId, traceFlags: TraceFlags.SAMPLED }),
      ).toBe(`${spanId}-01`)
    })
  })

  describe("given a parent span context and decisions", () => {
    const psc = {
      ...spanContext,
      spanId,
    }

    it("uses the invalid span id if the parent span context is undefined", () => {
      expect(swValue(undefined, decisions)).toMatch(
        new RegExp(`^${INVALID_SPANID}-`),
      )
    })

    it("returns the right value when do_sample is not set", () => {
      expect(swValue(psc, { ...decisions, do_sample: 0 })).toBe(`${spanId}-00`)
    })

    it("returns the right value when do_sample is set", () => {
      expect(swValue(psc, { ...decisions, do_sample: 1 })).toBe(`${spanId}-01`)
    })
  })
})

describe("traceParent", () => {
  it("returns the right value", () => {
    const sc = { ...spanContext, traceId, spanId }
    expect(traceParent(sc)).toBe(`00-${traceId}-${swValue(sc)}`)
  })
})

describe("parentSpanContext", () => {
  it("returns undefined for root spans", () => {
    const rs = { ...readableSpan, parentSpanId: undefined }
    expect(parentSpanContext(rs)).toBeUndefined()
  })

  it("returns the valid span context for spans with a parent", () => {
    const rs = {
      ...readableSpan,
      parentSpanId: spanId,
      spanContext: () => ({ ...spanContext, traceId, spanId: "child" }),
    }
    expect(parentSpanContext(rs)).toEqual({ ...spanContext, traceId, spanId })
  })
})
