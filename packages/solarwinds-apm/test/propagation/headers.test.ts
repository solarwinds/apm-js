/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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
  defaultTextMapGetter,
  defaultTextMapSetter,
  ROOT_CONTEXT,
  type Span,
  trace,
  TraceFlags,
} from "@opentelemetry/api"
import { describe, expect, it } from "@solarwinds-apm/test"

import {
  firstIfArray,
  HEADERS_STORAGE,
  joinIfArray,
  RequestHeadersPropagator,
  ResponseHeadersPropagator,
} from "../../src/propagation/headers.js"

describe("RequestHeadersPropagator", () => {
  const propagator = new RequestHeadersPropagator()

  it("extracts empty headers when not present", () => {
    const context = propagator.extract(ROOT_CONTEXT, {}, defaultTextMapGetter)
    expect(HEADERS_STORAGE.get(context)?.request).to.loosely.deep.equal({})
  })

  it("extracts single headers", () => {
    const headers = {
      "x-trace-options": "options",
      "x-trace-options-signature": "options-signature",
    }
    const context = propagator.extract(
      ROOT_CONTEXT,
      headers,
      defaultTextMapGetter,
    )
    expect(HEADERS_STORAGE.get(context)?.request).to.loosely.deep.equal({
      "X-Trace-Options": "options",
      "X-Trace-Options-Signature": "options-signature",
    })
  })

  it("extracts multi headers", () => {
    const headers = {
      "x-trace-options": ["foo", "bar"],
      "x-trace-options-signature": ["good", "bad"],
    }
    const context = propagator.extract(
      ROOT_CONTEXT,
      headers,
      defaultTextMapGetter,
    )
    expect(HEADERS_STORAGE.get(context)?.request).to.loosely.deep.equal({
      "X-Trace-Options": "foo;bar",
      "X-Trace-Options-Signature": "good",
    })
  })

  it("lists proper fields", () => {
    expect(propagator.fields()).to.have.members([
      "X-Trace-Options",
      "X-Trace-Options-Signature",
    ])
  })
})

describe("ResponseHeadersPropagator", () => {
  const propagator = new ResponseHeadersPropagator()

  it("injects headers", () => {
    const headers = {}
    const context = HEADERS_STORAGE.set(
      trace.setSpan(ROOT_CONTEXT, {
        spanContext: () => ({
          traceId: "0123456789abcdef0123456789abcdef",
          spanId: "0123456789abcdef",
          traceFlags: TraceFlags.SAMPLED,
        }),
      } as Span),
      {
        request: {},
        response: { "X-Trace-Options-Response": "response" },
      },
    )

    propagator.inject(context, headers, defaultTextMapSetter)
    expect(headers).to.loosely.deep.equal({
      "X-Trace": "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      "X-Trace-Options-Response": "response",
      "Access-Control-Expose-Headers": "X-Trace, X-Trace-Options-Response",
    })
  })

  it("lists proper fields", () => {
    expect(propagator.fields()).to.have.members([
      "X-Trace",
      "X-Trace-Options-Response",
      "Access-Control-Expose-Headers",
    ])
  })
})

describe("firstIfArray", () => {
  it("returns undefined if undefined", () => {
    expect(firstIfArray<string>(undefined)).to.be.undefined
  })

  it("returns value if not array", () => {
    expect(firstIfArray("value")).to.equal("value")
  })

  it("returns undefined if empty array", () => {
    expect(firstIfArray<number>([])).to.be.undefined
  })

  it("returns first element if array", () => {
    expect(firstIfArray([1, 2])).to.equal(1)
  })
})

describe("joinIfArray", () => {
  it("returns undefined if undefined", () => {
    expect(joinIfArray(undefined, ";")).to.be.undefined
  })

  it("returns value if not array", () => {
    expect(joinIfArray("value", ";")).to.equal("value")
  })

  it("returns undefined if empty array", () => {
    expect(joinIfArray([], ";")).to.be.undefined
  })

  it("returns joined if array", () => {
    expect(joinIfArray(["foo", "bar"], ";")).to.equal("foo;bar")
  })
})
