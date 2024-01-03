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

const { IS_SERVERLESS } = require("@solarwinds-apm/module")

function triple() {
  const platform = process.platform
  const arch = process.arch

  if (platform === "linux") {
    const glibc = process.report.getReport().header.glibcVersionRuntime
    const abi = glibc ? "gnu" : "musl"

    return `linux-${arch}-${abi}`
  } else {
    return `${platform}-${arch}`
  }
}

function serverless() {
  if (IS_SERVERLESS) {
    return "-serverless"
  } else {
    return ""
  }
}

const t = `${triple()}${serverless()}`

try {
  module.exports.oboe = require(`@solarwinds-apm/bindings-${t}/oboe.node`)
} catch (cause) {
  module.exports.oboe = new Error(`unsupported platform ${t}`, { cause })
}

try {
  module.exports.metrics = require(`@solarwinds-apm/bindings-${t}/metrics.node`)
} catch (cause) {
  module.exports.metrics = new Error(`unsupported platform ${t}`, { cause })
}
