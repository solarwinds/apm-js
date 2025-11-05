/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

export const counters = () => {
  const meter = metrics.getMeter("sw.apm.sampling.metrics")
  return {
    requestCount: meter.createCounter("trace.service.request_count", {
      valueType: ValueType.INT,
      unit: "{request}",
      description: "Count of all requests.",
    }),
    sampleCount: meter.createCounter("trace.service.samplecount", {
      valueType: ValueType.INT,
      unit: "{request}",
      description:
        "Count of requests that went through sampling, which excludes those with a valid upstream decision or trigger traced.",
    }),
    traceCount: meter.createCounter("trace.service.tracecount", {
      valueType: ValueType.INT,
      unit: "{trace}",
      description: "Count of all traces.",
    }),
    throughTraceCount: meter.createCounter(
      "trace.service.through_trace_count",
      {
        valueType: ValueType.INT,
        unit: "{request}",
        description:
          "Count of requests with a valid upstream decision, thus passed through sampling.",
      },
    ),
    triggeredTraceCount: meter.createCounter(
      "trace.service.triggered_trace_count",
      {
        valueType: ValueType.INT,
        unit: "{trace}",
        description: "Count of triggered traces.",
      },
    ),
    tokenBucketExhaustionCount: meter.createCounter(
      "trace.service.tokenbucket_exhaustion_count",
      {
        valueType: ValueType.INT,
        unit: "{request}",
        description:
          "Count of requests that were not traced due to token bucket rate limiting.",
      },
    ),
  }
}
