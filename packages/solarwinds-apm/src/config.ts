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
import { createRequire } from "node:module"
import * as path from "node:path"
import * as process from "node:process"

import { DiagLogLevel } from "@opentelemetry/api"
import { getEnvWithoutDefaults } from "@opentelemetry/core"
import { InstrumentationBase } from "@opentelemetry/instrumentation"
import { View } from "@opentelemetry/sdk-metrics"
import { oboe } from "@solarwinds-apm/bindings"
import { type InstrumentationConfigMap } from "@solarwinds-apm/instrumentations"
import { callsite, IS_SERVERLESS } from "@solarwinds-apm/module"
import { type SwConfiguration } from "@solarwinds-apm/sdk"
import { z } from "zod"

import aoCert from "./appoptics.crt.js"

const r = createRequire(callsite().getFileName()!)

const otelEnv = getEnvWithoutDefaults()

const boolean = z.union([
  z.boolean(),
  z
    .enum(["true", "false", "1", "0"])
    .transform((b) => b === "true" || b === "1"),
])

const regex = z.union([
  z.instanceof(RegExp),
  z.string().transform((s, ctx) => {
    try {
      return new RegExp(s)
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: (err as SyntaxError).message,
      })
      return z.NEVER
    }
  }),
])

const serviceKey = z
  .string()
  .includes(":")
  .transform((k) => {
    const [token, ...name] = k.split(":")
    return {
      token: token!,
      name: otelEnv.OTEL_SERVICE_NAME ?? name.join(":"),
    }
  })

const trustedpath = z.string().transform((p, ctx) => {
  try {
    return fs.readFileSync(p, "utf-8")
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: (err as NodeJS.ErrnoException).message,
    })
    return z.NEVER
  }
})

const tracingMode = z
  .enum(["enabled", "disabled"])
  .transform((m) => m === "enabled")

const logLevel = z
  .enum(["all", "verbose", "debug", "info", "warn", "error"])
  .transform((l) => {
    switch (l) {
      case "all":
        return DiagLogLevel.ALL
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
    }
  })

const transactionSettings = z.array(
  z
    .union([
      z.object({
        tracing: tracingMode,
        regex,
      }),
      z.object({
        tracing: tracingMode,
        matcher: z.function().args(z.string()).returns(z.boolean()),
      }),
    ])
    .transform((s) => ({
      tracing: s.tracing,
      matcher:
        "matcher" in s ? s.matcher : (ident: string) => s.regex.test(ident),
    })),
)

interface Instrumentations {
  configs?: InstrumentationConfigMap
  extra?: InstrumentationBase[]
}

interface Metrics {
  views?: View[]
  interval: number
}

const schema = z.object({
  serviceKey,
  enabled: boolean.default(true),
  collector: z.string().optional(),
  trustedpath: trustedpath.optional(),
  proxy: z.string().optional(),
  logLevel: logLevel.default("info"),
  triggerTraceEnabled: boolean.default(true),
  runtimeMetrics: boolean.default(!IS_SERVERLESS),
  tracingMode: tracingMode.optional(),
  insertTraceContextIntoLogs: boolean.default(false),
  insertTraceContextIntoQueries: boolean.default(false),
  transactionSettings: transactionSettings.optional(),
  instrumentations: z
    .object({
      configs: z.record(z.unknown()).optional(),
      extra: z.array(z.instanceof(InstrumentationBase)).optional(),
    })
    .transform((i) => i as Instrumentations)
    .default({}),
  metrics: z
    .object({
      views: z.array(z.instanceof(View)).optional(),
      interval: z.number().int().default(60_000),
    })
    .default({}),

  dev: z
    .object({
      otlpTraces: boolean.default(IS_SERVERLESS),
      otlpMetrics: boolean.default(IS_SERVERLESS),
      swTraces: boolean.default(!IS_SERVERLESS),
      swMetrics: boolean.default(!IS_SERVERLESS),
      initMessage: boolean.default(!IS_SERVERLESS),
      resourceDetection: boolean.default(true),
    })
    .default({}),
})

export interface Config extends Partial<z.input<typeof schema>> {
  instrumentations?: Instrumentations
  metrics?: Metrics
}

export interface ExtendedSwConfiguration extends SwConfiguration {
  instrumentations: Instrumentations
  metrics: Metrics

