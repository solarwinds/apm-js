/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import base from "@solarwinds-apm/configs/oxlint"
import { defineConfig } from "oxlint"

export default defineConfig({
	extends: [base],
	ignorePatterns: ["test/configs/*"],
})
