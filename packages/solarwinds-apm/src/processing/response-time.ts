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
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
} from "@opentelemetry/semantic-conventions"

import { ATTR_HTTP_METHOD, ATTR_HTTP_STATUS_CODE } from "../semattrs.old.js"
import { componentLogger } from "../shared/logger.js"
import { isRootOrEntry } from "./parent-span.js"
import { TRANSACTION_NAME_ATTRIBUTE } from "./transaction-name.js"

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
  readonly #logger = componentLogger(ResponseTimeProcessor)
  readonly #responseTime = metrics
    .getMeter("sw.apm.request.metrics")
    .createHistogram("trace.service.response_time", {
      valueType: ValueType.DOUBLE,
      unit: "ms",
      description:
        "Duration of each entry span for the service, typically meaning the time taken to process an inbound request.",
    })

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
      copy.push(
        ATTR_HTTP_REQUEST_METHOD,
        ATTR_HTTP_RESPONSE_STATUS_CODE,
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        ATTR_HTTP_METHOD,
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        ATTR_HTTP_STATUS_CODE,
      )
    }
    for (const a of copy) {
      if (a in span.attributes) {
        attributes[a] = span.attributes[a]
      }
    }

    this.#logger.debug("recording response time", time, attributes)
    this.#responseTime.record(time, attributes)
  }
}
