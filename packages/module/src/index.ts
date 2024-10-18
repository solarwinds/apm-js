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

import { env } from "node:process"

export async function load(file: string): Promise<unknown> {
  const imported = (await import(file)) as object

  const hasDefault = "default" in imported
  const keyCount = Object.keys(imported).length

  const useDefaultExport =
    hasDefault &&
    (keyCount === 1 || (keyCount === 2 && "__esModule" in imported))

  if (useDefaultExport) return imported.default
  else return imported
}

export const IS_AWS_LAMBDA = "AWS_LAMBDA_FUNCTION_NAME" in env

export const IS_SERVERLESS = IS_AWS_LAMBDA
