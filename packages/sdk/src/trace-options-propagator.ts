import {
  type Context,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
} from "@opentelemetry/api"

import { setTraceOptions, type TraceOptions } from "./context"
import { firstIfArray } from "./util"

const TRACE_OPTIONS_HEADER = "x-trace-options"
const TRACE_OPTIONS_SIGNATURE_HEADER = "x-trace-options-signature"

const TRIGGER_TRACE_KEY = "trigger-trace"
const TIMESTAMP_KEY = "ts"
const SW_KEYS_KEY = "sw-keys"

export class SwoTraceOptionsPropagator implements TextMapPropagator<unknown> {
  inject(
    _context: Context,
    _carrier: unknown,
    _setter: TextMapSetter<unknown>,
  ): void {
    // TODO
  }

  extract(
    context: Context,
    carrier: unknown,
    getter: TextMapGetter<unknown>,
  ): Context {
    const header = firstIfArray(getter.get(carrier, TRACE_OPTIONS_HEADER))
    const signature = firstIfArray(
      getter.get(carrier, TRACE_OPTIONS_SIGNATURE_HEADER),
    )

    if (!header) {
      return context
    }

    const traceOptions: TraceOptions = {
      header,
      signature,
      custom: {},
      ignored: [],
    }

    const kvs = header
      .split(";")
      .filter((kv) => kv.length > 0)
      .map(
        (kv) =>
          kv.split("=", 2).map((s) => s.trim()) as [string] | [string, string],
      )
    for (const [k, v] of kvs) {
      if (k === TRIGGER_TRACE_KEY) {
        if (v !== undefined) {
          // TODO: debug log invalid
          continue
        }

        traceOptions.triggerTrace = true
      } else if (k === TIMESTAMP_KEY) {
        if (v === undefined || traceOptions.timestamp !== undefined) {
          // TODO: debug log invalid
          continue
        }

        const ts = Number.parseInt(v)
        if (Number.isNaN(ts)) {
          // TODO: debug log invalid
          continue
        }

        traceOptions.timestamp = ts
      } else if (k === SW_KEYS_KEY) {
        if (v === undefined || traceOptions.swKeys !== undefined) {
          // TODO: debug log invalid
          continue
        }

        traceOptions.swKeys = v
      } else if (k.startsWith("custom-")) {
        if (v === undefined || traceOptions.custom[k] !== undefined) {
          // TODO: debug log invalid
          continue
        }

        traceOptions.custom[k] = v
      }
    }

    return setTraceOptions(context, traceOptions)
  }

  fields(): string[] {
    return [TRACE_OPTIONS_HEADER, TRACE_OPTIONS_SIGNATURE_HEADER]
  }
}
