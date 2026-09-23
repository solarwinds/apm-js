/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { readFile } from "node:fs/promises"

import { expect, it } from "@solarwinds-apm/test"

import { dependencies } from "../src/index.ts"

const { devDependencies } = JSON.parse(
	await readFile("package.json", { encoding: "utf-8" }),
) as { devDependencies: Record<string, string> }

const deps = await dependencies()

for (const name of Object.keys(devDependencies)) {
	it(`detects ${name}`, () => {
		expect(deps.has(name)).to.be.true
	})
}
