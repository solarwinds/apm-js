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

import { type PinoInstrumentationConfig } from "@opentelemetry/instrumentation-pino"

import { RESOURCE_SERVICE_NAME, type Patch } from "."

export const patch: Patch<PinoInstrumentationConfig> = (config, options) => ({
  ...config,
  enabled: config.enabled ?? options.insertTraceContextIntoLogs,
  logHook: (span, record, level) => {
    record[RESOURCE_SERVICE_NAME] = options.serviceName
    config.logHook?.(span, record, level)
  },
})
