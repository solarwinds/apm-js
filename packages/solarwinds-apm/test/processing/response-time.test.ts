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

import { diag, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api"
import {
  DataPointType,
  type ExponentialHistogramMetricData,
  type HistogramMetricData,
} from "@opentelemetry/sdk-metrics"
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_URL_PATH,
} from "@opentelemetry/semantic-conventions"
import { type SwConfiguration } from "@solarwinds-apm/sdk"
import { describe, expect, it, otel } from "@solarwinds-apm/test"

import { ParentSpanProcessor } from "../../src/processing/parent-span.js"
import { ResponseTimeProcessor } from "../../src/processing/response-time.js"
import { TransactionNameProcessor } from "../../src/processing/transaction-name.js"
import {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_TARGET,
} from "../../src/semattrs.old.js"

const responseTime = async () => {
  const metrics = await otel.metrics()
  const histograms = metrics
    .flatMap(({ scopeMetrics }) => scopeMetrics)
    .filter(({ scope }) => scope.name === "sw.apm.request.metrics")
    .flatMap(({ metrics }) => metrics)
    .filter(
      (
        metric,
      ): metric is HistogramMetricData | ExponentialHistogramMetricData =>
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
        processors: [
          new TransactionNameProcessor({} as SwConfiguration, diag),
          new ResponseTimeProcessor(diag),
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
          [ATTR_HTTP_REQUEST_METHOD]: "GET",
          [ATTR_HTTP_ROUTE]: "/hello/:name",
          [ATTR_URL_PATH]: "/hello/world",
        },
      },
      (span) => {
        tracer.startActiveSpan("operation", (span) => {
          span.end()
        })

        span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, 200)
        span.end()
      },
    )

    const { value, attributes } = await responseTime()
    expect(attributes).to.deep.equal({
      "sw.is_error": false,
      "sw.transaction": "/hello/:name",
      [ATTR_HTTP_REQUEST_METHOD]: "GET",
      [ATTR_HTTP_RESPONSE_STATUS_CODE]: 200,
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
          [ATTR_HTTP_METHOD]: "GET",
          [ATTR_HTTP_ROUTE]: "/hello/:name",
          [ATTR_HTTP_TARGET]: "/hello/world",
        },
      },
      (span) => {
        tracer.startActiveSpan("operation", (span) => {
          span.end()
        })

        span.setAttribute(ATTR_HTTP_STATUS_CODE, 200)
        span.end()
      },
    )

    const { value, attributes } = await responseTime()
    expect(attributes).to.deep.equal({
      "sw.is_error": false,
      "sw.transaction": "/hello/:name",
      [ATTR_HTTP_METHOD]: "GET",
      [ATTR_HTTP_STATUS_CODE]: 200,
    })
    expect(value).to.be.greaterThan(0)
  })

  it("records response time for other spans", async () => {
    trace.getTracer("test").startActiveSpan(
      "GET /foo/bar",
      {
        kind: SpanKind.CLIENT,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: "GET",
        },
      },
      (span) => {
        span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, 404)
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
