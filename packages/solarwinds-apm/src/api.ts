/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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
  LOGGER_PROVIDER,
  METER_PROVIDER,
  SAMPLER,
  TRACER_PROVIDER,
} from "./shared/init.js"

/**
 * Wait until the library is ready to sample traces
 *
 * Note that when exporting to AppOptics this function will block the event loop.
 *
 * @param timeout - Wait timeout in milliseconds
 * @returns Whether the library is ready
 */
export async function waitUntilReady(timeout: number): Promise<boolean> {
  const sampler = await SAMPLER
  return await sampler.waitUntilReady(timeout)
}

/**
 * Forces the library to flush any buffered traces, metrics or logs
 */
export async function forceFlush(): Promise<void> {
  const providers = await Promise.all([
    TRACER_PROVIDER,
    METER_PROVIDER,
    LOGGER_PROVIDER,
  ])
  await Promise.all(providers.map((provider) => provider?.forceFlush()))
}

export { type Config } from "./config.js"
export { setTransactionName } from "./processing/transaction-name.js"
export { VERSION } from "./version.js"
