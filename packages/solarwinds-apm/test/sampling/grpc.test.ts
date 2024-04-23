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

import { hostname } from "node:os"

import { credentials } from "@grpc/grpc-js"
import { diag, trace } from "@opentelemetry/api"
import { collector } from "@solarwinds-apm/proto"
import { BucketType, Flags } from "@solarwinds-apm/sampling"
import { before, describe, expect, it, otel } from "@solarwinds-apm/test"

import { type ExtendedSwConfiguration } from "../../src/config.js"
import {
  CollectorClient,
  GrpcSampler,
  parseSettings,
} from "../../src/sampling/grpc.js"

expect(process.env).to.include.keys("SW_APM_COLLECTOR", "SW_APM_SERVICE_KEY")
const COLLECTOR = process.env.SW_APM_COLLECTOR!
const SERVICE_KEY = process.env.SW_APM_SERVICE_KEY!

const numberBuffer = (n: number) => {
  const buf = Buffer.alloc(8)
  buf.writeDoubleLE(n)
  return buf
}

describe("GrpcSampler", () => {
  before(async () => {
    const [token, serviceName] = SERVICE_KEY.split(":")
    const config = {
      collector: COLLECTOR,
      token,
      serviceName,
    } as unknown as ExtendedSwConfiguration

    const sampler = new GrpcSampler(config, diag)
    await otel.reset({ trace: { sampler } })
    await sampler.ready
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
      "BucketCapacity",
      "BucketRate",
    )
  }).retries(4)
})

describe("CollectorClient", () => {
  const client = new CollectorClient(
    `${COLLECTOR}:443`,
    credentials.createSsl(),
  )

  it("fetches valid settings", async () => {
    const settings = await client.getSettings({
      apiKey: SERVICE_KEY,
      identity: { hostname: hostname() },
      clientVersion: "2",
    })

    expect(settings).not.to.be.undefined
    expect(settings!.result).to.equal(collector.ResultCode.OK)
    expect(settings!.settings?.length).to.equal(1)

    const setting = parseSettings(settings!.settings![0]!)
    expect(setting).not.to.be.undefined
  }).retries(4)
})

describe("parseSettings", () => {
  it("correctly parses gRPC settings", () => {
    const grpc: collector.IOboeSetting = {
      type: collector.OboeSettingType.DEFAULT_SAMPLE_RATE,
      flags: Buffer.from(
        "SAMPLE_START,SAMPLE_THROUGH_ALWAYS,TRIGGER_TRACE,OVERRIDE",
      ),
      timestamp: Math.round(Date.now() / 1000),
      value: 500_000,
      layer: null,
      arguments: {
        BucketCapacity: numberBuffer(0.2),
        BucketRate: numberBuffer(0.1),
        TriggerRelaxedBucketCapacity: numberBuffer(20),
        TriggerRelaxedBucketRate: numberBuffer(10),
        TriggerStrictBucketCapacity: numberBuffer(2),
        TriggerStrictBucketRate: numberBuffer(1),
        SignatureKey: Buffer.from("key"),
      },
      ttl: 120,
    }

    const setting = parseSettings(grpc)
    expect(setting).to.deep.equal({
      sampleRate: 500_000,
      flags:
        Flags.SAMPLE_START |
        Flags.SAMPLE_THROUGH_ALWAYS |
        Flags.TRIGGERED_TRACE |
        Flags.OVERRIDE,
      buckets: {
        [BucketType.DEFAULT]: {
          capacity: 0.2,
          rate: 0.1,
        },
        [BucketType.TRIGGER_RELAXED]: {
          capacity: 20,
          rate: 10,
        },
        [BucketType.TRIGGER_STRICT]: {
          capacity: 2,
          rate: 1,
        },
      },
      signatureKey: Buffer.from("key"),
      ttl: 120,
    })
  })
})
