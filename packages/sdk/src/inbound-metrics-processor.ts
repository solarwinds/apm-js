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

import { SpanKind, SpanStatusCode } from "@opentelemetry/api"
import { hrTimeToMicroseconds } from "@opentelemetry/core"
import {
  NoopSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base"
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_STATUS_CODE,
  SEMATTRS_HTTP_URL,
} from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"

import { cache } from "./cache"
import { isEntrySpan } from "./context"

export class SwInboundMetricsSpanProcessor extends NoopSpanProcessor {
  override onEnd(span: ReadableSpan): void {
    if (!isEntrySpan(span)) return

    const {
      isHttp,
      transaction: defaultTransaction,
      method,
      status,
      url,
    } = SwInboundMetricsSpanProcessor.httpSpanMeta(span)
    const hasError = span.status.code === SpanStatusCode.ERROR
    const duration = hrTimeToMicroseconds(span.duration)
    // TODO
    const domain = null

    const spanCache = cache.getOrInit(span.spanContext())
    const transaction = spanCache.txnameCustom ?? defaultTransaction

    let txname: string
    if (isHttp) {
      txname = oboe.Span.createHttpSpan({
        transaction,
        duration,
        method,
        status,
        url,
        domain,
        has_error: hasError ? 1 : 0,
      })
    } else {
      txname = oboe.Span.createSpan({
        transaction,
        duration,
        domain,
        has_error: hasError ? 1 : 0,
      })
    }
    spanCache.txname = txname
  }

  private static httpSpanMeta(span: ReadableSpan):
    | {
        isHttp: true
        transaction: string
        method: string
        status: number
        url: string
      }
    | {
        isHttp: false
        transaction: string
        method: undefined
        status: undefined
        url: undefined
      } {
    if (
      span.kind !== SpanKind.SERVER ||
      !(SEMATTRS_HTTP_METHOD in span.attributes)
    ) {
      return {
        isHttp: false,
        transaction: span.name,
        method: undefined,
        status: undefined,
        url: undefined,
      }
    }

    const method = String(span.attributes[SEMATTRS_HTTP_METHOD])
    const status = Number(span.attributes[SEMATTRS_HTTP_STATUS_CODE] ?? 0)
    const url = String(span.attributes[SEMATTRS_HTTP_URL])

    let transaction = span.attributes[SEMATTRS_HTTP_ROUTE]
    if (typeof transaction !== "string") {
      try {
        const parsedUrl = new URL(url)
        transaction = parsedUrl.pathname
      } catch {
        transaction = span.name
      }
    }

    return {
      isHttp: true,
      transaction,
      method,
      status,
      url,
    }
  }
}
