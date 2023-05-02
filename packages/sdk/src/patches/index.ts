import { type SwoConfiguration } from "../config"
import { ConfigPatcher } from "../config-patcher"
import { type SwoTraceOptionsResponsePropagator } from "../trace-options-response-propagator"
import * as http from "./http"

export interface Options {
  traceOptionsResponsePropagator: SwoTraceOptionsResponsePropagator
}

export function patch(
  instrumentations: SwoConfiguration["instrumentations"],
  options: Options,
) {
  const patcher = new ConfigPatcher()
  http.patch(patcher, options)
  patcher.apply(instrumentations)
}
