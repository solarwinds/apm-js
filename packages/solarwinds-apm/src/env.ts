/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

export const IS_NODE =
  typeof globalThis.process === "object" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  typeof globalThis.process?.versions?.node === "string"

export const environment = {
  get AWS_LAMBDA_NAME() {
    return IS_NODE ? process.env.AWS_LAMBDA_FUNCTION_NAME : undefined
  },
  get IS_AWS_LAMBDA() {
    return this.AWS_LAMBDA_NAME !== undefined
  },

  get SERVERLESS_NAME() {
    return this.AWS_LAMBDA_NAME
  },
  get IS_SERVERLESS() {
    return this.IS_AWS_LAMBDA
  },

  get DEV() {
    return IS_NODE ? process.env.SW_APM_DANGEROUS_ENV === "dev" : false
  },
}
