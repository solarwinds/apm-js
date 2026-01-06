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

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { trace } from "@opentelemetry/api"
import {
  before,
  beforeEach,
  describe,
  expect,
  it,
  otel,
} from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.js"
import { JsonSampler } from "../../src/sampling/json.js"

const PATH = path.join(os.tmpdir(), "solarwinds-apm-settings.json")

describe(JsonSampler.name, () => {
  beforeEach(async () => {
    const sampler = new JsonSampler({} as Configuration)
    await otel.reset({ trace: { sampler } })
  })

  describe("valid file", () => {
    before(async () => {
      await fs.writeFile(
        PATH,
        JSON.stringify([
          {
            flags: "SAMPLE_START,SAMPLE_THROUGH_ALWAYS,TRIGGER_TRACE,OVERRIDE",
            value: 1_000_000,
            arguments: {
              BucketCapacity: 100,
              BucketRate: 10,
            },
            timestamp: Math.round(Date.now() / 1000),
            ttl: 60,
          },
        ]),
      )
    })

    it("samples created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })

      const span = (await otel.spans())[0]
      expect(span).not.to.be.undefined
      expect(span!.attributes).to.include.keys(
        "SampleRate",
        "SampleSource",
        "BucketCapacity",
        "BucketRate",
      )
    })
  })

  describe("invalid file", () => {
    before(async () => {
      await fs.writeFile(PATH, JSON.stringify({ hello: "world" }))
    })

    it("does not sample created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.false
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.be.empty
    })
  })

  describe("missing file", () => {
    before(async () => {
      try {
        await fs.rm(PATH)
      } catch {
        // didn't exist
      }
    })

    it("does not sample created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.false
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.be.empty
    })
  })

  describe("expired file", () => {
    before(async () => {
      await fs.writeFile(
        PATH,
        JSON.stringify([
          {
            flags: "SAMPLE_START,SAMPLE_THROUGH_ALWAYS,TRIGGER_TRACE,OVERRIDE",
            value: 1_000_000,
            arguments: {
              BucketCapacity: 100,
              BucketRate: 10,
            },
            timestamp: Math.round(Date.now() / 1000) - 120,
            ttl: 60,
          },
        ]),
      )
    })

    it("does not sample created spans", async () => {
      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.false
        span.end()
      })

      const spans = await otel.spans()
      expect(spans).to.be.empty
    })

    it("samples created span after reading new settings", async () => {
      await fs.writeFile(
        PATH,
        JSON.stringify([
          {
            flags: "SAMPLE_START,SAMPLE_THROUGH_ALWAYS,TRIGGER_TRACE,OVERRIDE",
            value: 1_000_000,
            arguments: {
              BucketCapacity: 100,
              BucketRate: 10,
            },
            timestamp: Math.round(Date.now() / 1000),
            ttl: 60,
          },
        ]),
      )

      const tracer = trace.getTracer("test")

      tracer.startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })

      const span = (await otel.spans())[0]
      expect(span).not.to.be.undefined
      expect(span!.attributes).to.include.keys(
        "SampleRate",
        "SampleSource",
        "BucketCapacity",
        "BucketRate",
      )
    })
  })
})
