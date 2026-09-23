/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { ROOT_CONTEXT, type Span, trace } from "@opentelemetry/api"
import { describe, expect, it } from "@solarwinds-apm/test"

import { contextStorage, global, spanStorage } from "../src/storage.ts"

const tracer = trace.getTracer("test")

describe("global", () => {
	it("works", () => {
		const value = global("test", () => "value")
		expect(value).to.equal("value")
	})

	it("returns existing", () => {
		const value = global("test", () => "not value")
		expect(value).to.equal("value")
	})
})

describe("ContextStorage", () => {
	const storage = contextStorage<string>("test")

	it("works", () => {
		const context = storage.set(ROOT_CONTEXT, "value")
		expect(storage.get(context)).to.equal("value")
	})

	it("returns undefined if unset", () => {
		expect(storage.get(ROOT_CONTEXT)).to.be.undefined
	})
})

describe("SpanStorage", () => {
	const storage = spanStorage<string>("test")

	it("works", () => {
		const span = tracer.startActiveSpan("test", (span) => {
			expect(storage.set(span, "value")).to.be.true

			span.end()
			return span
		})

		expect(storage.get(span)).to.equal("value")

		storage.delete(span)
		expect(storage.get(span)).to.be.undefined
	})

	it("ignores invalid spans", () => {
		const span = {} as Span
		expect(storage.set(span, "value")).to.be.false
		expect(storage.get(span)).to.be.undefined
	})
})
