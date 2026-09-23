/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { trace } from "@opentelemetry/api"
import { beforeEach, describe, expect, it, otel } from "@solarwinds-apm/test"

import {
	getRootOrEntry,
	isRootOrEntry,
	ParentSpanProcessor,
} from "../../src/processing/parent-span.ts"

describe("ParentSpanProcessor", () => {
	beforeEach(async () => {
		await otel.reset({ trace: { spanProcessors: [new ParentSpanProcessor()] } })
	})

	it("registers parent span information", () => {
		const tracer = trace.getTracer("test")

		tracer.startActiveSpan("parent", (parentSpan) => {
			expect(isRootOrEntry(parentSpan)).to.be.true
			expect(getRootOrEntry(parentSpan)).to.equal(parentSpan)

			tracer.startActiveSpan("child", (childSpan) => {
				expect(isRootOrEntry(childSpan)).to.be.false
				expect(getRootOrEntry(childSpan)).to.equal(parentSpan)

				childSpan.end()
			})

			parentSpan.end()
		})
	})
})
