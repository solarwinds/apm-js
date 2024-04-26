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
  SpanKind,
  SpanStatusCode,
  ValueType,
} from "@opentelemetry/api"
import { hrTimeToMilliseconds } from "@opentelemetry/core"
import {
  NoopSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_STATUS_CODE,
} from "@opentelemetry/semantic-conventions"
import { lazy } from "@solarwinds-apm/lazy"

import { isRootOrEntry } from "./parent-span.js"
import { TRANSACTION_NAME_ATTRIBUTE } from "./transaction-name.js"

const RESPONSE_TIME = lazy(() =>
  metrics
    .getMeter("sw.apm.request.metrics")
    .createHistogram("trace.service.response_time", {
      valueType: ValueType.DOUBLE,
      unit: "ms",
    }),
)

/**
 * Processor that records response time metrics
 *
 * This should be registered after the transaction name processor
 * as it depends on the final transaction name being set on the span
 * for the recorded metrics to be correlated with it.
 */
export class ResponseTimeProcessor
  extends NoopSpanProcessor
  implements SpanProcessor
{
  override onEnd(span: ReadableSpan): void {
    if (!isRootOrEntry(span)) {
      return
    }

    const time = hrTimeToMilliseconds(span.duration)
    const attributes: Attributes = {
      "sw.is_error": span.status.code === SpanStatusCode.ERROR,
    }

    const copy = [TRANSACTION_NAME_ATTRIBUTE]
    if (span.kind === SpanKind.SERVER) {
      copy.push(SEMATTRS_HTTP_METHOD, SEMATTRS_HTTP_STATUS_CODE)
    }
    for (const a of copy) {
      if (a in span.attributes) {
        attributes[a] = span.attributes[a]
      }
    }

    RESPONSE_TIME.record(time, attributes)
  }
}
