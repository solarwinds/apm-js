/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import "dotenv/config"

import { execSync } from "node:child_process"
import { parseArgs } from "node:util"

const { values } = parseArgs({
	options: {
		collector: { type: "boolean", default: true },
		proxy: { type: "boolean", default: true },
		postgres: { type: "boolean", default: false },
		mysql: { type: "boolean", default: false },
	},
	allowNegative: true,
})

const containers = Object.entries(values)
	.map(([name, enabled]) => enabled && name)
	.filter(Boolean)
	.join(" ")

execSync(`docker compose -f docker/docker-compose.yml logs -f ${containers}`, {
	stdio: "inherit",
})
