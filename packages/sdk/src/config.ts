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

import { type DiagLogLevel } from "@opentelemetry/api"

export interface SwoConfiguration {
  token: string
  serviceName: string
  enabled: boolean
  collector?: string
  certificate?: string
  proxy?: string
  metricFormat?: number
  oboeLogLevel: number
  otelLogLevel: DiagLogLevel
  triggerTraceEnabled: boolean
  runtimeMetrics: boolean
  tracingMode?: boolean
  insertTraceContextIntoLogs: boolean
  insertTraceContextIntoQueries: boolean
  transactionSettings?: TransactionSetting[]
}

export interface TransactionSetting {
  tracing: boolean
  matcher: (identifier: string) => boolean
}
