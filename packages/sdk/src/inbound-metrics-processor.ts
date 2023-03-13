import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api"
import { hrTimeToMicroseconds } from "@opentelemetry/core"
import {
  NoopSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base"
import { SemanticAttributes } from "@opentelemetry/semantic-conventions"
import * as oboe from "@swotel/bindings"

import { cache } from "./cache"
import { parentSpanContext } from "./context"

export class SwoInboundMetricsSpanProcessor extends NoopSpanProcessor {
  onEnd(span: ReadableSpan): void {
    const context = span.spanContext()
    const parentContext = parentSpanContext(span)

    if (
      parentContext &&
      trace.isSpanContextValid(parentContext) &&
      !parentContext.isRemote
    ) {
      return
    }

    const { isHttp, transaction, method, status, url } =
      SwoInboundMetricsSpanProcessor.httpSpanMeta(span)
    const hasError = span.status.code === SpanStatusCode.ERROR
    const duration = hrTimeToMicroseconds(span.duration)
    // TODO
    const domain = null

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
    cache.setTxname(context, txname)
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
      !(SemanticAttributes.HTTP_METHOD in span.attributes)
    ) {
      return {
        isHttp: false,
        transaction: span.name,
        method: undefined,
        status: undefined,
        url: undefined,
      }
    }

    const method = String(span.attributes[SemanticAttributes.HTTP_METHOD])
    const status = Number(
      span.attributes[SemanticAttributes.HTTP_STATUS_CODE] ?? 0,
    )
    const url = String(span.attributes[SemanticAttributes.HTTP_URL])

    let transaction = span.attributes[SemanticAttributes.HTTP_ROUTE]
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
