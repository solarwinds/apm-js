/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import {
	type Context,
	createTraceState,
	type SpanContext,
	type TextMapSetter,
	trace,
} from "@opentelemetry/api"
import { W3CTraceContextPropagator } from "@opentelemetry/core"

import { componentLogger } from "../shared/logger.ts"

const TRACE_STATE_KEY = "tracestate"

export function swValue(context: SpanContext): string {
	return `${context.spanId}-${context.traceFlags.toString(16).padStart(2, "0")}`
}

export class TraceContextPropagator extends W3CTraceContextPropagator {
	readonly #logger = componentLogger(TraceContextPropagator)

	override inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
		try {
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
		} catch (error) {
			this.#logger.error("failed to inject trace context", error)
		}
	}
}
