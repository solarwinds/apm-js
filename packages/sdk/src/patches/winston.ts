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

import { type WinstonInstrumentationConfig } from "@opentelemetry/instrumentation-winston"

import { type Patch, RESOURCE_SERVICE_NAME } from "."

export const patch: Patch<WinstonInstrumentationConfig> = (
  config,
  options,
) => ({
  ...config,
  enabled: config.enabled ?? options.insertTraceContextIntoLogs,
  logHook: (span, record) => {
    record[RESOURCE_SERVICE_NAME] = options.serviceName
    config.logHook?.(span, record)
  },
  disableLogSending: config.disableLogSending ?? true,
})
