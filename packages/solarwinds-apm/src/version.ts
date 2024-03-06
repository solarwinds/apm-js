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

import { VERSION as OTEL_VERSION } from "@opentelemetry/core"
import { IS_SERVERLESS } from "@solarwinds-apm/module"
import { VERSION as SDK_VERSION } from "@solarwinds-apm/sdk"
import * as semver from "semver"

import { version as VERSION } from "../package.json"

const NODE_VERSION = process.versions.node

const MINIMUM_SUPPORTED = "16.13.0"
const MINIMUM_LTS = "18.0.0"

export function versionCheck(): boolean {
  if (!IS_SERVERLESS) {
    console.log(
      [
        `Node.js ${NODE_VERSION}`,
        `solarwinds-apm ${VERSION}`,
        `@solarwinds-apm/sdk ${SDK_VERSION}`,
        `@opentelemetry/core ${OTEL_VERSION}`,
      ].join("\n"),
    )
  }

  try {
    let supported = true
    if (semver.lt(NODE_VERSION, MINIMUM_SUPPORTED)) {
      console.error(
        "The current Node.js version is not supported and the instrumentation library will be disabled.",
        `The minimum supported version is ${MINIMUM_SUPPORTED}`,
      )
      supported = false
    }
    if (semver.lt(NODE_VERSION, MINIMUM_LTS)) {
      console.warn(
        "The current Node.js version has reached End Of Life at the time the library was published, which means it no longer receives security updates.",
        "SolarWinds STRONGLY RECOMMENDS upgrading to a supported Node.js version and staying up to date with its support policy at https://nodejs.org/about/previous-releases",
      )
    }

    if (
      process.versions.ares &&
      semver.satisfies(process.versions.ares, "1.20.x") &&
      process.env.GRPC_DNS_RESOLVER !== "native" &&
      !IS_SERVERLESS
    ) {
      console.error(
        "The current Node.js version is incompatible with the default DNS resolver used by the instrumentation library.",
        "This can be fixed by setting the 'GRPC_DNS_RESOLVER' environment variable to 'native'.",
      )
    }

    return supported
  } catch {
    return false
  }
}

export { VERSION }
export const FULL_VERSION = `${VERSION}+${SDK_VERSION}`
