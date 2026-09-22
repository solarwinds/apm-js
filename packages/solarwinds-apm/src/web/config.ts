/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type Instrumentation } from "@opentelemetry/instrumentation"
import { type InstrumentationConfigMap } from "@solarwinds-apm/instrumentations/web"
import * as v from "valibot"

import { env, schema as sharedSchema } from "../shared/config.ts"

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
