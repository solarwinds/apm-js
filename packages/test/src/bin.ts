#!/usr/bin/env node
/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"

import dotenv from "dotenv"
import globby from "globby"
import semver from "semver"

// Patterns recognised as test files by default
const DEFAULTS = [
  "*.test.js",
  "*.test.ts",
  "*.test.cjs",
  "*.test.cts",
  "*.test.mjs",
  "*.test.mts",
]

// Skip Node executable and current script path
let argv = process.argv.slice(2)
const parseFlag = (options: { short: string; long: string }) => {
  let result: string | undefined = undefined

  const short = `-${options.short}`
  const long = `--${options.long}`
  const longEq = `--${options.long}=`

  const flagIndex = argv.findIndex(
    (a) => a === long || a.startsWith(longEq) || a.startsWith(short),
  )

  if (flagIndex > -1) {
    const arg = argv[flagIndex]!

    if ((arg === long || arg === short) && argv.length >= flagIndex) {
      // Syntax was `--long ${value}` or `-s ${value}`
      result = argv[flagIndex + 1]!
      argv = argv.filter((_v, i) => i < flagIndex || i > flagIndex + 1)
    } else {
      // Syntax was `--long=${value}` or `-s${value}`
      const prefix = arg.startsWith(longEq) ? longEq : short

      result = arg.slice(prefix.length)
      argv = argv.filter((_v, i) => i !== flagIndex)
    }
  }

  return result
}

const project = parseFlag({ long: "project", short: "p" }) ?? "tsconfig.json"
const coverage = parseFlag({ long: "coverage", short: "c" })

// No list of files given so use default
if (argv.length === 0) {
  argv = DEFAULTS.map((p) => `**/${p}`)
}

const mocha = require.resolve("mocha/bin/mocha.js")

// We are not going through a shell to start the process so glob extension is done manually
argv = globby.sync(argv, { gitignore: true, expandDirectories: DEFAULTS })

const loader = semver.satisfies(process.versions.node, "^18.19.0 || >=20.6.0")
  ? ["--import", "@solarwinds-apm/test/ts-node/import"]
  : ["--loader", "@solarwinds-apm/test/ts-node/loader"]

argv = [
  // Register ts-node loaders
  ...loader,
  // Forward the rest of our parameters
  ...process.execArgv,
  // mocha and its arguments
  mocha,
  "--extension",
  "js,ts,cjs,cts,mjs,mts",
  ...argv,
]

const envs = []
for (
  let dir = process.cwd();
  dir !== path.dirname(dir);
  dir = path.dirname(dir)
) {
  envs.push(`${dir}/.env`)
}
dotenv.configDotenv({ path: envs })

// TS_NODE_PROJECT is used by ts-node to look for a tsconfig.json
const env = {
  TS_NODE_PROJECT: project,
  TS_NODE_TRANSPILE_ONLY: "true",
  ...process.env,
}

if (coverage) {
  const coverageOutputPath = path.join(
    process.cwd(),
    "node_modules",
    ".coverage",
  )

  const c8 = require.resolve("c8/bin/c8.js")
  argv = [
    c8,
    // count all files in the coverage directory
    "--all",
    "--src",
    coverage,
    // output to a gitignored directory
    "--reports-dir",
    coverageOutputPath,
    // our actual command
    process.execPath,
    ...argv,
  ]
}

const output = spawnSync(process.execPath, argv, {
  env,
  stdio: "inherit",
})
process.exit(output.status ?? 0)
