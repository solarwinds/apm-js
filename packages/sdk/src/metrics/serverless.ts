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
  type Attributes,
  metrics,
  SpanStatusCode,
  ValueType,
} from "@opentelemetry/api"
import { hrTimeToMilliseconds } from "@opentelemetry/core"
import { Aggregation, View } from "@opentelemetry/sdk-metrics"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { SemanticAttributes } from "@opentelemetry/semantic-conventions"
import { type oboe } from "@solarwinds-apm/bindings"
import { lazy } from "@solarwinds-apm/lazy"

const samplingMeter = lazy(() => metrics.getMeter("sw.apm.sampling.metrics"))
const requestMeter = lazy(() => metrics.getMeter("sw.apm.request.metrics"))

const counters = {
  RequestCount: lazy(() =>
    samplingMeter.createCounter("trace.service.request_count", {
      valueType: ValueType.INT,
    }),
  ),
  TokenBucketExhaustionCount: lazy(() =>
    samplingMeter.createCounter("trace.service.tokenbucket_exhaustion_count", {
      valueType: ValueType.INT,
    }),
  ),
  TraceCount: lazy(() =>
    samplingMeter.createCounter("trace.service.tracecount", {
      valueType: ValueType.INT,
    }),
  ),
  SampleCount: lazy(() =>
    samplingMeter.createCounter("trace.service.samplecount", {
      valueType: ValueType.INT,
    }),
  ),
  ThroughTraceCount: lazy(() =>
    samplingMeter.createCounter("trace.service.through_trace_count", {
      valueType: ValueType.INT,
    }),
  ),
  TriggeredTraceCount: lazy(() =>
    samplingMeter.createCounter("trace.service.triggered_trace_count", {
      valueType: ValueType.INT,
    }),
  ),
}

const responseTime = lazy(() =>
  requestMeter.createHistogram("trace.service.response_time", {
    valueType: ValueType.DOUBLE,
    unit: "ms",
  }),
)

export function recordServerlessCounters(serverlessApi: oboe.OboeAPI) {
  for (const [name, counter] of Object.entries(counters)) {
    const method = `consume${name}` as const
    const value = serverlessApi[method]()
    if (value !== false) counter.add(value)
  }
}

export function recordServerlessResponseTime(
  span: ReadableSpan,
  transaction: string | undefined,
) {
  const method = span.attributes[SemanticAttributes.HTTP_METHOD]
  const statusCode = span.attributes[SemanticAttributes.HTTP_STATUS_CODE]
  const isError = span.status.code === SpanStatusCode.ERROR

  const time = hrTimeToMilliseconds(span.duration)

  const attrs: Attributes = {
    "sw.transaction": transaction ?? "unknown",
    "sw.is_error": isError,
  }
  if (method) {
    attrs[SemanticAttributes.HTTP_METHOD] = method
  }
  if (statusCode) {
    attrs[SemanticAttributes.HTTP_STATUS_CODE] = statusCode
  }

  responseTime.record(time, attrs)
}

export const serverlessViews = [
  new View({
    meterName: "sw.apm.request.metrics",
    instrumentName: "trace.service.response_time",
    aggregation: Aggregation.Histogram(),
  }),
]
