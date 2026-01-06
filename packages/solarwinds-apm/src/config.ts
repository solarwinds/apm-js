/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import fsync from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { type Instrumentation } from "@opentelemetry/instrumentation"
import { type ResourceDetector } from "@opentelemetry/resources"
import { type ReadableSpan } from "@opentelemetry/sdk-trace-base"
import {
  type InstrumentationConfigMap,
  type ResourceDetectorConfigMap,
  type Set,
} from "@solarwinds-apm/instrumentations"
import { load } from "@solarwinds-apm/module"
import * as v from "valibot"

import log from "./commonjs/log.js"
import { environment } from "./env.js"
import {
  env,
  schema as sharedSchema,
  schemas as sharedSchemas,
} from "./shared/config.js"

interface Instrumentations {
  configs?: InstrumentationConfigMap
  extra?: Instrumentation[]
  set?: Set
}

interface ResourceDetectors {
  configs?: ResourceDetectorConfigMap

  extra?: ResourceDetector[]
  set?: Set
}

const schemas = {
  ...sharedSchemas,

  set: v.picklist(["none", "core", "all"]),

  trustedpath: v.pipe(
    v.string(),
    v.rawTransform(({ dataset: { value }, addIssue, NEVER }) => {
      try {
        return fsync.readFileSync(value, "utf-8")
      } catch (err) {
        addIssue({
          label: "File",
          message: (err as NodeJS.ErrnoException).message,
        })
        return NEVER
      }
    }),
  ),
}

const schema = v.pipe(
  v.intersect([
    sharedSchema({
      serviceKey: environment.SERVERLESS_NAME
        ? `:${environment.SERVERLESS_NAME}`
        : undefined,
      triggerTraceEnabled: true,
    }),

    v.object({
      trustedpath: v.optional(schemas.trustedpath),

      proxy: v.optional(schemas.url),

      runtimeMetrics: v.optional(schemas.boolean, !environment.IS_SERVERLESS),

      insertTraceContextIntoLogs: v.optional(schemas.boolean, false),

      insertTraceContextIntoQueries: v.optional(schemas.boolean, false),

      spanStacktraceFilter: v.optional(
        v.pipe(
          v.custom<(span: ReadableSpan) => boolean | number>(
            (filter) => typeof filter === "function",
          ),
          v.transform((filter) => (span: ReadableSpan) => {
            const length = filter(span)
            if (typeof length === "number") {
              return length
            } else {
              return length ? 16 : 0
            }
          }),
        ),
      ),

      instrumentations: v.optional(
        v.object({
          configs: v.optional(v.record(v.string(), v.unknown()), {}),
          extra: v.optional(v.array(v.unknown()), []),
          set: v.optional(
            schemas.set,
            environment.IS_SERVERLESS ? "core" : "all",
          ),
        }),
        {},
      ),

      resourceDetectors: v.optional(
        v.object({
          configs: v.optional(
            v.record(v.string(), v.record(v.string(), v.boolean())),
            {},
          ),
          extra: v.optional(v.array(v.unknown()), []),
          set: v.optional(
            schemas.set,
            environment.IS_SERVERLESS ? "core" : "all",
          ),
        }),
        {},
      ),
    }),
  ]),

  v.transform(({ instrumentations, resourceDetectors, ...raw }) => {
    return {
      instrumentations: instrumentations as Required<Instrumentations>,
      resourceDetectors: resourceDetectors as Required<ResourceDetectors>,
      ...raw,
    }
  }),
)

/** User provided configuration for solarwinds-apm */
export interface Config extends v.InferInput<typeof schema> {
  instrumentations?: Instrumentations
  resourceDetectors?: ResourceDetectors
}

/** Processed configuration for Node.js solarwinds-apm */
export interface Configuration extends v.InferOutput<typeof schema> {
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
        log(`The config file (${option}) could not be read.`, error)
      }
    } else if (paths.length === 1) {
      log(`The config file (${option}) could not be found.`)
    }
  }

  return { source, ...v.parse(schema, { ...file, ...env.object(process.env) }) }
}

export function printError(err: unknown) {
  if (err instanceof v.ValiError) {
    const issues = err.issues as v.ValiError<typeof schema>["issues"]
    const flattened = v.flatten(issues)

    // Label each issue by key. If the key isn't nested (doesn't contain a `.`)
    // also label the issue with the equivalent environment variable.
    const formatted = Object.entries(flattened.nested ?? {}).flatMap(
      ([name, messages]) => {
        const label = name.includes(".") ? name : `${name} (${env.toKey(name)})`
        return messages?.map((message) => `- ${label}: ${message}`) ?? []
      },
    )
    for (const issue of formatted) {
      log(issue)
    }
  } else {
    log(err)
  }
}
