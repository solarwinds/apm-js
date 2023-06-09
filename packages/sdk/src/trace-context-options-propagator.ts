import {
  type Context,
  createTraceState,
  type DiagLogger,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
  trace,
} from "@opentelemetry/api"
import { W3CTraceContextPropagator } from "@opentelemetry/core"

import {
  setTraceOptions,
  swValue,
  type TraceOptions,
  TRACESTATE_SW_KEY,
  TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY,
} from "./context"
import { firstIfArray } from "./util"

const TRACESTATE_HEADER = "tracestate"
const TRACE_OPTIONS_HEADER = "x-trace-options"
const TRACE_OPTIONS_SIGNATURE_HEADER = "x-trace-options-signature"

const TRIGGER_TRACE_KEY = "trigger-trace"
const TIMESTAMP_KEY = "ts"
const SW_KEYS_KEY = "sw-keys"

const CUSTOM_KEY_REGEX = /^custom-[^\s]+$/

export class SwoTraceContextOptionsPropagator
  extends W3CTraceContextPropagator
  implements TextMapPropagator<unknown>
{
  constructor(private readonly logger: DiagLogger) {
    super()
  }

  inject(
    context: Context,
    carrier: unknown,
    setter: TextMapSetter<unknown>,
  ): void {
    const tempCarrier: Record<string, string | string[]> = {}
    const tempGetterSetter: TextMapGetter<typeof tempCarrier> &
      TextMapSetter<typeof tempCarrier> = {
      get: (carrier, key) => carrier[key.toLowerCase()],
      set: (carrier, key, value) => (carrier[key.toLowerCase()] = value),
      keys: (carrier) => Object.keys(carrier),
    }
    super.inject(context, tempCarrier, tempGetterSetter)

    for (const key of tempGetterSetter.keys(tempCarrier)) {
      setter.set(
        carrier,
        key,
        firstIfArray(tempGetterSetter.get(tempCarrier, key))!,
      )
    }

    const spanContext = trace.getSpanContext(context)
    if (!spanContext || !trace.isSpanContextValid(spanContext)) {
      return
    }

    const tracestateHeader = firstIfArray(
      tempGetterSetter.get(tempCarrier, TRACESTATE_HEADER),
    )
    const sw = swValue(spanContext)
    let traceState = tracestateHeader
      ? createTraceState(tracestateHeader)
      : createTraceState()

    traceState = traceState.set(TRACESTATE_SW_KEY, sw)
    traceState = traceState.unset(TRACESTATE_TRACE_OPTIONS_RESPONSE_KEY)

    setter.set(carrier, TRACESTATE_HEADER, traceState.serialize())
  }

  extract(
    context: Context,
    carrier: unknown,
    getter: TextMapGetter<unknown>,
  ): Context {
    context = super.extract(context, carrier, getter)

    const header = firstIfArray(getter.get(carrier, TRACE_OPTIONS_HEADER))
    const signature = firstIfArray(
      getter.get(carrier, TRACE_OPTIONS_SIGNATURE_HEADER),
    )

    if (!header) {
      return context
    }

    return setTraceOptions(context, this.parseTraceOptions(header, signature))
  }

  private parseTraceOptions(header: string, signature?: string): TraceOptions {
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
      .filter(([k]) => k.length > 0)
    for (const [k, v] of kvs) {
      if (k === TRIGGER_TRACE_KEY) {
        if (v !== undefined) {
          this.logger.debug(
            "invalid trace option for trigger trace, should not have a value",
          )
          continue
        }

        traceOptions.triggerTrace = true
      } else if (k === TIMESTAMP_KEY) {
        if (v === undefined || traceOptions.timestamp !== undefined) {
          this.logger.debug(
            "invalid trace option for timestamp, should have a value and only be provided once",
          )
          continue
        }

        const ts = Number.parseInt(v)
        if (Number.isNaN(ts)) {
          this.logger.debug(
            "invalid trace option for timestamp, should be an integer",
          )
          continue
        }

        traceOptions.timestamp = ts
      } else if (k === SW_KEYS_KEY) {
        if (v === undefined || traceOptions.swKeys !== undefined) {
          this.logger.debug(
            "invalid trace option for sw keys, should have a value and only be provided once",
          )
          continue
        }

        traceOptions.swKeys = v
      } else if (CUSTOM_KEY_REGEX.test(k) && v !== undefined) {
        if (traceOptions.custom[k] !== undefined) {
          this.logger.debug(
            `invalid trace option for custom key ${k}, should have a value and only be provided once`,
          )
          continue
        }

        traceOptions.custom[k] = v
      } else {
        traceOptions.ignored.push(v ? [k, v] : [k])
      }
    }

    return traceOptions
  }

  fields(): string[] {
    return [
      ...super.fields(),
      TRACE_OPTIONS_HEADER,
      TRACE_OPTIONS_SIGNATURE_HEADER,
    ]
  }
}
