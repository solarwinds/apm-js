/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

import { type Instrumentation } from "@opentelemetry/instrumentation"

import { ConfigPatcher } from "../config-patcher"
import { type SwoTraceOptionsResponsePropagator } from "../trace-options-response-propagator"
import * as http from "./http"

export interface Options {
  traceOptionsResponsePropagator: SwoTraceOptionsResponsePropagator
}

export function patch(instrumentations: Instrumentation[], options: Options) {
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
