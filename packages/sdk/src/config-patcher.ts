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

import {
  type Instrumentation,
  type InstrumentationConfig,
} from "@opentelemetry/instrumentation"

interface Configurable<Config extends InstrumentationConfig> {
  getConfig(): Config
  setConfig(config?: Config): void
}
type Constructor<Config extends InstrumentationConfig> =
  new () => Configurable<Config>

type MatchFunction<Config extends InstrumentationConfig> = (
  instance: unknown,
) => instance is Configurable<Config>
type PatchFunction<Config extends InstrumentationConfig> = (
  config: Config,
) => Config

interface Patch<Config extends InstrumentationConfig> {
  matcher: MatchFunction<Config>
  patcher: PatchFunction<Config>
}

export class ConfigPatcher {
  private readonly patches: Patch<InstrumentationConfig>[] = []

  patch<Config extends InstrumentationConfig>(
    constructor: Constructor<Config>,
    patcher: PatchFunction<Config>,
  ) {
    this.patches.push({
      matcher: ((i) =>
        i instanceof constructor) as MatchFunction<InstrumentationConfig>,
      patcher: patcher as unknown as PatchFunction<InstrumentationConfig>,
    })
  }

  apply(instrumentations: Instrumentation[]) {
    for (const instrumentation of instrumentations) {
      for (const { matcher, patcher } of this.patches) {
        if (matcher(instrumentation)) {
          instrumentation.setConfig(
            patcher(instrumentation.getConfig()) as object,
          )
        }
      }
    }
  }
}
