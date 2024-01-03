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

import { isMainThread } from "node:worker_threads"

// init in here too so that everything can be done through a single --loader flag
if (isMainThread) {
  try {
    const { init } = await import("./init.js")
    await init()
  } catch (err) {
    console.warn(err)
  }
}

export * from "@opentelemetry/instrumentation/hook.mjs"
