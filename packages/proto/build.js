/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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

import { mkdir, writeFile } from "node:fs/promises"
import { promisify } from "node:util"

import { main as pbjsMain } from "protobufjs-cli/pbjs.js"
import { main as pbtsMain } from "protobufjs-cli/pbts.js"

const pbjs = promisify(pbjsMain)
const pbts = promisify(pbtsMain)

const targets = {
  es: {
    wrapper: "es6",
  },
  cjs: {
    wrapper: "commonjs",
  },
}

for (const [target, options] of Object.entries(targets)) {
  await mkdir(`dist/${target}`, { recursive: true })

  const type = target === "es" ? "module" : "commonjs"
  await writeFile(`dist/${target}/package.json`, JSON.stringify({ type }))

  await pbjs([
    "-t",
    "static-module",
    "-w",
    options.wrapper,
    "-o",
    `./dist/${target}/index.js`,
    "--es6",
    "--force-number",
    "--no-create",
    "--no-verify",
    "--no-convert",
    "--no-delimited",
    "--no-service",
    "src/collector.proto",
  ])
  await pbts(["-o", `./dist/${target}/index.d.ts`, `dist/${target}/index.js`])
}
