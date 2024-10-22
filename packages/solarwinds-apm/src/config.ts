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

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { DiagLogLevel } from "@opentelemetry/api"
import { getEnvWithoutDefaults } from "@opentelemetry/core"
import { type Instrumentation } from "@opentelemetry/instrumentation"
import { type Detector, type DetectorSync } from "@opentelemetry/resources"
import {
  type InstrumentationConfigMap,
  type ResourceDetectorConfigMap,
  type Set,
} from "@solarwinds-apm/instrumentations"
import { IS_SERVERLESS } from "@solarwinds-apm/module"
import { load } from "@solarwinds-apm/module"
import { z, ZodError, ZodIssueCode } from "zod"

const PREFIX = "SW_APM_"
const ENDPOINTS = {
  traces: "/v1/traces",
  metrics: "/v1/metrics",
  logs: "/v1/logs",
}

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
      name: name.join(":"),
    }
  })

const trustedpath = z.string().transform((p, ctx) => {
  try {
    return fs.readFile(p, "utf-8")
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
  .enum(["all", "verbose", "debug", "info", "warn", "error", "none"])
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
      case "none":
        return DiagLogLevel.NONE
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
        "matcher" in s
          ? s.matcher.bind(s)
          : (ident: string) => s.regex.test(ident),
    })),
)

const set = z.enum(["none", "core", "all"])

interface Instrumentations {
  configs?: InstrumentationConfigMap
  extra?: Instrumentation[]
  set?: Set
}

interface ResourceDetectors {
  configs?: ResourceDetectorConfigMap
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  extra?: (DetectorSync | Detector)[]
  set?: Set
}

const schema = z.object({
  serviceKey: serviceKey.optional(),
  enabled: boolean.default(true),
  legacy: boolean.optional(),
  collector: z.string().default("apm.collector.na-01.cloud.solarwinds.com"),
  trustedpath: trustedpath.optional(),
  proxy: z.string().optional(),
  logLevel: logLevel.default("warn"),
  triggerTraceEnabled: boolean.default(true),
  runtimeMetrics: boolean.default(!IS_SERVERLESS),
  tracingMode: tracingMode.optional(),
  transactionName: z.string().optional(),
  insertTraceContextIntoLogs: boolean.default(false),
  insertTraceContextIntoQueries: boolean.default(false),
  exportLogsEnabled: boolean.default(false),
  transactionSettings: transactionSettings.optional(),
  instrumentations: z
    .object({
      configs: z.record(z.unknown()).optional(),
      extra: z.array(z.unknown()).optional(),
      set: set.default(IS_SERVERLESS ? "core" : "all"),
    })
    .transform((i) => i as Instrumentations)
    .default({}),
  resourceDetectors: z
    .object({
      configs: z.record(z.record(z.string(), z.boolean())).optional(),
      extra: z.array(z.unknown()).optional(),
      set: set.default(IS_SERVERLESS ? "core" : "all"),
    })
    .transform((i) => i as ResourceDetectors)
    .default({}),
})

/** User provided configuration for solarwinds-apm */
export interface Config extends z.input<typeof schema> {
  instrumentations?: Instrumentations
  resourceDetectors?: ResourceDetectors
}

/** Processed configuration for solarwinds-apm */
export interface Configuration extends z.output<typeof schema> {
  service: string
  legacy: boolean

  otlp: {
    tracesEndpoint?: string
    metricsEndpoint?: string
    logsEndpoint?: string
    headers: Record<string, string>
  }

  source?: string
}

export async function read(): Promise<Configuration> {
  const paths: string[] = []
  if (typeof process.env.SW_APM_CONFIG_FILE === "string") {
    paths.push(process.env.SW_APM_CONFIG_FILE)
  } else {
    paths.push(
      "solarwinds.apm.config.ts",
      "solarwinds.apm.config.mts",
      "solarwinds.apm.config.cts",
      "solarwinds.apm.config.js",
      "solarwinds.apm.config.mjs",
      "solarwinds.apm.config.cjs",
      "solarwinds.apm.config.json",
    )
  }

  const exists = (path: string) =>
    fs
      .stat(path)
      .then((stat) => stat.isFile())
      .catch(() => false)

  const env = envObject()
  let file: object = {}
  let source: string | undefined

  for (let option of paths) {
    option = path.resolve(option)

    if (await exists(option)) {
      try {
        const read: unknown =
          path.extname(option) === ".json"
            ? JSON.parse(await fs.readFile(option, { encoding: "utf-8" }))
            : await load(pathToFileURL(option).href)

        if (typeof read !== "object" || read === null) {
          throw new Error(`Expected config object, got ${typeof read}.`)
        }

        file = read
        source = option
      } catch (error) {
        console.warn(`The config file (${option}) could not be read.`, error)
      }
    } else if (paths.length === 1) {
      console.warn(`The config file (${option}) could not be found.`)
    }
  }

  const raw = await schema.parseAsync({ ...file, ...env })
  const otel = getEnvWithoutDefaults()

  const service = otel.OTEL_SERVICE_NAME ?? raw.serviceKey?.name
  if (!service || (!IS_SERVERLESS && !raw.serviceKey?.token)) {
    throw new ZodError([
      {
        path: ["serviceKey"],
        message: "Missing service key",
        code: ZodIssueCode.custom,
      },
    ])
  }

  const legacy = raw.legacy ?? raw.collector.includes("appoptics")
  if (legacy && raw.exportLogsEnabled) {
    console.warn("Logs export is not supported when exporting to AppOptics.")
    raw.exportLogsEnabled = false
  }

  return {
    ...raw,

    service,
    legacy,

    otlp: {
      tracesEndpoint:
        otel.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        otel.OTEL_EXPORTER_OTLP_ENDPOINT?.concat(ENDPOINTS.traces) ??
        raw.collector
          .replace(/^apm\.collector\./, "https://otel.collector.")
          .concat(ENDPOINTS.traces),
      metricsEndpoint:
        otel.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
        otel.OTEL_EXPORTER_OTLP_ENDPOINT?.concat(ENDPOINTS.metrics) ??
        raw.collector
          .replace(/^apm\.collector\./, "https://otel.collector.")
          .concat(ENDPOINTS.metrics),
      logsEndpoint:
        otel.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
        otel.OTEL_EXPORTER_OTLP_ENDPOINT?.concat(ENDPOINTS.logs) ??
        raw.collector
          .replace(/^apm\.collector\./, "https://otel.collector.")
          .concat(ENDPOINTS.logs),

      headers: raw.serviceKey?.token
        ? { authorization: `Bearer ${raw.serviceKey.token}` }
        : {},
    },

    source,
  }
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

function fromEnvKey(k: string, prefix = PREFIX) {
  return k
    .slice(prefix.length)
    .toLowerCase()
    .replace(/_[a-z]/g, (c) => c.slice(1).toUpperCase())
}

function toEnvKey(k: string, prefix = PREFIX) {
  return `${prefix}${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`
}

function envObject(prefix = PREFIX) {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [fromEnvKey(k, prefix), v]),
  )
}
