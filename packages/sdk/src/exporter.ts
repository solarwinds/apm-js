/*
Copyright 2023 SolarWinds Worldwide, LLC.

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
import { oboe } from "@solarwinds-apm/bindings"

import { type SwConfiguration } from "."
import { cache } from "./cache"
import { parentSpanContext, traceParent } from "./context"
import { OboeError } from "./error"

export class SwExporter implements SpanExporter {
  private error: Error | undefined = undefined
  constructor(
    private readonly config: SwConfiguration,
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
      const md = SwExporter.metadata(context)
      if (parentContext && trace.isSpanContextValid(parentContext)) {
        const parentMd = SwExporter.metadata(parentContext)
        evt = oboe.Context.createEntry(
          md,
          hrTimeToMicroseconds(span.startTime),
          parentMd,
        )
        this.addTxname(context, evt)
      } else {
        evt = oboe.Context.createEntry(md, hrTimeToMicroseconds(span.startTime))
        this.addTxname(context, evt)
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
        evt.addInfo(key, SwExporter.attributeValue(value))
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

  forceFlush(): Promise<void> {
    this.reporter.flush()
    return Promise.resolve()
  }
  async shutdown(): Promise<void> {
    await this.forceFlush()
    oboe.Context.shutdown()
  }

  private static metadata(span: SpanContext): oboe.Metadata {
    const traceparent = traceParent(span)
    return oboe.Metadata.fromString(traceparent)
  }

  private addTxname(ctx: SpanContext, evt: oboe.Event) {
    const txname = cache.getTxname(ctx, this.config)
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
      SwExporter.attributeValue(
        event.attributes?.[SemanticAttributes.EXCEPTION_TYPE],
      ),
    )
    evt.addInfo(
      "ErrorMsg",
      SwExporter.attributeValue(
        event.attributes?.[SemanticAttributes.EXCEPTION_MESSAGE],
      ),
    )
    evt.addInfo(
      "Backtrace",
      SwExporter.attributeValue(
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
      evt.addInfo(key, SwExporter.attributeValue(value))
    }

    this.sendReport(evt)
  }

  private reportInfoEvent(event: TimedEvent) {
    const evt = oboe.Context.createEvent(hrTimeToMicroseconds(event.time))
    evt.addInfo("Label", "info")
    for (const [key, value] of Object.entries(event.attributes ?? {})) {
      evt.addInfo(key, SwExporter.attributeValue(value))
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
