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

import { SpanStatusCode } from "@opentelemetry/api"
import { hrTimeToMicroseconds } from "@opentelemetry/core"
import {
  NoopSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { oboe } from "@solarwinds-apm/bindings"

import { type Configuration } from "../../config.js"
import { isRootOrEntry } from "../../processing/parent-span.js"
import {
  computedTransactionName,
  TRANSACTION_NAME_ATTRIBUTE,
} from "../../processing/transaction-name.js"
import { httpSpanMetadata } from "../../sampling/sampler.js"
import { componentLogger } from "../../shared/logger.js"

export class AppopticsInboundMetricsProcessor
  extends NoopSpanProcessor
  implements SpanProcessor
{
  readonly #logger = componentLogger(AppopticsInboundMetricsProcessor)
  readonly #defaultTransactionName?: () => string

  constructor(config: Configuration) {
    super()
    this.#defaultTransactionName = config.transactionName
  }

  override onEnd(span: ReadableSpan): void {
    if (!isRootOrEntry(span)) {
      return
    }

    const meta = httpSpanMetadata(span.kind, span.attributes)
    const has_error = span.status.code === SpanStatusCode.ERROR ? 1 : 0
    const duration = hrTimeToMicroseconds(span.duration)

    let transaction = span.attributes[TRANSACTION_NAME_ATTRIBUTE]
    this.#logger.debug("initial transaction name", transaction)
    if (typeof transaction !== "string") {
      transaction =
        this.#defaultTransactionName?.() ?? computedTransactionName(span)
    }

    if (meta.http) {
      transaction = oboe.Span.createHttpSpan({
        transaction,
        duration,
        has_error,
        method: meta.method,
        status: meta.status,
        url: meta.url,
        domain: null,
      })
    } else {
      transaction = oboe.Span.createSpan({
        transaction,
        duration,
        has_error,
        domain: null,
      })
    }
    this.#logger.debug("final transaction name", transaction)

    span.attributes[TRANSACTION_NAME_ATTRIBUTE] = transaction
  }
}
