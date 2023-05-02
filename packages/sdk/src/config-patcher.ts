import { type SwoConfiguration } from "./config"

interface Configurable<Config> {
  getConfig(): Config
  setConfig(config?: Config): void
}
type Constructor<Config> = new () => Configurable<Config>

type MatchFunction<Config> = (
  instance: unknown,
) => instance is Configurable<Config>
type PatchFunction<Config> = (config: Config) => Config

interface Patch<Config> {
  matcher: MatchFunction<Config>
  patcher: PatchFunction<Config>
}

export class ConfigPatcher {
  private readonly patches: Patch<unknown>[] = []

  patch<Config>(
    constructor: Constructor<Config>,
    patcher: PatchFunction<Config>,
  ) {
    this.patches.push({
      matcher: ((i) => i instanceof constructor) as MatchFunction<unknown>,
      patcher: patcher as PatchFunction<unknown>,
    })
  }

  apply(instrumentations: SwoConfiguration["instrumentations"]) {
    const flattened = instrumentations?.flat() ?? []
    for (const instrumentation of flattened) {
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