  dev: z.infer<typeof schema>["dev"]
}

const ENV_PREFIX = "SW_APM_"
const ENV_PREFIX_DEV = `${ENV_PREFIX}DEV_`
const DEFAULT_FILE_NAME = "solarwinds.apm.config"

export function readConfig(): ExtendedSwConfiguration {
  const env = envObject()
  const devEnv = envObject(ENV_PREFIX_DEV)

  const path = filePath()
  const file = path ? readConfigFile(path) : {}

  const devFile = file.dev && typeof file.dev === "object" ? file.dev : {}

  const raw = schema.parse({
    ...file,
    ...env,
    dev: { ...devFile, ...devEnv },
  })

  const config: ExtendedSwConfiguration = {
    ...raw,
    token: raw.serviceKey.token,
    serviceName: raw.serviceKey.name,
    certificate: raw.trustedpath,
    oboeLogLevel: otelLevelToOboeLevel(raw.logLevel),
    otelLogLevel: otelEnv.OTEL_LOG_LEVEL ?? raw.logLevel,
  }

  if (config.collector?.includes("appoptics.com")) {
    config.metricFormat ??= 1
    config.certificate ??= aoCert
  }

  return config
}

export function printError(err: unknown) {
  if (err instanceof z.ZodError) {
    const formatPath = (path: (string | number)[]) =>
      path.length === 1
        ? // `key (SW_APM_KEY)`
          `${path[0]!} (${toEnvKey(path[0]!.toString())})`
        : // `full.key[0].path`
          path
            .map((p) => (typeof p === "string" ? `.${p}` : `[${p}]`))
            .join("")
            .slice(1)

    const formatIssue =
      (depth: number) =>
      (issue: z.ZodIssue): string[] => {
        const indent = " ".repeat(depth * 2)
        const messages = [
          `${indent}${formatPath(issue.path)}: ${issue.message}`,
        ]

        if (issue.code === z.ZodIssueCode.invalid_union) {
          messages.push(
            ...issue.unionErrors.flatMap((e) =>
              e.issues.flatMap(formatIssue(depth + 1)),
            ),
          )
        }

        return messages
      }

    for (const issue of err.issues.flatMap(formatIssue(1))) {
      console.warn(issue)
    }
  } else {
    console.warn(err)
  }
}

function fromEnvKey(k: string, prefix = ENV_PREFIX) {
  return k
    .slice(prefix.length)
    .toLowerCase()
    .replace(/_[a-z]/g, (c) => c.slice(1).toUpperCase())
}

function toEnvKey(k: string, prefix = ENV_PREFIX) {
  return `${prefix}${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`
}

function envObject(prefix = ENV_PREFIX) {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [fromEnvKey(k, prefix), v]),
  )
}

function filePath() {
  const cwd = process.cwd()
  let override = process.env.SW_APM_CONFIG_FILE

  if (override) {
    if (!path.isAbsolute(override)) {
      override = path.join(cwd, override)
    }
    if (!fs.existsSync(override)) {
      console.warn(`couldn't read config file at ${override}`)
      return
    }

    return override
  } else {
    const fullName = path.join(cwd, DEFAULT_FILE_NAME)
    const options = [`${fullName}.ts`, `${fullName}.js`, `${fullName}.json`]
    for (const option of options) {
      if (fs.existsSync(option)) return option
    }
  }
}

function readConfigFile(path: string) {
  const required = r(path) as Record<string, unknown>
  if (
    "default" in required &&
    (required.__esModule || Object.keys(required).length === 1)
  ) {
    return required.default as Record<string, unknown>
  } else {
    return required
  }
}

function otelLevelToOboeLevel(level?: DiagLogLevel): number {
  switch (level) {
    case DiagLogLevel.ERROR:
      return oboe.INIT_LOG_LEVEL_ERROR
    case DiagLogLevel.WARN:
      return oboe.INIT_LOG_LEVEL_WARNING
    case DiagLogLevel.INFO:
      return oboe.INIT_LOG_LEVEL_INFO
    case DiagLogLevel.DEBUG:
      return oboe.INIT_LOG_LEVEL_DEBUG
    case DiagLogLevel.VERBOSE:
    case DiagLogLevel.ALL:
    default:
      return oboe.INIT_LOG_LEVEL_TRACE
  }
}
