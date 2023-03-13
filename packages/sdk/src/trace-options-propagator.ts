import {
  type Context,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
} from "@opentelemetry/api"

import { setTraceOptions } from "./context"

const TRACE_OPTIONS_HEADER = "x-trace-options"
const TRACE_OPTIONS_SIGNATURE_HEADER = "x-trace-options-signature"

export class TraceOptionsPropagator implements TextMapPropagator<unknown> {
  extract(
    context: Context,
    carrier: unknown,
    getter: TextMapGetter<unknown>,
  ): Context {
    const header = TraceOptionsPropagator.optional(
      getter.get(carrier, TRACE_OPTIONS_HEADER),
    )
    if (!header) return context

    const signature = TraceOptionsPropagator.optional(
      getter.get(carrier, TRACE_OPTIONS_SIGNATURE_HEADER),
    )

    let triggerTrace: boolean | undefined = undefined
    let timestamp: number | undefined = undefined

    for (const kv of header.split(";")) {
      const [k, v] = kv.split("=", 2).map((s) => s.trim())
      if (!k) continue

      if (k === "trigger-trace" && !v) {
        triggerTrace = true
      } else if (k === "ts" && v) {
        timestamp = Number.parseInt(v, 10)
        if (Number.isNaN(timestamp)) {
          timestamp = undefined
        }
      }
    }

    return setTraceOptions(context, {
      header,
      signature,
      triggerTrace,
      timestamp,
    })
  }

  inject(
    _context: Context,
    _carrier: unknown,
    _setter: TextMapSetter<unknown>,
  ): void {
    throw new Error("Method not implemented.")
  }

  fields(): string[] {
    throw new Error("Method not implemented.")
  }

  private static optional<T>(v: T[] | T | undefined): T | undefined {
    return Array.isArray(v) ? v[0] : v
  }
}
