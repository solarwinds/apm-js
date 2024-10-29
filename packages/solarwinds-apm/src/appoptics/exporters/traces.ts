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

import { inspect } from "node:util"

import {
  type AttributeValue,
  type SpanContext,
  SpanKind,
  SpanStatusCode,
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
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"

import { componentLogger } from "../../logger.js"
import { TRANSACTION_NAME_ATTRIBUTE } from "../../processing/transaction-name.js"
import { traceParent } from "../../propagation/headers.js"

export class AppopticsTraceExporter implements SpanExporter {
  readonly #logger = componentLogger(AppopticsTraceExporter)
  readonly #reporter: oboe.Reporter
  #error: Error | undefined = undefined

  constructor(reporter: oboe.Reporter) {
    this.#reporter = reporter
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ) {
    for (const span of spans) {
      const context = span.spanContext()
      const md = this.#metadata(context)

      let evt: oboe.Event
      if (span.parentSpanId) {
        evt = oboe.Context.createEntry(
          md,
          hrTimeToMicroseconds(span.startTime),
          this.#metadata({
            traceFlags: context.traceFlags,
            traceId: context.traceId,
            spanId: span.parentSpanId,
          }),
        )
      } else {
        evt = oboe.Context.createEntry(md, hrTimeToMicroseconds(span.startTime))
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

      const rename: Record<string, string> = {
        [TRANSACTION_NAME_ATTRIBUTE]: "TransactionName",
      }
      for (const [key, value] of Object.entries(span.attributes)) {
        const name = rename[key] ?? key
        evt.addInfo(name, this.#attributeValue(value))
      }

      this.#sendReport(evt)

      for (const event of span.events) {
        if (event.name === "exception") {
          this.#reportErrorEvent(event)
        } else {
          this.#reportInfoEvent(event)
        }
      }

      evt = oboe.Context.createExit(hrTimeToMicroseconds(span.endTime))
      evt.addInfo("Layer", layer)
      this.#sendReport(evt)
    }

    const result: ExportResult = this.#error
      ? { code: ExportResultCode.FAILED, error: this.#error }
      : { code: ExportResultCode.SUCCESS }
    this.#error = undefined
    resultCallback(result)
  }

  forceFlush(): Promise<void> {
    this.#reporter.flush()
    return Promise.resolve()
  }
  shutdown(): Promise<void> {
    oboe.Context.shutdown()
    return Promise.resolve()
  }

  #metadata(spanContext: SpanContext): oboe.Metadata {
    return oboe.Metadata.fromString(traceParent(spanContext))
  }

  #attributeValue(
    v: AttributeValue | undefined,
  ): string | number | boolean | null {
    if (Array.isArray(v)) {
      return inspect(v, { breakLength: Infinity, compact: true })
    } else {
      return v ?? null
    }
  }

  #reportErrorEvent(event: TimedEvent) {
    const evt = oboe.Context.createEvent(hrTimeToMicroseconds(event.time))
    evt.addInfo("Label", "error")
    evt.addInfo("Spec", "error")

    const rename: Record<string, string> = {
      [ATTR_EXCEPTION_TYPE]: "ErrorClass",
      [ATTR_EXCEPTION_MESSAGE]: "ErrorMsg",
      [ATTR_EXCEPTION_STACKTRACE]: "Backtrace",
    }
    for (const [key, value] of Object.entries(event.attributes ?? {})) {
      const name = rename[key] ?? key
      evt.addInfo(name, this.#attributeValue(value))
    }

    this.#sendReport(evt)
  }

  #reportInfoEvent(event: TimedEvent) {
    const evt = oboe.Context.createEvent(hrTimeToMicroseconds(event.time))
    evt.addInfo("Label", "info")
    for (const [key, value] of Object.entries(event.attributes ?? {})) {
      evt.addInfo(key, this.#attributeValue(value))
    }
    this.#sendReport(evt)
  }

  #sendReport(evt: oboe.Event): void {
    const status = this.#reporter.sendReport(evt, false)
    if (status < 0) {
      this.#error = new Error(
        `Reporter::sendReport returned with error status ${status}`,
      )
      this.#logger.warn("error sending report", this.#error)
      this.#logger.debug(evt.metadataString())
    }
  }
}
