/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { type InstrumentationBase } from "@opentelemetry/instrumentation"
import base from "@solarwinds-apm/configs/tsdown"
import { defineConfig } from "tsdown"

import { getInstrumentations } from "./src/index.ts"

const instrumentations = getInstrumentations({}, "all") as InstrumentationBase[]
const deps = new Set(
	instrumentations.flatMap((i) => i.getModuleDefinitions()).map((d) => d.name),
)

export default defineConfig({
	...base,
	entry: ["./src/index.ts", "./src/web/index.ts"],
	deps: {
		dts: {
			neverBundle: [
				"@types/*",
				"fastify",
				"@fastify/*",
				...deps,
				...(base.deps!.neverBundle as string[]),
			],
		},
	},
})
