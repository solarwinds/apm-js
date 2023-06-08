import * as fs from "node:fs"
import * as path from "node:path"
import * as process from "node:process"

import { DiagLogLevel } from "@opentelemetry/api"
import * as mc from "@swotel/merged-config"
import { type SwoConfiguration } from "@swotel/sdk"
import { type Service } from "ts-node"

import aoCert from "../appoptics.crt"

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
  serviceKey?: string
  collector?: string
  trustedPath?: string
  logLevel?: LogLevel
  triggerTraceEnabled?: boolean
  insertTraceIdsIntoLogs?: boolean
  transactionSettings?: TransactionSetting[]
}

type LogLevel = "verbose" | "debug" | "info" | "warn" | "error" | "none"
type TransactionSetting = {
  tracing: "enabled" | "disabled"
} & (
  | { regex: RegExp | string }
  | { matcher: (identifier: string) => boolean | undefined }
)

export function readConfig(name: string): SwoConfiguration {
  const fullName = path.join(process.cwd(), name)

  let configFile: ConfigFile
  if (fs.existsSync(`${fullName}.json`)) {
    configFile = readJsonConfig(`${fullName}.json`)
  } else if (fs.existsSync(`${fullName}.js`)) {
    configFile = readJsConfig(`${fullName}.js`)
  } else if (fs.existsSync(`${fullName}.ts`)) {
    configFile = readTsConfig(`${fullName}.ts`)
  } else {
    configFile = {}
  }

  const raw = mc.config(
    {
      serviceKey: { env: true, file: true, parser: String, required: true },
      enabled: {
        env: true,
        file: true,
        parser: parseBoolean({ name: "enabled", default: true }),
        default: true,
      },
      collector: { env: true, file: true, parser: String },
      trustedPath: { env: true, file: true, parser: String },
      logLevel: {
        env: true,
        file: true,
        parser: parseLogLevel,
        default: "info",
      },
      triggerTraceEnabled: {
        file: true,
        parser: parseBoolean({ name: "trigger trace", default: true }),
        default: true,
      },
      insertTraceIdsIntoLogs: {
        file: true,
        parser: parseBoolean({
          name: "insert trace ids into logs",
          default: true,
        }),
        default: true,
      },
      transactionSettings: { file: true, parser: parseTransactionSettings },
    },
    configFile as Record<string, unknown>,
    "SW_APM_",
  )
  const config: SwoConfiguration = { ...raw }

  if (raw.trustedPath) {
    config.certificate = fs.readFileSync(raw.trustedPath, {
      encoding: "utf8",
    })
  }

  if (config.collector?.includes("appoptics.com")) {
    config.metricFormat = 1

    if (!config.certificate) {
      config.certificate = aoCert
    }
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

const parseBoolean =
  (options: { name: string; default: boolean }) => (value: unknown) => {
    switch (typeof value) {
      case "boolean":
        return value
      case "string": {
        switch (value.toLowerCase()) {
          case "true":
            return true
          case "false":
            return false
          default: {
            console.warn(`invalid ${options.name} boolean value "${value}"`)
            return options.default
          }
        }
      }
      default: {
        console.warn(`invalid ${options.name} boolean value`)
        return options.default
      }
    }
  }

function parseLogLevel(level: unknown): DiagLogLevel {
  if (typeof level !== "string") {
    console.warn(`invalid log level`)
    return DiagLogLevel.INFO
  }

  switch (level.toLowerCase()) {
    case "verbose":
      return DiagLogLevel.VERBOSE
    case "debug":
      return DiagLogLevel.DEBUG
    case "info":
      return DiagLogLevel.INFO
    case "warn":
      return DiagLogLevel.WARN
    case "error":
      return DiagLogLevel.ERROR
    case "none":
      return DiagLogLevel.NONE
    default: {
      console.warn(`invalid log level "${level}"`)
      return DiagLogLevel.INFO
    }
  }
}

function parseTransactionSettings(settings: unknown) {
  const result: SwoConfiguration["transactionSettings"] = []

  if (!Array.isArray(settings)) {
    console.warn(`invalid transaction settings`)
    return result
  }

  for (let i = 0; i < settings.length; i++) {
    const setting = settings[i] as unknown
    const error = `invalid transaction setting at index ${i}`

    if (typeof setting !== "object" || setting === null) {
      console.warn(`${error}, should be an object, ignoring`)
      continue
    }

    if (
      !("tracing" in setting) ||
      !(["enabled", "disabled"] as (string | unknown)[]).includes(
        setting.tracing,
      )
    ) {
      console.warn(
        `${error}, "tracing" must be "enabled" or "disabled", ignoring`,
      )
      continue
    }
    const tracing = setting.tracing === "enabled"

    let matcher: (identifier: string) => boolean
    if ("regex" in setting) {
      const regex = setting.regex
      if (typeof regex === "string") {
        try {
          const parsed = new RegExp(regex)
          matcher = (identifier) => parsed.test(identifier)
        } catch {
          console.warn(
            `${error}, "regex" is not a valid regular expression, ignoring`,
          )
          continue
        }
      } else if (regex instanceof RegExp) {
        matcher = (identifier) => regex.test(identifier)
      } else {
        console.warn(`${error}, "regex" must be a string or a RegExp, ignoring`)
        continue
      }
    } else if ("matcher" in setting) {
      if (typeof setting.matcher !== "function") {
        console.warn(`${error}, "matcher" must be a function, ignoring`)
        continue
      }
      matcher = setting.matcher as (identifier: string) => boolean
    } else {
      console.warn(`${error}, must have either "regex" or "matcher", ignoring`)
      continue
    }

    result.push({ tracing, matcher })
  }

  return result
}
