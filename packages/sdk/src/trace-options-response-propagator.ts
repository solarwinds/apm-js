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

export class SwTraceOptionsResponsePropagator
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
