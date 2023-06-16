import { inspect } from "node:util"

import {
  type AttributeValue,
  type DiagLogger,
  type SpanContext,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api"
import {
  type ExportResult,
  ExportResultCode,
  hrTimeToMicroseconds,
} from "@opentelemetry/core"
import {
  type ReadableSpan,
  type SpanExporter,
  type TimedEvent,
} from "@opentelemetry/sdk-trace-base"
import { SemanticAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@swotel/bindings"

import { cache } from "./cache"
import { parentSpanContext, traceParent } from "./context"
import { OboeError } from "./error"

export class SwoExporter implements SpanExporter {
  private error: Error | undefined = undefined
  constructor(
    private readonly reporter: oboe.Reporter,
    private readonly logger: DiagLogger,
  ) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ) {
    for (const span of spans) {
      const context = span.spanContext()
      const parentContext = parentSpanContext(span)

      let evt: oboe.Event
      const md = SwoExporter.metadata(context)
      if (parentContext && trace.isSpanContextValid(parentContext)) {
        const parentMd = SwoExporter.metadata(parentContext)
        evt = oboe.Context.createEntry(
          md,
          hrTimeToMicroseconds(span.startTime),
          parentMd,
        )

        if (parentContext.isRemote) {
          SwoExporter.addTxname(context, evt)
        }
      } else {
        evt = oboe.Context.createEntry(md, hrTimeToMicroseconds(span.startTime))
        SwoExporter.addTxname(context, evt)
      }

      const kind = SpanKind[span.kind]
      const layer = `${kind}:${span.name}`

      evt.addInfo("Layer", layer)
      evt.addInfo("sw.span_name", span.name)
      evt.addInfo("sw.span_kind", kind)
      evt.addInfo("Language", "Node.js")

      evt.addInfo("otel.scope.name", span.instrumentationLibrary.name)
      evt.addInfo(
        "otel.scope.version",
        span.instrumentationLibrary.version ?? null,
      )
      if (span.status.code !== SpanStatusCode.UNSET) {
        evt.addInfo("otel.status_code", SpanStatusCode[span.status.code])
      }
      if (span.status.message) {
        evt.addInfo("otel.status_description", span.status.message)
      }
      if (span.droppedAttributesCount > 0) {
        evt.addInfo(
          "otel.dropped_attributes_count",
          span.droppedAttributesCount,
        )
      }
      if (span.droppedEventsCount > 0) {
        evt.addInfo("otel.dropped_events_count", span.droppedEventsCount)
      }
      if (span.droppedLinksCount > 0) {
        evt.addInfo("otel.dropped_links_count", span.droppedLinksCount)
      }

      for (const [key, value] of Object.entries(span.attributes)) {
        evt.addInfo(key, SwoExporter.attributeValue(value))
      }

      this.sendReport(evt)

      for (const event of span.events) {
        if (event.name === "exception") {
          this.reportErrorEvent(event)
        } else {
          this.reportInfoEvent(event)
        }
      }

      evt = oboe.Context.createExit(hrTimeToMicroseconds(span.endTime))
      evt.addInfo("Layer", layer)
      this.sendReport(evt)

      cache.clear(context)
    }

    const result: ExportResult = this.error
      ? { code: ExportResultCode.FAILED, error: this.error }
      : { code: ExportResultCode.SUCCESS }
    this.error = undefined
    resultCallback(result)
  }

  shutdown(): Promise<void> {
    return Promise.resolve(oboe.Context.shutdown())
  }

  private static metadata(span: SpanContext): oboe.Metadata {
    const traceparent = traceParent(span)
    return oboe.Metadata.fromString(traceparent)
  }

  private static addTxname(ctx: SpanContext, evt: oboe.Event) {
    const txname = cache.get(ctx)?.txname
    if (!txname) {
      return
    }

    evt.addInfo("TransactionName", txname)
  }

  private reportErrorEvent(event: TimedEvent) {
    const evt = oboe.Context.createEvent(hrTimeToMicroseconds(event.time))
    evt.addInfo("Label", "error")
    evt.addInfo("Spec", "error")

    evt.addInfo(
      "ErrorClass",
      SwoExporter.attributeValue(
        event.attributes?.[SemanticAttributes.EXCEPTION_TYPE],
      ),
    )
    evt.addInfo(
      "ErrorMsg",
      SwoExporter.attributeValue(
        event.attributes?.[SemanticAttributes.EXCEPTION_MESSAGE],
      ),
    )
    evt.addInfo(
      "Backtrace",
      SwoExporter.attributeValue(
        event.attributes?.[SemanticAttributes.EXCEPTION_STACKTRACE],
      ),
    )

    const attributes = Object.entries(event.attributes ?? {}).filter(
      ([key]) =>
        ![
          SemanticAttributes.EXCEPTION_TYPE,
          SemanticAttributes.EXCEPTION_MESSAGE,
          SemanticAttributes.EXCEPTION_STACKTRACE,
        ].includes(key),
    )
    for (const [key, value] of attributes) {
      evt.addInfo(key, SwoExporter.attributeValue(value))
    }

    this.sendReport(evt)
  }

  private reportInfoEvent(event: TimedEvent) {
    const evt = oboe.Context.createEvent(hrTimeToMicroseconds(event.time))
    evt.addInfo("Label", "info")
    for (const [key, value] of Object.entries(event.attributes ?? {})) {
      evt.addInfo(key, SwoExporter.attributeValue(value))
    }
    this.sendReport(evt)
  }

  private sendReport(evt: oboe.Event): void {
    const status = this.reporter.sendReport(evt, false)
    if (status < 0) {
      this.error = new OboeError("Reporter", "sendReport", status)
      this.logger.warn("error sending report", this.error)
      this.logger.debug(evt.metadataString())
    }
  }

  private static attributeValue(
    v: AttributeValue | undefined,
  ): string | number | boolean | null {
    if (Array.isArray(v)) {
      return inspect(v, { breakLength: Infinity, compact: true })
    } else {
      return v ?? null
    }
  }
}
