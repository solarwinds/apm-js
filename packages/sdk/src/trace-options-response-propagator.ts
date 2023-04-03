import {
  type Context,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
  trace,
} from "@opentelemetry/api"

import {
  COMMA_W3C,
  EQUALS_W3C,
  traceParent,
  TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
} from "./context"

const TRACE_PARENT_HEADER = "x-trace"
const TRACE_OPTIONS_REPONSE_HEADER = "x-trace-options-response"
const EXPOSE_HEADERS_HEADER = "Access-Control-Expose-Headers"

export class SwoTraceOptionsResponsePropagator
  implements TextMapPropagator<unknown>
{
  inject(
    context: Context,
    carrier: unknown,
    setter: TextMapSetter<unknown>,
  ): void {
    const spanContext = trace.getSpanContext(context)
    if (!spanContext || !trace.isSpanContextValid(spanContext)) {
      return
    }

    const exposedHeaders = []

    setter.set(carrier, TRACE_PARENT_HEADER, traceParent(spanContext))
    exposedHeaders.push(TRACE_PARENT_HEADER)

    const w3cTraceOptionsResponse = spanContext.traceState?.get(
      TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
    )
    if (w3cTraceOptionsResponse) {
      const traceOptionsResponse = w3cTraceOptionsResponse
        .replaceAll(EQUALS_W3C, "=")
        .replaceAll(COMMA_W3C, ",")

      setter.set(carrier, TRACE_OPTIONS_REPONSE_HEADER, traceOptionsResponse)
      exposedHeaders.push(TRACE_OPTIONS_REPONSE_HEADER)
    }

    setter.set(carrier, EXPOSE_HEADERS_HEADER, exposedHeaders.join(", "))
  }

  fields(): string[] {
    return [
      TRACE_PARENT_HEADER,
      TRACE_OPTIONS_REPONSE_HEADER,
      EXPOSE_HEADERS_HEADER,
    ]
  }

  extract(
    context: Context,
    _carrier: unknown,
    _getter: TextMapGetter<unknown>,
  ): Context {
    return context
  }
}
