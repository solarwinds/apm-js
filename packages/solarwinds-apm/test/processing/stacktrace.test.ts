/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { setTimeout } from "node:timers/promises"

import { trace } from "@opentelemetry/api"
import { hrTimeToMilliseconds } from "@opentelemetry/core"
import type { ReadableSpan } from "@opentelemetry/sdk-trace"
import { beforeEach, describe, expect, it, otel } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.ts"
import { StacktraceProcessor } from "../../src/processing/stacktrace.ts"

describe("StacktraceProcessor", () => {
	describe("without config", () => {
		beforeEach(async () => {
			await otel.reset({
				trace: {
					spanProcessors: [new StacktraceProcessor({} as Configuration)],
				},
			})
		})

		it("doesn't collect stacktrace", async () => {
			const tracer = trace.getTracer("test")

			tracer.startActiveSpan("test", (span) => {
				span.end()
			})

			const spans = await otel.spans()
			expect(spans).to.have.lengthOf(1)
			const span = spans[0]!
			expect(span.attributes["code.stacktrace"]).to.be.undefined
		})
	})

	describe("with duration-based config", () => {
		beforeEach(async () => {
			await otel.reset({
				trace: {
					spanProcessors: [
						new StacktraceProcessor({
							spanStacktraceFilter: (span: ReadableSpan) =>
								hrTimeToMilliseconds(span.duration) > 100,
						} as unknown as Configuration),
					],
				},
			})
		})

		it("doesn't collect stacktrace for short lived span", async () => {
			const tracer = trace.getTracer("test")

			tracer.startActiveSpan("test", (span) => {
				span.end()
			})

			const spans = await otel.spans()
			expect(spans).to.have.lengthOf(1)
			const span = spans[0]!
			expect(span.attributes["code.stacktrace"]).to.be.undefined
		})

		it("collects stacktrace for long lived span", async () => {
			const tracer = trace.getTracer("test")

			await tracer.startActiveSpan("test", async (span) => {
				await setTimeout(500)
				span.end()
			})

			const spans = await otel.spans()
			expect(spans).to.have.lengthOf(1)
			const span = spans[0]!
			expect(typeof span.attributes["code.stacktrace"]).to.equal("string")
		})
	})
})
