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

const { createRequire: cr } = require("node:module")

const caller = () => {
  const prepareStackTrace = Error.prepareStackTrace
  try {
    const callsites = []
    Error.prepareStackTrace = (_err, cs) => {
      callsites.push(...cs)
    }
    void new Error().stack

    const current = callsites[0]
    return callsites.find((cs) => cs.getFileName() !== current.getFileName())
  } finally {
    Error.prepareStackTrace = prepareStackTrace
  }
}

module.exports.createRequire = function createRequire() {
  return cr(caller().getFileName())
}
