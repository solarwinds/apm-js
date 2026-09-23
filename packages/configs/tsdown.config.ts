/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { defineConfig } from "tsdown"

import base from "./src/tsdown.ts"

export default defineConfig({
	...base,
	entry: ["./src/oxlint.ts", "./src/tsdown.ts"],
	exports: {
		customExports: {
			"./tsconfig.json": "./tsconfig.json",
		},
	},
})
