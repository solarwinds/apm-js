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

  /**
   * Every instrumentation config patch should live in its own file in this directory.
   *
   * It should export a single `patch(patcher: ConfigPatcher, options: Options): void` function
   * which calls `patcher.patch` and will itself be called here.
   *
   * Patches will usually follow the same format of conditionally importing the constructor
   * of the instrumentation they patch and return early if the package is not installed
   * as every instrumentation is optional.
   */
  http.patch(patcher, options)

  patcher.apply(instrumentations)
}
