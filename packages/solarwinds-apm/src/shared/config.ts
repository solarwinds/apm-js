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

import { DiagLogLevel } from "@opentelemetry/api"
import { type ENVIRONMENT, getEnvWithoutDefaults } from "@opentelemetry/core"
import * as v from "valibot"

/** Processed configuration shared by web and Node.js */
export interface Configuration {
  enabled: boolean
  service: string
  token?: string

  collector: URL
  headers: Record<string, string>
  otlp: {
    traces: string
    metrics: string
    logs: string
  }

  logLevel: DiagLogLevel
  tracingMode?: boolean
  triggerTraceEnabled: boolean
  exportLogsEnabled: boolean

  transactionName?: () => string
  transactionSettings?: {
    tracing: boolean
    matcher: (ident: string) => boolean
  }[]
}

export const schemas = {
  boolean: v.union([
    v.boolean(),
    v.pipe(
      v.picklist(["true", "false", "1", "0"]),
      v.transform((b) => b === "true" || b === "1"),
    ),
  ]),

  logLevel: v.pipe(
    v.picklist(["all", "verbose", "debug", "info", "warn", "error", "none"]),
    v.transform((ll) => {
      switch (ll) {
        case "all": {
          return DiagLogLevel.ALL
        }
        case "verbose": {
          return DiagLogLevel.VERBOSE
        }
        case "debug": {
          return DiagLogLevel.DEBUG
        }
        case "info": {
          return DiagLogLevel.INFO
        }
        case "warn": {
          return DiagLogLevel.WARN
        }
        case "error": {
          return DiagLogLevel.ERROR
        }
        case "none": {
          return DiagLogLevel.NONE
        }
      }
    }),
  ),

  regex: v.union([
    v.instance(RegExp),
    v.pipe(
      v.string(),
      v.rawTransform(({ dataset: { value }, addIssue, NEVER }) => {
        try {
          return new RegExp(value)
        } catch {
          addIssue({ label: RegExp.name })
          return NEVER
        }
      }),
    ),
  ]),

  serviceKey: v.pipe(
    v.string(),
    v.regex(/:.+$/),
    v.transform((sk) => {
      const [token, ...name] = sk.split(":")
      return {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        token: token || undefined,
        name: name.join(":"),
      }
    }),
  ),

  stringy: v.union([
    v.pipe(
      v.string(),
      v.transform((s) => () => s),
    ),
    v.pipe(
      v.function(),
      v.transform((f) => () => String(f())),
    ),
  ]),

  tracingMode: v.pipe(
    v.picklist(["enabled", "disabled"]),
    v.transform((tm) => tm === "enabled"),
  ),

  url: v.union([
    v.instance(URL),
    v.pipe(
      v.string(),
      v.rawTransform(({ dataset: { value }, addIssue, NEVER }) => {
        if (!/^https?:/.test(value)) {
          value = `https://${value}`
        }

        try {
          return new URL(value)
        } catch {
          addIssue({ label: URL.name })
          return NEVER
        }
      }),
    ),
  ]),
} as const

export interface Defaults {
  serviceKey?: string
  triggerTraceEnabled: boolean
}
export const schema = (defaults: Defaults) =>
  v.pipe(
    v.object({
      enabled: v.optional(schemas.boolean, true),

      serviceKey: defaults.serviceKey
        ? v.optional(schemas.serviceKey, defaults.serviceKey)
        : schemas.serviceKey,

      collector: v.optional(
        schemas.url,
        "apm.collector.na-01.cloud.solarwinds.com",
      ),

      logLevel: v.optional(schemas.logLevel, "warn"),
      tracingMode: v.optional(schemas.tracingMode),
      triggerTraceEnabled: v.optional(
        schemas.boolean,
        defaults.triggerTraceEnabled,
      ),
      exportLogsEnabled: v.optional(schemas.boolean, false),

      transactionName: v.optional(schemas.stringy),
      transactionSettings: v.optional(
        v.array(
          v.union([
            v.pipe(
              v.object({ tracing: schemas.tracingMode, regex: schemas.regex }),
              v.transform(({ tracing, regex }) => ({
                tracing,
                matcher: (ident: string) => regex.test(ident),
              })),
            ),
            v.pipe(
              v.object({ tracing: schemas.tracingMode, matcher: v.function() }),
              v.transform(({ tracing, matcher }) => ({
                tracing,
                matcher: (ident: string) => !!matcher(ident),
              })),
            ),
          ]),
        ),
      ),
    }),

    v.transform((raw): Configuration => {
      const otel = getEnvWithoutDefaults()

      const service = otel.OTEL_SERVICE_NAME ?? raw.serviceKey.name
      const token = raw.serviceKey.token

      const collector = raw.collector
      const headers: Configuration["headers"] = token
        ? { authorization: `Bearer ${token}` }
        : {}
      const otlp: Configuration["otlp"] = Object.fromEntries(
        (["traces", "metrics", "logs"] as const).map((signal) => [
          signal,
          signalEndpoint(signal, collector, otel),
        ]),
      )

      return {
        enabled: raw.enabled,
        service,
        token,

        collector,
        headers,
        otlp,

        logLevel: raw.logLevel,
        tracingMode: raw.tracingMode,
        triggerTraceEnabled: raw.triggerTraceEnabled,
        exportLogsEnabled: raw.exportLogsEnabled,

        transactionName: raw.transactionName,
        transactionSettings: raw.transactionSettings,
      }
    }),
  )

export const env = {
  PREFIX: "SW_APM_",

  /**
   * Returns a config object from an environment object by filtering the keys
   * by prefix then stripping it and renaming them to camelCase
   */
  object(
    object: Record<string, unknown>,
    prefix?: string,
  ): Record<string, unknown> {
    prefix ??= env.PREFIX
    return Object.fromEntries(
      Object.entries(object)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => [env.fromKey(k, prefix), v]),
    )
  },

  /** Converts an environment variable name to a config key */
  fromKey(k: string, prefix?: string) {
    prefix ??= env.PREFIX
    return k
      .slice(prefix.length)
      .toLowerCase()
      .replace(/_[a-z]/g, (c) => c.slice(1).toUpperCase())
  },

  /** Converts a config key to an environment variable name */
  toKey(k: string, prefix?: string) {
    prefix ??= env.PREFIX
    return `${prefix}${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`
  },
}

type Signal = "traces" | "metrics" | "logs"

/**
 * Computes the collector endpoint for the given signal
 * based on the config and environment
 */
function signalEndpoint(
  signal: Signal,
  collector: URL,
  otel: ENVIRONMENT,
): string {
  const upper = signal.toUpperCase() as Uppercase<typeof signal>
  const path = `/v1/${signal}`

  const specific = otel[`OTEL_EXPORTER_OTLP_${upper}_ENDPOINT`]
  if (specific) {
    return specific
  }

  const generic = otel.OTEL_EXPORTER_OTLP_ENDPOINT
  if (generic) {
    return `${generic}${path}`
  }

  const endpoint = new URL(collector)
  endpoint.hostname = collector.hostname.replace(
    /^apm\.collector\./,
    "otel.collector.",
  )
  endpoint.pathname = path
  return endpoint.href
}
