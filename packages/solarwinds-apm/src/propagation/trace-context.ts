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
  createTraceState,
  type SpanContext,
  type TextMapSetter,
  trace,
} from "@opentelemetry/api"
import { W3CTraceContextPropagator } from "@opentelemetry/core"

const TRACE_STATE_KEY = "tracestate"

export function swValue(context: SpanContext): string {
  return `${context.spanId}-${context.traceFlags.toString(16).padStart(2, "0")}`
}

export class TraceContextPropagator extends W3CTraceContextPropagator {
  override inject(
    context: Context,
    carrier: unknown,
    setter: TextMapSetter,
  ): void {
    super.inject(context, carrier, {
      set: (carrier, key, value) => {
        if (key !== TRACE_STATE_KEY) {
          setter.set(carrier, key, value)
        }
      },
    })

    const span = trace.getSpanContext(context)
    if (span) {
      const traceState = (span.traceState ?? createTraceState())
        .set("sw", swValue(span))
        .serialize()
      setter.set(carrier, TRACE_STATE_KEY, traceState)
    }
  }
}
