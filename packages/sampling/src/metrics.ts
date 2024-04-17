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

import { metrics, ValueType } from "@opentelemetry/api"
import { lazy } from "@solarwinds-apm/lazy"

export const counters = lazy(() => {
  const meter = metrics.getMeter("sw.apm.sampling.metrics")

  return {
    requestCount: meter.createCounter("trace.service.request_count", {
      valueType: ValueType.INT,
    }),
    tokenBucketExhaustionCount: meter.createCounter(
      "trace.service.tokenbucket_exhaustion_count",
      { valueType: ValueType.INT },
    ),
    traceCount: meter.createCounter("trace.service.tracecount", {
      valueType: ValueType.INT,
    }),
    sampleCount: meter.createCounter("trace.service.samplecount", {
      valueType: ValueType.INT,
    }),
    throughTraceCount: meter.createCounter(
      "trace.service.through_trace_count",
      { valueType: ValueType.INT },
    ),
    triggeredTraceCount: meter.createCounter(
      "trace.service.triggered_trace_count",
      { valueType: ValueType.INT },
    ),
  }
})
