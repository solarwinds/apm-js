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

import { api } from "./init.js"

/**
 * Wait until the library is ready to sample traces
 *
 * Note that when exporting to AppOptics this function will block the event loop.
 *
 * @param timeout - Wait timeout in milliseconds
 * @returns Whether the library is ready
 */
export async function waitUntilReady(timeout: number): Promise<boolean> {
  return api.waitUntilReady(timeout)
}

export { type Config } from "./config.js"
export { setTransactionName } from "./processing/transaction-name.js"
export { VERSION } from "./version.js"
