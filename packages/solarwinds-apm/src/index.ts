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

import { context } from "@opentelemetry/api"
import * as sdk from "@solarwinds-apm/sdk"

import { init } from "./init"

try {
  init()
} catch (err) {
  console.warn(err)
}

export function setTransactionName(name: string): boolean {
  return sdk.setTransactionName(context.active(), name)
}
export function waitUntilAgentReady(timeout: number): number {
  return sdk.waitUntilAgentReady(timeout)
}

export { type ConfigFile } from "./config"