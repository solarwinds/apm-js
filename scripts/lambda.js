/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { execSync } from "node:child_process"
import { cpSync, createWriteStream, readFileSync, rmSync, writeFileSync } from "node:fs"
import process from "node:process"

import { ZipArchive } from "archiver"
import ora from "ora"

const json = JSON.parse(readFileSync("packages/solarwinds-apm/package.json"))
const [name, version = json.version] = process.argv.slice(2)

const rm = (...args) => {
	try {
		rmSync(...args)
	} catch {
		// ignore
	}
}

const replace = (file) => {
	let contents = readFileSync(file, { encoding: "utf-8" })
	contents = contents.replaceAll("{{name}}", name).replaceAll("{{version}}", version)
	writeFileSync(file, contents)
}

rm("lambda/layer.zip")
rm("node_modules/.lambda", { recursive: true })
cpSync("lambda", "node_modules/.lambda", { recursive: true })
replace("node_modules/.lambda/package.json")
replace("node_modules/.lambda/shim.mjs")

execSync("pnpm install --prod", {
	cwd: "node_modules/.lambda",
	env: { ...process.env, NODE_ENV: "production" },
	stdio: "inherit",
})

const spinner = ora("building layer")

const archive = new ZipArchive({ zlib: { level: 9 } })
archive
	.on("error", (err) => {
		spinner.fail(err.message)
		throw err
	})
	.on("warning", (warn) => {
		spinner.fail(warn.message)
		throw warn
	})
	.on("entry", (e) => {
		spinner.text = e.name
		spinner.render()
	})

const out = createWriteStream("lambda/layer.zip")
out.on("error", (err) => {
	spinner.fail(err.message)
	throw err
})
archive.pipe(out)

archive.directory("node_modules/.lambda/node_modules/", "solarwinds-apm/node_modules/")
archive.file("node_modules/.lambda/shim.mjs", {
	name: "solarwinds-apm/shim.mjs",
})
archive.file("node_modules/.lambda/wrapper", {
	name: "solarwinds-apm/wrapper",
	mode: 0o755,
})

await archive.finalize()
spinner.succeed("layer built")
