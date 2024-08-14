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
  createTraceState,
  defaultTextMapSetter,
  ROOT_CONTEXT,
  trace,
  TraceFlags,
} from "@opentelemetry/api"
import { describe, expect, it } from "@solarwinds-apm/test"

import { TraceContextPropagator } from "../../src/propagation/trace-context.js"

describe("TraceContextPropagator", () => {
  const propagator = new TraceContextPropagator()

  it("inserts sw key in empty trace state", () => {
    const headers: Partial<Record<string, string>> = {}
    const context = trace.setSpanContext(ROOT_CONTEXT, {
      spanId: "0123456789abcdef",
      traceId: "0123456789abcdef0123456789abcdef",
      traceFlags: TraceFlags.SAMPLED,
    })

    propagator.inject(context, headers, defaultTextMapSetter)
    expect(headers.tracestate).to.equal("sw=0123456789abcdef-01")
  })

  it("inserts sw key in existing trace state", () => {
    const headers: Partial<Record<string, string>> = {}
    const context = trace.setSpanContext(ROOT_CONTEXT, {
      spanId: "0123456789abcdef",
      traceId: "0123456789abcdef0123456789abcdef",
      traceFlags: TraceFlags.SAMPLED,
      traceState: createTraceState().set("foo", "bar"),
    })

    propagator.inject(context, headers, defaultTextMapSetter)
    expect(headers.tracestate).to.be.oneOf([
      "sw=0123456789abcdef-01,foo=bar",
      "foo=bar,sw=0123456789abcdef-01",
    ])
  })
})
