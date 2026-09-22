/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { setTimeout } from "node:timers/promises"

import { trace } from "@opentelemetry/api"
import type * as sdk from "@opentelemetry/sdk-trace"
import { describe, expect, it, otel } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.ts"
import { ParentSpanProcessor } from "../../src/processing/parent-span.ts"
import {
	computedTransactionName,
	setTransactionName,
	TransactionNamePool,
	TransactionNameProcessor,
} from "../../src/processing/transaction-name.ts"

describe("TransactionNameProcessor", () => {
	it("sets transaction name on entry spans", async () => {
		await otel.reset({
			trace: {
				spanProcessors: [
					new TransactionNameProcessor({} as Configuration),
					new ParentSpanProcessor(),
				],
			},
		})

		const tracer = trace.getTracer("test")
		tracer.startActiveSpan("parent", (span) => {
			expect(span.isRecording()).to.be.true

			tracer.startActiveSpan("child", (span) => {
				expect(span.isRecording()).to.be.true
				span.end()
			})

			span.end()
		})

		const spans = await otel.spans()
		expect(spans).to.have.lengthOf(2)

		const parent = spans.find((s) => s.name === "parent")!
		const child = spans.find((s) => s.name === "child")!

		expect(parent.attributes).to.have.property("sw.transaction", "parent")
		expect(child.attributes).not.to.have.property("sw.transaction")
	})

	it("respects configured transaction name", async () => {
		await otel.reset({
			trace: {
				spanProcessors: [
					new TransactionNameProcessor({
						transactionName: (_span) => "default",
					} as Configuration),
					new ParentSpanProcessor(),
				],
			},
		})

		const tracer = trace.getTracer("test")
		tracer.startActiveSpan("parent", (span) => {
			expect(span.isRecording()).to.be.true

			tracer.startActiveSpan("child", (span) => {
				expect(span.isRecording()).to.be.true
				span.end()
			})

			span.end()
		})

		const spans = await otel.spans()
		expect(spans).to.have.lengthOf(2)

		const parent = spans.find((s) => s.name === "parent")!
		const child = spans.find((s) => s.name === "child")!

		expect(parent.attributes).to.have.property("sw.transaction", "default")
		expect(child.attributes).not.to.have.property("sw.transaction")
	})

	it("respects custom transaction name", async () => {
		await otel.reset({
			trace: {
				spanProcessors: [
					new TransactionNameProcessor({
						transactionName: (_span) => "default",
					} as Configuration),
					new ParentSpanProcessor(),
				],
			},
		})

		const tracer = trace.getTracer("test")
		tracer.startActiveSpan("parent", (span) => {
			expect(span.isRecording()).to.be.true

			tracer.startActiveSpan("child", (span) => {
				expect(span.isRecording()).to.be.true

				expect(setTransactionName("custom")).to.be.true

				span.end()
			})

			span.end()
		})

		const spans = await otel.spans()
		expect(spans).to.have.lengthOf(2)

		const parent = spans.find((s) => s.name === "parent")!
		const child = spans.find((s) => s.name === "child")!

		expect(parent.attributes).to.have.property("sw.transaction", "custom")
		expect(child.attributes).not.to.have.property("sw.transaction")
	})

	it("has a max cardinality of 200 + 1", async () => {
		await otel.reset({
			trace: {
				spanProcessors: [
					new TransactionNameProcessor({} as Configuration),
					new ParentSpanProcessor(),
				],
			},
		})

		const tracer = trace.getTracer("test")
		for (let i = 0; i <= 200; i++) {
			const span = tracer.startSpan(i.toString())
			span.end()
		}

		const spans = await otel.spans()
		expect(spans).to.have.lengthOf(201)

		const didNotMakeIt = spans.filter((span) => span.attributes["sw.transaction"] === "other")
		expect(didNotMakeIt).to.have.lengthOf(1)
	})

	it("trims transaction names to 256 characters", async () => {
		await otel.reset({
			trace: {
				spanProcessors: [
					new TransactionNameProcessor({} as Configuration),
					new ParentSpanProcessor(),
				],
			},
		})

		const tracer = trace.getTracer("test")
		tracer.startActiveSpan("parent", (span) => {
			expect(span.isRecording()).to.be.true

			tracer.startActiveSpan("child", (span) => {
				expect(span.isRecording()).to.be.true

				expect(setTransactionName("hello".repeat(100))).to.be.true

				span.end()
			})

			span.end()
		})

		const spans = await otel.spans()
		expect(spans).to.have.lengthOf(2)

		const parent = spans.find((s) => s.name === "parent")!
		const child = spans.find((s) => s.name === "child")!

		expect(parent.attributes).to.have.property("sw.transaction").with.lengthOf(256)
		expect(child.attributes).not.to.have.property("sw.transaction")
	})
})

describe("computedTransactionName", () => {
	it("computes normal span name", () => {
		const span = trace.getTracer("test").startSpan("test") as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("test")
	})

	it("computes routed HTTP span name", () => {
		const span = trace.getTracer("test").startSpan("GET", {
			attributes: {
				"http.route": "/hello/:name",
				"url.path": "/hello/world",
			},
		}) as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("/hello/:name")
	})

	it("computes deprecated routed HTTP span name", () => {
		const span = trace.getTracer("test").startSpan("GET", {
			attributes: {
				"http.route": "/hello/:name",
				"http.target": "/hello/world",
			},
		}) as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("/hello/:name")
	})

	it("computes short HTTP span name", () => {
		const span = trace.getTracer("test").startSpan("GET", {
			attributes: { "url.path": "/cart" },
		}) as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("/cart")
	})

	it("computes deprecated short HTTP span name", () => {
		const span = trace.getTracer("test").startSpan("GET", {
			attributes: { "http.target": "/cart" },
		}) as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("/cart")
	})

	it("computes long HTTP span name", () => {
		const span = trace.getTracer("test").startSpan("GET", {
			attributes: { "url.path": "/shop/products/293/detail" },
		}) as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("/shop/products")
	})

	it("computes deprecated long HTTP span name", () => {
		const span = trace.getTracer("test").startSpan("GET", {
			attributes: { "http.target": "/shop/products/293/detail" },
		}) as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("/shop/products")
	})

	it("computes lambda span name", () => {
		const init = process.env.AWS_LAMBDA_FUNCTION_NAME
		process.env.AWS_LAMBDA_FUNCTION_NAME = "lambda"

		const span = trace.getTracer("test").startSpan("GET", {
			attributes: {
				"http.route": "/hello/:name",
				"url.path": "/hello/world",
			},
		}) as sdk.Span
		span.end()

		expect(computedTransactionName(span)).to.equal("lambda")

		process.env.AWS_LAMBDA_FUNCTION_NAME = init
	})
})

describe("TransactionNamePool", () => {
	it("works as expected", async () => {
		const pool = new TransactionNamePool({
			max: 2,
			ttl: 10,
			maxLength: 3,
			default: "default",
		})

		expect(pool.registered("foo")).to.equal("foo")
		expect(pool.registered("bar")).to.equal("bar")
		expect(pool.registered("baz")).to.equal("default")
		expect(pool.registered("foo")).to.equal("foo")

		await setTimeout(50)

		expect(pool.registered("baz")).to.equal("baz")
		expect(pool.registered("fooo")).to.equal("foo")
	})
})
