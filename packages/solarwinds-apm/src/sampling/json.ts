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

import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import { context } from "@opentelemetry/api"
import { suppressTracing } from "@opentelemetry/core"
import {
  BucketType,
  Flags,
  type SampleParams,
  SampleSource,
  type Settings,
} from "@solarwinds-apm/sampling"
import { z } from "zod"

import { type Configuration } from "../config.js"
import { componentLogger } from "../logger.js"
import { Sampler } from "./sampler.js"

const PATH = path.join(
  process.platform === "win32" ? "%SystemRoot%\\temp" : "/tmp",
  "solarwinds-apm-settings.json",
)

export class JsonSampler extends Sampler {
  readonly #path: string
  #expiry: number = Date.now()

  constructor(config: Configuration, path: string = PATH) {
    super(config, componentLogger(JsonSampler))
    this.#path = path

    this.#loop()
  }

  override shouldSample(...params: SampleParams) {
    this.#loop()
    return super.shouldSample(...params)
  }

  override toString(): string {
    return `JSON Sampler (${this.#path})`
  }

  #loop() {
    // update if we're within 10s of expiry
    if (Date.now() + 10 * 1000 < this.#expiry) {
      return
    }

    let unparsed: unknown
    try {
      const contents = context.with(suppressTracing(context.active()), () =>
        fs.readFileSync(this.#path, { encoding: "utf-8" }),
      )
      unparsed = JSON.parse(contents)
    } catch (error) {
      this.logger.debug("missing or invalid settings file", error)
      return
    }

    const parsed = parseSettings(unparsed)
    if (!parsed) {
      this.logger.debug("invalid settings file", unparsed)
      return
    }

    this.logger.debug("read and parsed settings", unparsed, parsed)
    this.updateSettings(parsed)
    this.#expiry = (parsed.timestamp + parsed.ttl) * 1000
  }
}

const FLAGS_NAMES: Record<string, Flags | undefined> = {
  OVERRIDE: Flags.OVERRIDE,
  SAMPLE_START: Flags.SAMPLE_START,
  SAMPLE_THROUGH_ALWAYS: Flags.SAMPLE_THROUGH_ALWAYS,
  TRIGGER_TRACE: Flags.TRIGGERED_TRACE,
}

const flags = z.string().transform((f) =>
  f.split(",").reduce((flags, f) => {
    const flag = FLAGS_NAMES[f]
    if (flag) {
      flags |= flag
    }
    return flags
  }, Flags.OK),
)

const settings = z.tuple([
  z.object({
    flags: flags.optional(),
    value: z.number().default(0),
    timestamp: z.number(),
    ttl: z.number(),
    arguments: z
      .object({
        BucketCapacity: z.number().optional(),
        BucketRate: z.number().optional(),
        TriggerRelaxedBucketCapacity: z.number().optional(),
        TriggerRelaxedBucketRate: z.number().optional(),
        TriggerStrictBucketCapacity: z.number().optional(),
        TriggerStrictBucketRate: z.number().optional(),
        SignatureKey: z.string().optional(),
      })
      .default({}),
  }),
])

export function parseSettings(unparsed: unknown): Settings | undefined {
  const result = settings.safeParse(unparsed)
  if (!result.success) {
    return undefined
  }

  const data = result.data[0]
  const parsed: Settings = {
    sampleRate: data.value,
    sampleSource: SampleSource.Remote,
    flags: data.flags ?? Flags.OK,
    buckets: {},
    timestamp: data.timestamp,
    ttl: data.ttl,
  }

  if (
    data.arguments.BucketCapacity !== undefined &&
    data.arguments.BucketRate !== undefined
  ) {
    parsed.buckets[BucketType.DEFAULT] = {
      capacity: data.arguments.BucketCapacity,
      rate: data.arguments.BucketRate,
    }
  }
  if (
    data.arguments.TriggerRelaxedBucketCapacity !== undefined &&
    data.arguments.TriggerRelaxedBucketRate !== undefined
  ) {
    parsed.buckets[BucketType.TRIGGER_RELAXED] = {
      capacity: data.arguments.TriggerRelaxedBucketCapacity,
      rate: data.arguments.TriggerRelaxedBucketRate,
    }
  }
  if (
    data.arguments.TriggerStrictBucketCapacity !== undefined &&
    data.arguments.TriggerStrictBucketRate !== undefined
  ) {
    parsed.buckets[BucketType.TRIGGER_STRICT] = {
      capacity: data.arguments.TriggerStrictBucketCapacity,
      rate: data.arguments.TriggerStrictBucketRate,
    }
  }

  if (data.arguments.SignatureKey !== undefined) {
    parsed.signatureKey = Buffer.from(data.arguments.SignatureKey)
  }

  return parsed
}
