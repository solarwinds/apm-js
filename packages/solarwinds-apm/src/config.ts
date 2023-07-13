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

import * as fs from "node:fs"
import * as path from "node:path"
import * as process from "node:process"

import { DiagLogLevel } from "@opentelemetry/api"
import { type InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node"
import { type View } from "@opentelemetry/sdk-metrics"
import { oboe } from "@solarwinds-apm/bindings"
import * as mc from "@solarwinds-apm/merged-config"
import { type SwoConfiguration } from "@solarwinds-apm/sdk"
import { type Service } from "ts-node"

import aoCert from "./appoptics.crt"

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
  enabled?: boolean
  collector?: string
  trustedPath?: string
  logLevel?: LogLevel
  triggerTraceEnabled?: boolean
  runtimeMetrics?: boolean
  tracingMode?: TracingMode
  insertTraceContextIntoLogs?: boolean
  transactionSettings?: TransactionSetting[]
  instrumentations?: InstrumentationConfigMap
  metricViews?: View[]
}

const DEFAULT_FILE_NAME = "solarwinds.apm.config"
enum FileType {
  Json,
  Js,
  Ts,
  None,
}

interface ServiceKey {
  token: string
  name: string
}
type LogLevel = "verbose" | "debug" | "info" | "warn" | "error" | "none"
type TracingMode = "enabled" | "disabled"
type TransactionSetting = {
  tracing: TracingMode
} & (
  | { regex: RegExp | string }
  | { matcher: (identifier: string) => boolean | undefined }
)

export interface ExtendedSwoConfiguration extends SwoConfiguration {
  instrumentations?: InstrumentationConfigMap
  views?: View[]
}

export function readConfig(): ExtendedSwoConfiguration {
  const [path, type] = pathAndType()
  let configFile: ConfigFile
  switch (type) {
    case FileType.Ts: {
      configFile = readTsConfig(path)
      break
    }
    case FileType.Js: {
      configFile = readJsConfig(path)
      break
    }
    case FileType.Json: {
      configFile = readJsonConfig(path)
      break
    }
    case FileType.None:
      configFile = {}
  }

  const raw = mc.config(
    {
      serviceKey: {
        env: true,
        file: true,
        parser: parseServiceKey,
        required: true,
      },
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
        env: true,
        file: true,
        parser: parseBoolean({ name: "trigger trace", default: true }),
        default: true,
      },
      runtimeMetrics: {
        env: true,
        file: true,
        parser: parseBoolean({ name: "runtime metrics", default: true }),
        default: true,
      },
      tracingMode: {
        file: true,
        parser: parseTracingMode,
      },
      insertTraceContextIntoLogs: {
        file: true,
        parser: parseBoolean({
          name: "insert trace ids into logs",
          default: false,
        }),
        default: false,
      },
      insertTraceContextIntoQueries: {
        file: true,
        parser: parseBoolean({
          name: "insert trace ids into SQL queries",
          default: false,
        }),
        default: false,
      },
      transactionSettings: { file: true, parser: parseTransactionSettings },
      instrumentations: {
        file: true,
        parser: (v) => v as InstrumentationConfigMap,
      },
      metricViews: { file: true, parser: (v) => v as View[] },
    },
    configFile as Record<string, unknown>,
    "SW_APM_",
  )
  const config: ExtendedSwoConfiguration = {
    ...raw,
    token: raw.serviceKey.token,
    serviceName: raw.serviceKey.name,
    oboeLogLevel: otelLevelToOboeLevel(raw.logLevel),
    otelLogLevel: raw.logLevel,
  }

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

function pathAndType(): [path: string, type: FileType] {
  const cwd = process.cwd()
  let override = process.env.SW_APM_CONFIG_FILE

  if (override) {
    if (!path.isAbsolute(override)) {
      override = path.join(cwd, override)
    }
    if (!fs.existsSync(override)) {
      console.warn(`couldn't read config file at ${override}`)
      return [override, FileType.None]
    }

    const ext = path.extname(override)
    switch (ext) {
      case ".ts":
        return [override, FileType.Ts]
      case ".js":
        return [override, FileType.Js]
      case ".json":
        return [override, FileType.Json]
      default: {
        console.warn(`unknown config file extension for ${override}`)
        return [override, FileType.None]
      }
    }
  } else {
    const fullName = path.join(cwd, DEFAULT_FILE_NAME)
    if (fs.existsSync(`${fullName}.ts`)) {
      return [`${fullName}.ts`, FileType.Ts]
    } else if (fs.existsSync(`${fullName}.js`)) {
      return [`${fullName}.js`, FileType.Js]
    } else if (fs.existsSync(`${fullName}.json`)) {
      return [`${fullName}.json`, FileType.Json]
    } else {
      return [fullName, FileType.None]
    }
  }
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

function otelLevelToOboeLevel(level?: DiagLogLevel): number {
  switch (level) {
    case DiagLogLevel.NONE:
      return oboe.DEBUG_DISABLED
    case DiagLogLevel.ERROR:
      return oboe.DEBUG_ERROR
    case DiagLogLevel.WARN:
      return oboe.DEBUG_WARNING
    case DiagLogLevel.INFO:
      return oboe.DEBUG_INFO
    case DiagLogLevel.DEBUG:
      return oboe.DEBUG_LOW
    case DiagLogLevel.VERBOSE:
      return oboe.DEBUG_MEDIUM
    case DiagLogLevel.ALL:
      return oboe.DEBUG_HIGH
    default:
      return oboe.DEBUG_INFO
  }
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

function parseServiceKey(key: unknown): ServiceKey {
  const s = String(key)
  const parts = s.split(":")
  if (parts.length !== 2) {
    console.warn("invalid service key")
  }

  return {
    token: parts[0] ?? s,
    name: parts[1] ?? "",
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

function parseTracingMode(mode: unknown): boolean | undefined {
  if (typeof mode !== "string") {
    console.warn(`invalid tracing mode`)
    return undefined
  }

  switch (mode.toLowerCase()) {
    case "enabled":
      return true
    case "disabled":
      return false
    default: {
      console.warn(`invalid tracing mode "${mode}"`)
      return undefined
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
