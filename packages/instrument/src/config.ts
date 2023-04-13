import * as fs from "node:fs"

import * as mc from "@swotel/merged-config"
import { type SwoConfiguration } from "@swotel/sdk"
import { type Service } from "ts-node"

let json: typeof import("json5") | typeof JSON
try {
  /* eslint-disable-next-line ts/no-unsafe-assignment */
  json = require("json5")
} catch {
  json = JSON
}

let tsNode: typeof import("ts-node") | undefined
try {
  /* eslint-disable-next-line ts/no-unsafe-assignment */
  tsNode = require("ts-node")
} catch {
  tsNode = undefined
}

export interface ConfigFile {
  collector?: string
  trustedPath?: string
}

export function readConfig(name: string): SwoConfiguration {
  let configFile: ConfigFile

  if (fs.existsSync(`${name}.json`)) {
    configFile = readJsonConfig(`${name}.json`)
  } else if (fs.existsSync(`${name}.js`)) {
    configFile = readJsConfig(`${name}.js`)
  } else if (fs.existsSync(`${name}.ts`)) {
    configFile = readTsConfig(`${name}.ts`)
  } else {
    configFile = {}
  }

  const raw = mc.config(
    {
      serviceKey: { env: true, parser: String, required: true },
      collector: { env: true, file: true, parser: String },
      trustedPath: { env: true, file: true, parser: String },
    },
    configFile as Record<string, unknown>,
    "SW_APM_",
  )
  const config: SwoConfiguration = { ...raw }

  // TODO: AO cert
  if (raw.trustedPath) {
    config.certificate = fs.readFileSync(raw.trustedPath, {
      encoding: "utf8",
    })
  }

  return config
}

function readJsonConfig(file: string) {
  const contents = fs.readFileSync(file, { encoding: "utf8" })
  return json.parse(contents) as ConfigFile
}

function readJsConfig(file: string) {
  /* eslint-disable-next-line ts/no-var-requires */
  return require(file) as ConfigFile
}

let tsNodeService: Service | undefined = undefined
function readTsConfig(file: string) {
  if (!tsNode) {
    throw new Error("ts-node is required when using a .ts config file")
  }

  tsNodeService ??= tsNode.register({ compilerOptions: { module: "commonjs" } })

  tsNodeService.enabled(true)
  /* eslint-disable-next-line ts/no-var-requires */
  const required = require(file) as
    | ConfigFile
    | { __esModule: true; default: ConfigFile }
  tsNodeService.enabled(false)

  return "__esModule" in required ? required.default : required
}
