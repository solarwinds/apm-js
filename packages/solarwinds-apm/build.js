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

import fs from "node:fs/promises"

import eslint from "eslint"
import prettier from "prettier"

const ESLint = await eslint.loadESLint({ useFlatConfig: true })

const version = JSON.parse(
  await fs.readFile("package.json", { encoding: "utf-8" }),
).version

const code = `export const VERSION = "${version}"`
const formatted = await prettier.format(code, { parser: "typescript" })
await fs.writeFile("src/version.ts", formatted)
const linted = await new ESLint({ fix: true }).lintFiles("src/version.ts")
await fs.writeFile("src/version.ts", linted[0].output)

await fs.mkdir("dist/commonjs", { recursive: true })
await fs.cp("src/commonjs/package.json", "dist/commonjs/package.json")
