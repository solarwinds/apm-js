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

const path = require("path")
const fs = require("fs")

function packageJson(id) {
  try {
    const directory = require.resolve(id)
    const file = path.join(directory, "package.json")
    const contents = fs.readFileSync(file, { encoding: "utf-8" })
    return JSON.parse(contents)
  } catch {
    return null
  }
}

function print(...vals) {
  for (let i = 0; i < vals.length; i++) {
    console.dir(vals[i], {
      depth: Infinity,
      maxArrayLength: Infinity,
      maxStringLength: Infinity,
    })
  }
}

const report = process.report.getReport()
const packages = [
  "solarwinds-apm",
  "@solarwinds-apm/sdk",
  "@solarwinds-apm/bindings",
  "solarwinds-apm-bindings",
  "@opentelemetry/api",
  "@opentelemetry/core",
  "appoptics-apm",
  "@appoptics/apm-bindings",
  "appoptics-bindings",
].reduce((ps, p) => ({ ...ps, [p]: packageJson(p) }), {})

print(report, packages)

const installed = packages["solarwinds-apm"] != null
if (!installed) {
  console.warn(
    "The 'solarwinds-apm' package could not be found.",
    "Is it installed and are you running this script from your application directory ?",
  )
}

const appopticsInstalled = packages["appoptics-apm"] != null
if (appopticsInstalled) {
  console.warn(
    "The 'appoptics-apm' package was detected.",
    "Make sure to uninstall it properly as it is not compatible with the 'solarwinds-apm' package.",
  )
}

const platform = process.platform
if (platform !== "linux") {
  console.warn(
    `The current platform (${platform}) is not supported.`,
    "'solarwinds-apm' currently only supports Linux.",
  )
}

const arch = process.arch
if (arch !== "x64" && arch !== "arm64") {
  console.warn(
    `The current architecture (${arch}) is not supported.`,
    "'solarwinds-apm' currently only supports x64 and arm64.",
  )
}

const majorNodeVersion = Number.parseInt(process.versions.node.split(".")[0])
if (majorNodeVersion <= 14) {
  console.warn(
    `The current Node.js version (${process.version}) is no longer maintained and may be vulnerable.`,
    "'solarwinds-apm' may not work properly and SolarWinds STRONGLY RECOMMENDS to upgrade to a maintained Node.js version.",
  )
}

if (!installed) {
  process.exit(1)
}

const version = packages["solarwinds-apm"].version
const majorVersion = Number.parseInt(version.split(".")[0])
const otelBased = majorVersion >= 14

if (otelBased) {
  if (!["debug", "trace"].includes(process.env.SW_APM_LOG_LEVEL)) {
    console.warn(
      "The 'SW_APM_LOG_LEVEL' environment variable can be set to 'debug' to help with debugging issues.",
    )
  }

  if (packages["@opentelemetry/api"] == null) {
    console.warn(
      "The '@opentelemetry/api' package could not be found.",
      "Versions 14 and up of 'solarwinds-apm' require this package to be installed alongside them.",
    )
  }
} else {
  if (
    !process.env.SW_APM_LOG_SETTINGS ||
    process.env.SW_APM_LOG_SETTINGS.indexOf("debug") === -1
  ) {
    console.warn(
      "The 'SW_APM_LOG_SETTINGS' environment variable can be set to 'error,warn,info,debug' to help with debugging issues.",
    )
  }

  if (packages["@opentelemetry/api"] != null) {
    console.warn(
      "The '@opentelemetry/api' package was detected.",
      `Only versions 14 and up of 'solarwinds-apm' support OpenTelemetry, but the currently installed version is ${version}.`,
    )
  }
}

console.warn(
  "THE GENERATED REPORT CONTAINS A DUMP OF ALL ENVIRONMENT VARIABLES.",
  "MAKE SURE TO REMOVE ANY SENSITIVE INFORMATION BEFORE TRANSMITTING IT.",
)
