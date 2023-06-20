/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

function nativeRequireAssign(name, exports) {
  const t = triple()
  try {
    exports[name] = require(`@solarwinds-apm/bindings-${t}/${name}.node`)
  } catch (cause) {
    exports[name] = new Error(`unsupported platform ${t}`, { cause })
  }
}

const e = (module.exports = {})
nativeRequireAssign("oboe", e)
nativeRequireAssign("metrics", e)
