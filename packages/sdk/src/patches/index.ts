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

import { type TextMapPropagator } from "@opentelemetry/api"
import { type InstrumentationConfig } from "@opentelemetry/instrumentation"

/*
Every instrumentation config patch should live in its own file in this
directory.

It should export a single `patch` function of type
`Patch<InstrumentationConfig>` where `InstrumentationConfig` is the config type
specific to the instrumentation being patched.
*/
import * as bunyan from "./bunyan"
import * as http from "./http"
import * as pino from "./pino"

export interface Options {
  responsePropagator: TextMapPropagator<unknown>
  insertTraceContextIntoLogs: boolean
}

export type Patch<Config extends InstrumentationConfig> = (
  config: Config,
  options: Options,
) => Config

const patches = { bunyan, http, pino } as const
type Patches = typeof patches
type PatchableConfigs = {
  [Module in keyof Patches as `@opentelemetry/instrumentation-${Module}`]?: Patches[Module] extends {
    patch: Patch<infer Config>
  }
    ? Config
    : never
}

export function patch(
  configs: PatchableConfigs,
  options: Options,
): PatchableConfigs {
  const patched = { ...configs }
  for (const [name, { patch }] of Object.entries(patches)) {
    const prefixed = `@opentelemetry/instrumentation-${name}` as const
    patched[prefixed] = patch(configs[prefixed] ?? {}, options)
  }
  return patched
}
