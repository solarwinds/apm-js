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

import { IS_SERVERLESS } from "@solarwinds-apm/module"
import { register } from "module"

import { init } from "./init.js"
import { global } from "./storage.js"

if (!IS_SERVERLESS) {
  await import("./commonjs/version.js")
}

const first = Symbol()
if (global("init", () => first) === first) {
  try {
    register("./hooks.js", import.meta.url)
    await init()
  } catch (error) {
    console.error(error)
  }
}

export * from "./api.js"
