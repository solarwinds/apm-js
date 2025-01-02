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

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { context } from "@opentelemetry/api"
import { suppressTracing } from "@opentelemetry/core"
import { type SampleParams } from "@solarwinds-apm/sampling"

import { type Configuration } from "../config.js"
import { componentLogger } from "../logger.js"
import { Sampler } from "./sampler.js"

const PATH = path.join(os.tmpdir(), "solarwinds-apm-settings.json")

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

    if (!Array.isArray(unparsed) || unparsed.length !== 1) {
      this.logger.debug("invalid settings file", unparsed)
      return
    }

    const parsed = this.updateSettings(unparsed[0])
    if (parsed) {
      this.#expiry = (parsed.timestamp + parsed.ttl) * 1000
    } else {
      this.logger.debug("invalid settings file", unparsed)
    }
  }
}
