/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api"
import {
	DataPointType,
	type ExponentialHistogramMetricData,
	type HistogramMetricData,
} from "@opentelemetry/sdk-metrics"
import { describe, expect, it, otel } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.ts"
import { ParentSpanProcessor } from "../../src/processing/parent-span.ts"
import { ResponseTimeProcessor } from "../../src/processing/response-time.ts"
import { TransactionNameProcessor } from "../../src/processing/transaction-name.ts"

const responseTime = async () => {
	const metrics = await otel.metrics()
	const histograms = metrics
		.flatMap(({ scopeMetrics }) => scopeMetrics)
		.filter(({ scope }) => scope.name === "sw.apm.request.metrics")
		.flatMap(({ metrics }) => metrics)
		.filter(
			(metric): metric is HistogramMetricData | ExponentialHistogramMetricData =>
				metric.descriptor.name === "trace.service.response_time" &&
				(metric.dataPointType === DataPointType.HISTOGRAM ||
					metric.dataPointType === DataPointType.EXPONENTIAL_HISTOGRAM),
		)

	expect(histograms).to.have.lengthOf(1)
	const { dataPoints } = histograms[0]!
	expect(dataPoints).to.have.lengthOf(1)
	const { value, attributes } = dataPoints[0]!
	expect(value).to.have.property("count", 1)
	expect(value).to.have.property("sum")

	return { value: value.sum, attributes }
}

describe("ResponseTimeProcessor", () => {
	beforeEach(() =>
		otel.reset({
			trace: {
				spanProcessors: [
					new TransactionNameProcessor({} as Configuration),
					new ResponseTimeProcessor(),
					new ParentSpanProcessor(),
				],
			},
		}),
	)

	it("records response time for server spans", async () => {
		const tracer = trace.getTracer("test")
		tracer.startActiveSpan(
			"GET /hello/:name",
			{
				kind: SpanKind.SERVER,
				attributes: {
					"http.request.method": "GET",
					"http.route": "/hello/:name",
					"url.path": "/hello/world",
				},
			},
			(span) => {
				tracer.startActiveSpan("operation", (span) => {
					span.end()
				})

				span.setAttribute("http.response.status_code", 200)
				span.end()
			},
		)

		const { value, attributes } = await responseTime()
		expect(attributes).to.deep.equal({
			"sw.is_error": false,
			"sw.transaction": "/hello/:name",
			"http.request.method": "GET",
			"http.response.status_code": 200,
		})
		expect(value).to.be.greaterThan(0)
	})

	it("records response time for deprecated server spans", async () => {
		const tracer = trace.getTracer("test")
		tracer.startActiveSpan(
			"GET /hello/:name",
			{
				kind: SpanKind.SERVER,
				attributes: {
					"http.method": "GET",
					"http.route": "/hello/:name",
					"http.target": "/hello/world",
				},
			},
			(span) => {
				tracer.startActiveSpan("operation", (span) => {
					span.end()
				})

				span.setAttribute("http.status_code", 200)
				span.end()
			},
		)

		const { value, attributes } = await responseTime()
		expect(attributes).to.deep.equal({
			"sw.is_error": false,
			"sw.transaction": "/hello/:name",
			"http.method": "GET",
			"http.status_code": 200,
		})
		expect(value).to.be.greaterThan(0)
	})

	it("records response time for other spans", async () => {
		trace.getTracer("test").startActiveSpan(
			"GET /foo/bar",
			{
				kind: SpanKind.CLIENT,
				attributes: {
					"http.request.method": "GET",
				},
			},
			(span) => {
				span.setAttribute("http.response.status_code", 404)
				span.setStatus({ code: SpanStatusCode.ERROR })
				span.end()
			},
		)

		const { value, attributes } = await responseTime()
		expect(attributes).to.deep.equal({
			"sw.is_error": true,
			"sw.transaction": "GET /foo/bar",
		})
		expect(value).to.be.greaterThan(0)
	})
})
