/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import {
	createTraceState,
	defaultTextMapSetter,
	ROOT_CONTEXT,
	trace,
	TraceFlags,
} from "@opentelemetry/api"
import { describe, expect, it } from "@solarwinds-apm/test"

import { TraceContextPropagator } from "../../src/propagation/trace-context.ts"

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
