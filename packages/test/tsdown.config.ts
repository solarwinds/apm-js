/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import base from "@solarwinds-apm/configs/tsdown"
import { defineConfig } from "tsdown"

export default defineConfig({
	...base,
	entry: ["./src/index.ts", "./src/bin.ts"],
	exports: {
		customExports: (exports) => {
			delete exports["./bin"]
			return exports
		},
	},
})
