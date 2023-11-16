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

import { env } from "node:process"

/**
 * Finds the current call site. Useful to replace `import.meta.url` or `__dirname`,
 * or to get more than just a file name.
 *
 * @returns The {@link NodeJS.CallSite} this function was called from
 */
export function callsite(): NodeJS.CallSite {
  const prepareStackTrace = Error.prepareStackTrace
  try {
    const callsites: NodeJS.CallSite[] = []
    Error.prepareStackTrace = (_err, cs) => {
      callsites.push(...cs)
    }
    void new Error().stack

    const current = callsites[0]!
    return callsites.find((cs) => cs.getFileName() !== current.getFileName())!
  } finally {
    Error.prepareStackTrace = prepareStackTrace
  }
}

export const IS_AWS_LAMBDA = "AWS_LAMBDA_FUNCTION_NAME" in env

export const IS_SERVERLESS = IS_AWS_LAMBDA
