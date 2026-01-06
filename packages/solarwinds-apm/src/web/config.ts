/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import { type Instrumentation } from "@opentelemetry/instrumentation"
import { type InstrumentationConfigMap } from "@solarwinds-apm/instrumentations/web"
import * as v from "valibot"

import { env, schema as sharedSchema } from "../shared/config.js"

declare global {
  var SW_APM_ENABLED: Config["serviceKey"]
  var SW_APM_SERVICE_KEY: Config["serviceKey"]
  var SW_APM_COLLECTOR: Config["collector"]
  var SW_APM_LOG_LEVEL: Config["logLevel"]
  var SW_APM_TRACING_MODE: Config["tracingMode"]
  var SW_APM_EXPORT_LOGS_ENABLED: Config["exportLogsEnabled"]
  var SW_APM_INSTRUMENTATIONS: Config["instrumentations"]
}

export type Configuration = v.InferOutput<typeof schema>

export interface Config extends v.InferInput<typeof schema> {
  instrumentations?: Instrumentations
}

interface Instrumentations {
  configs?: InstrumentationConfigMap
  extra?: Instrumentation[]
}

const schema = v.intersect([
  sharedSchema({ triggerTraceEnabled: false }),

  v.pipe(
    v.object({
      instrumentations: v.optional(
        v.object({
          configs: v.optional(v.record(v.string(), v.unknown()), {}),
          extra: v.optional(v.array(v.unknown()), []),
        }),
        {},
      ),
    }),
    v.transform(({ instrumentations }) => ({
      instrumentations: instrumentations as Required<Instrumentations>,
    })),
  ),
])

export function read(): Configuration {
  return v.parse(schema, env.object(globalThis))
}
