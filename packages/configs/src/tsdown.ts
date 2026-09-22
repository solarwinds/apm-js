/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { defineConfig } from "tsdown"

export default defineConfig({
	target: "node22",
	sourcemap: true,
	dts: { sourcemap: true },
	minify: { mangle: { keepNames: true } },
	exports: true,
	deps: {
		neverBundle: [
			"@opentelemetry/api",
			"@opentelemetry/api-logs",
			"@opentelemetry/core",
			"import-in-the-middle",
			"require-in-the-middle",
		],
	},
})
