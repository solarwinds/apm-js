/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

export const AWS_LAMBDA_NAME = IS_NODE
  ? process.env.AWS_LAMBDA_FUNCTION_NAME
  : undefined
export const IS_AWS_LAMBDA = AWS_LAMBDA_NAME !== undefined

export const SERVERLESS_NAME = AWS_LAMBDA_NAME
export const IS_SERVERLESS = IS_AWS_LAMBDA
