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

import { type ServerResponse } from "node:http"

import { ROOT_CONTEXT, trace } from "@opentelemetry/api"
import { type HttpInstrumentationConfig } from "@opentelemetry/instrumentation-http"

import { type Patch } from "."

export const patch: Patch<HttpInstrumentationConfig> = (config, options) => ({
  ...config,
  responseHook: (span, response) => {
    // only for server responses originating from the instrumented app
    if ("setHeader" in response) {
      const context = trace.setSpan(ROOT_CONTEXT, span)
      options.responsePropagator.inject(context, response, {
        set: (res, k, v) => (res as ServerResponse).setHeader(k, v),
      })
    }

    config.responseHook?.(span, response)
  },
})
