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

import { load as otel } from "@opentelemetry/instrumentation/hook.mjs"
import { load as iitm } from "import-in-the-middle/hook.mjs"

if (otel !== iitm) {
  import("./commonjs/log.js").then(({ default: log }) =>
    log(
      "Duplicate versions of import-in-the-middle were detected.",
      "The application may not be instrumented.",
      "Please run 'npm update import-in-the-middle',",
      "or the equivalent for your package manager.",
    ),
  )
}

export * from "import-in-the-middle/hook.mjs"
