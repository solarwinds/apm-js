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

const fs = require("node:fs")
const path = require("node:path")
const cproc = require("node:child_process")

const now = new Date()
const parts = {
  year: now.getUTCFullYear(),
  month: now.getUTCMonth(),
  day: now.getUTCDate(),
  hours: now.getUTCHours(),
  minutes: now.getUTCMinutes(),
}
const version = `${parts.year}.${parts.month}.${parts.day}-t.${parts.hours}.${parts.minutes}`

const setVersion = (packageJsonPath) => {
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, { encoding: "utf-8" }),
  )
  packageJson.version = version
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson))
  cproc.execSync(`prettier --write ${packageJsonPath}`, { stdio: "inherit" })
}

const packages = fs.readdirSync("packages")
for (const p of packages) {
  const packagePath = path.join("packages", p)
  if (!fs.statSync(packagePath).isDirectory()) continue

  setVersion(path.join(packagePath, "package.json"))

  const npmPath = path.join(packagePath, "npm")
  if (fs.existsSync(npmPath)) {
    const npmPackages = fs.readdirSync(npmPath)
    for (const np of npmPackages) {
      setVersion(path.join(npmPath, np, "package.json"))
    }
  }
}
