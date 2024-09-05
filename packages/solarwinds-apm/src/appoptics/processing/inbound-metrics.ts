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

import { type DiagLogger, SpanKind, SpanStatusCode } from "@opentelemetry/api"
import { hrTimeToMicroseconds } from "@opentelemetry/core"
import {
  NoopSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
} from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"
import { type SwConfiguration } from "@solarwinds-apm/sdk"

import { isRootOrEntry } from "../../processing/parent-span.js"
import {
  computedTransactionName,
  TRANSACTION_NAME_ATTRIBUTE,
} from "../../processing/transaction-name.js"
import {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_URL,
} from "../../semattrs.old.js"

export class AppopticsInboundMetricsProcessor
  extends NoopSpanProcessor
  implements SpanProcessor
{
  readonly #defaultTransactionName?: string

  constructor(
    config: SwConfiguration,
    protected readonly logger: DiagLogger,
  ) {
    super()
    this.#defaultTransactionName = config.transactionName
  }

  override onEnd(span: ReadableSpan): void {
    if (!isRootOrEntry(span)) {
      return
    }

    const { isHttp, method, status, url } = httpSpanMetadata(span)
    const has_error = span.status.code === SpanStatusCode.ERROR ? 1 : 0
    const duration = hrTimeToMicroseconds(span.duration)

    let transaction = span.attributes[TRANSACTION_NAME_ATTRIBUTE]
    this.logger.debug("initial transaction name", transaction)
    if (typeof transaction !== "string") {
      transaction =
        this.#defaultTransactionName ?? computedTransactionName(span)
    }

    if (isHttp) {
      transaction = oboe.Span.createHttpSpan({
        transaction,
        duration,
        has_error,
        method,
        status,
        url,
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
    this.logger.debug("final transaction name", transaction)

    span.attributes[TRANSACTION_NAME_ATTRIBUTE] = transaction
  }
}

export function httpSpanMetadata(span: ReadableSpan) {
  if (
    span.kind !== SpanKind.SERVER ||
    !(
      ATTR_HTTP_REQUEST_METHOD in span.attributes ||
      ATTR_HTTP_METHOD in span.attributes
    )
  ) {
    return { isHttp: false } as const
  }

  const method = String(
    span.attributes[ATTR_HTTP_REQUEST_METHOD] ??
      span.attributes[ATTR_HTTP_METHOD],
  )
  const status = Number(
    span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE] ??
      span.attributes[ATTR_HTTP_STATUS_CODE] ??
      0,
  )
  const url = String(
    span.attributes[ATTR_URL_FULL] ?? span.attributes[ATTR_HTTP_URL],
  )

  return {
    isHttp: true,
    method,
    status,
    url,
  } as const
}
