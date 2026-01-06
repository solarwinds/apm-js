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

import { createHmac, randomBytes } from "node:crypto"
import { setTimeout } from "node:timers/promises"

import {
  createTraceState,
  diag,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  trace,
  TraceFlags,
} from "@opentelemetry/api"
import { DataPointType } from "@opentelemetry/sdk-metrics"
import { SamplingDecision } from "@opentelemetry/sdk-trace-base"
import { describe, expect, it, otel } from "@solarwinds-apm/test"

import {
  OboeSampler,
  type SampleParams,
  SpanType,
  spanType,
} from "../src/sampler.js"
import {
  BucketType,
  Flags,
  type LocalSettings,
  SampleSource,
  type Settings,
} from "../src/settings.js"
import {
  type RequestHeaders,
  type ResponseHeaders,
} from "../src/trace-options.js"

interface MakeSpan {
  name?: string
  traceId?: string
  id?: string

  remote?: boolean
  sampled?: boolean

  /**
   * Whether to generate a sw tracestate field.
   * "inverse" will generate a field that contradicts the W3C trace flags.
   */
  sw?: boolean | "inverse"
}
const makeSpan = (options: MakeSpan = {}): Span => {
  const object = {
    name: options.name ?? "span",
    traceId: options.traceId ?? randomBytes(16).toString("hex"),
    id: options.id ?? randomBytes(8).toString("hex"),

    remote: options.remote,
    sampled: options.sampled ?? true,
  }

  const swFlags =
    options.sw === "inverse"
      ? object.sampled
        ? "00"
        : "01"
      : object.sampled
        ? "01"
        : "00"

  return {
    spanContext: () => ({
      traceId: object.traceId,
      spanId: object.id,
      isRemote: object.remote,
      traceFlags: object.sampled ? TraceFlags.SAMPLED : TraceFlags.NONE,
      traceState: options.sw
        ? createTraceState(`sw=${object.id}-${swFlags}`)
        : undefined,
    }),
  } as Span
}

interface MakeSampleParams {
  parent?: Span | false
  name?: string
  kind?: SpanKind
}
const makeSampleParams = (options: MakeSampleParams = {}): SampleParams => {
  const object = {
    parent: options.parent ?? makeSpan({ name: "parent span" }),
    name: options.name ?? "child span",
    kind: options.kind ?? SpanKind.INTERNAL,
  }

  return [
    object.parent ? trace.setSpan(ROOT_CONTEXT, object.parent) : ROOT_CONTEXT,
    object.parent
      ? object.parent.spanContext().traceId
      : randomBytes(16).toString("hex"),
    object.name,
    object.kind,
    {},
    [],
  ]
}

interface MakeRequestHeaders {
  triggerTrace?: boolean
  signature?: boolean | "bad-timestamp"
  signatureKey?: Uint8Array
  kvs?: Record<string, string>
}
const makeRequestHeaders = (
  options: MakeRequestHeaders = {},
): RequestHeaders => {
  if (!options.triggerTrace && !options.kvs && !options.signature) {
    return {}
  }

  let timestamp = Date.now() / 1000
  if (options.signature === "bad-timestamp") {
    timestamp -= 10 * 60
  }
  const ts = `ts=${timestamp.toFixed(0)}`

  const triggerTrace = options.triggerTrace && "trigger-trace"
  const kvs = options.kvs
    ? Object.entries(options.kvs).map(([k, v]) => `${k}=${v}`)
    : []

  const headers: RequestHeaders = {
    "X-Trace-Options": [triggerTrace, ...kvs, ts].filter((v) => v).join(";"),
  }

  if (options.signature) {
    options.signatureKey ??= randomBytes(8)
    headers["X-Trace-Options-Signature"] = createHmac(
      "sha1",
      options.signatureKey,
    )
      .update(headers["X-Trace-Options"]!)
      .digest()
      .toString("hex")
  }

  return headers
}

const checkCounters = async (counters: string[]) => {
  const remaining = new Set(counters)
  const metrics = (await otel.metrics())
    .flatMap(({ scopeMetrics }) => scopeMetrics)
    .flatMap(({ metrics }) => metrics)

  while (remaining.size && metrics.length) {
    const metric = metrics.pop()!
    const name = metric.descriptor.name

    expect(remaining).to.include(name)
    remaining.delete(name)

    expect(metric.dataPointType).to.equal(DataPointType.SUM)
    expect(metric.dataPoints).to.have.lengthOf(1)
    expect(metric.dataPoints[0]).to.include({ value: 1 })
  }

  expect(remaining).to.be.empty
  expect(metrics).to.be.empty
}

interface TestSamplerOptions {
  settings: Settings | false
  localSettings: LocalSettings
  requestHeaders: RequestHeaders
}
class TestSampler extends OboeSampler {
  #localSettings: LocalSettings
  #requestHeaders: RequestHeaders
  #responseHeaders: ResponseHeaders | undefined

  get responseHeaders() {
    return this.#responseHeaders
  }

  constructor(options: TestSamplerOptions) {
    super(diag)
    this.#localSettings = options.localSettings
    this.#requestHeaders = options.requestHeaders
    if (options.settings) {
      this.updateSettings(options.settings)
    }
  }

  override localSettings(): LocalSettings {
    return this.#localSettings
  }

  override requestHeaders(): RequestHeaders {
    return this.#requestHeaders
  }
  override setResponseHeaders(headers: ResponseHeaders): void {
    this.#responseHeaders = headers
  }

  override toString(): string {
    return "Test sampler"
  }
}

describe("spanType", () => {
  it("identifies no parent as ROOT", () => {
    const type = spanType(undefined)
    expect(type).to.equal(SpanType.ROOT)
  })

  it("identifies invalid parent as ROOT", () => {
    const parent = makeSpan({ id: "woops" })

    const type = spanType(parent)
    expect(type).to.equal(SpanType.ROOT)
  })

  it("identifies remote parent as ENTRY", () => {
    const parent = makeSpan({ remote: true })

    const type = spanType(parent)
    expect(type).to.equal(SpanType.ENTRY)
  })

  it("identifies local parent as LOCAL", () => {
    const parent = makeSpan({ remote: false })

    const type = spanType(parent)
    expect(type).to.equal(SpanType.LOCAL)
  })
})

describe("OboeSampler", () => {
  describe("LOCAL span", () => {
    it("respects parent sampled", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: 0x0,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const parent = makeSpan({ remote: false, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)

      await checkCounters([])
    })

    it("respects parent not sampled", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: 0x0,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const parent = makeSpan({ remote: false, sampled: false })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)

      await checkCounters([])
    })
  })

  describe("invalid X-Trace-Options-Signature", () => {
    it("rejects missing signature key", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          sampleSource: SampleSource.Remote,
          flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: true },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          signature: true,
          kvs: { "custom-key": "value" },
        }),
      })

      const parent = makeSpan({ remote: true, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)
      expect(sample.attributes).to.be.undefined
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"]).to.include(
        "auth=no-signature-key",
      )

      await checkCounters(["trace.service.request_count"])
    })

    it("rejects bad timestamp", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          sampleSource: SampleSource.Remote,
          flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          signatureKey: Buffer.from("key"),
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: true },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          signature: "bad-timestamp",
          signatureKey: Buffer.from("key"),
          kvs: { "custom-key": "value" },
        }),
      })

      const parent = makeSpan({ remote: true, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)
      expect(sample.attributes).to.be.undefined
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"]).to.include(
        "auth=bad-timestamp",
      )

      await checkCounters(["trace.service.request_count"])
    })

    it("rejects bad signature", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          sampleSource: SampleSource.Remote,
          flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          signatureKey: Buffer.from("key1"),
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: true },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          signature: true,
          signatureKey: Buffer.from("key2"),
          kvs: { "custom-key": "value" },
        }),
      })

      const parent = makeSpan({ remote: true, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)
      expect(sample.attributes).to.be.undefined
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"]).to.include(
        "auth=bad-signature",
      )

      await checkCounters(["trace.service.request_count"])
    })
  })

  describe("missing settings", () => {
    it("doesn't sample", async () => {
      const sampler = new TestSampler({
        settings: false,
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const params = makeSampleParams({ parent: false })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)

      await checkCounters(["trace.service.request_count"])
    })

    it("expires after ttl", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000) - 60,
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const parent = makeSpan({ remote: true, sw: true, sampled: true })
      const params = makeSampleParams({ parent })

      await setTimeout(10)
      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)

      await checkCounters(["trace.service.request_count"])
    })

    it("respects X-Trace-Options keys and values", () => {
      const sampler = new TestSampler({
        settings: false,
        localSettings: { triggerMode: false },
        requestHeaders: makeRequestHeaders({
          kvs: { "custom-key": "value", "sw-keys": "sw-values" },
        }),
      })

      const params = makeSampleParams({ parent: false })

      const sample = sampler.shouldSample(...params)
      expect(sample.attributes).to.include({
        "custom-key": "value",
        SWKeys: "sw-values",
      })
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"]).to.include(
        "trigger-trace=not-requested",
      )
    })

    it("ignores trigger-trace", () => {
      const sampler = new TestSampler({
        settings: false,
        localSettings: { triggerMode: true },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          kvs: { "custom-key": "value", "invalid-key": "value" },
        }),
      })

      const params = makeSampleParams({ parent: false })

      const sample = sampler.shouldSample(...params)
      expect(sample.attributes).to.include({ "custom-key": "value" })
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"])
        .to.include("trigger-trace=settings-not-available")
        .and.to.include("ignored=invalid-key")
    })
  })

  describe("ENTRY span with valid sw context", () => {
    describe("X-Trace-Options", () => {
      it("respects keys and values", () => {
        const sampler = new TestSampler({
          settings: {
            sampleRate: 0,
            sampleSource: SampleSource.LocalDefault,
            flags: Flags.SAMPLE_THROUGH_ALWAYS,
            buckets: {},
            timestamp: Math.round(Date.now() / 1000),
            ttl: 10,
          },
          localSettings: { triggerMode: false },
          requestHeaders: makeRequestHeaders({
            kvs: { "custom-key": "value", "sw-keys": "sw-values" },
          }),
        })

        const parent = makeSpan({ remote: true, sw: true, sampled: true })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.attributes).to.include({
          "custom-key": "value",
          SWKeys: "sw-values",
        })
        expect(
          sampler.responseHeaders?.["X-Trace-Options-Response"],
        ).to.include("trigger-trace=not-requested")
      })

      it("ignores trigger-trace", () => {
        const sampler = new TestSampler({
          settings: {
            sampleRate: 0,
            sampleSource: SampleSource.LocalDefault,
            flags: Flags.SAMPLE_THROUGH_ALWAYS,
            buckets: {},
            timestamp: Math.round(Date.now() / 1000),
            ttl: 10,
          },
          localSettings: { triggerMode: true },
          requestHeaders: makeRequestHeaders({
            triggerTrace: true,
            kvs: { "custom-key": "value", "invalid-key": "value" },
          }),
        })

        const parent = makeSpan({ remote: true, sw: true, sampled: true })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.attributes).to.include({ "custom-key": "value" })
        expect(sampler.responseHeaders?.["X-Trace-Options-Response"])
          .to.include("trigger-trace=ignored")
          .and.to.include("ignored=invalid-key")
      })
    })

    describe("SAMPLE_THROUGH_ALWAYS set", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      it("respects parent sampled", async () => {
        const parent = makeSpan({ remote: true, sw: true, sampled: true })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
        expect(sample.attributes).to.include({
          "sw.tracestate_parent_id": parent.spanContext().spanId,
        })

        await checkCounters([
          "trace.service.request_count",
          "trace.service.tracecount",
          "trace.service.through_trace_count",
        ])
      })

      it("respects parent not sampled", async () => {
        const parent = makeSpan({ remote: true, sw: true, sampled: false })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD)
        expect(sample.attributes).to.include({
          "sw.tracestate_parent_id": parent.spanContext().spanId,
        })

        await checkCounters(["trace.service.request_count"])
      })

      it("respects sw sampled over w3c not sampled", async () => {
        const parent = makeSpan({ remote: true, sw: "inverse", sampled: false })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
        expect(sample.attributes).to.include({
          "sw.tracestate_parent_id": parent.spanContext().spanId,
        })

        await checkCounters([
          "trace.service.request_count",
          "trace.service.tracecount",
          "trace.service.through_trace_count",
        ])
      })

      it("respects sw not sampled over w3c sampled", async () => {
        const parent = makeSpan({ remote: true, sw: "inverse", sampled: true })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD)
        expect(sample.attributes).to.include({
          "sw.tracestate_parent_id": parent.spanContext().spanId,
        })

        await checkCounters(["trace.service.request_count"])
      })
    })

    describe("SAMPLE_THROUGH_ALWAYS unset", () => {
      it("records but does not sample when SAMPLE_START set", async () => {
        const sampler = new TestSampler({
          settings: {
            sampleRate: 0,
            sampleSource: SampleSource.LocalDefault,
            flags: Flags.SAMPLE_START,
            buckets: {},
            timestamp: Math.round(Date.now() / 1000),
            ttl: 10,
          },
          localSettings: { triggerMode: false },
          requestHeaders: {},
        })

        const parent = makeSpan({
          remote: true,
          sw: true,
          sampled: true,
        })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD)

        await checkCounters(["trace.service.request_count"])
      })

      it("does not record or sample when SAMPLE_START unset", async () => {
        const sampler = new TestSampler({
          settings: {
            sampleRate: 0,
            sampleSource: SampleSource.LocalDefault,
            flags: 0x0,
            buckets: {},
            timestamp: Math.round(Date.now() / 1000),
            ttl: 10,
          },
          localSettings: { triggerMode: false },
          requestHeaders: {},
        })

        const parent = makeSpan({
          remote: true,
          sw: true,
          sampled: true,
        })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)

        await checkCounters(["trace.service.request_count"])
      })
    })
  })

  describe("trigger-trace requested", () => {
    describe("TRIGGERED_TRACE set", () => {
      describe("unsigned", () => {
        it("records and samples when there is capacity", async () => {
          const sampler = new TestSampler({
            settings: {
              sampleRate: 0,
              sampleSource: SampleSource.LocalDefault,
              flags: Flags.SAMPLE_START | Flags.TRIGGERED_TRACE,
              buckets: {
                TriggerStrict: { capacity: 10, rate: 5 },
                TriggerRelaxed: { capacity: 0, rate: 0 },
              },
              timestamp: Math.round(Date.now() / 1000),
              ttl: 10,
            },
            localSettings: { triggerMode: true },
            requestHeaders: makeRequestHeaders({
              triggerTrace: true,
              kvs: { "custom-key": "value", "sw-keys": "sw-values" },
            }),
          })

          const parent = makeSpan({ remote: true, sampled: true })
          const params = makeSampleParams({ parent })

          const sample = sampler.shouldSample(...params)
          expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
          expect(sample.attributes).to.include({
            "custom-key": "value",
            SWKeys: "sw-values",
            BucketCapacity: 10,
            BucketRate: 5,
          })
          expect(
            sampler.responseHeaders?.["X-Trace-Options-Response"],
          ).to.include("trigger-trace=ok")

          await checkCounters([
            "trace.service.request_count",
            "trace.service.tracecount",
            "trace.service.triggered_trace_count",
          ])
        })

        it("records but doesn't sample when there is no capacity", async () => {
          const sampler = new TestSampler({
            settings: {
              sampleRate: 0,
              sampleSource: SampleSource.LocalDefault,
              flags: Flags.SAMPLE_START | Flags.TRIGGERED_TRACE,
              buckets: {
                TriggerStrict: { capacity: 0, rate: 0 },
                TriggerRelaxed: { capacity: 20, rate: 10 },
              },
              timestamp: Math.round(Date.now() / 1000),
              ttl: 10,
            },
            localSettings: { triggerMode: true },
            requestHeaders: makeRequestHeaders({
              triggerTrace: true,
              kvs: { "custom-key": "value", "invalid-key": "value" },
            }),
          })

          const parent = makeSpan({ remote: true, sampled: true })
          const params = makeSampleParams({ parent })

          const sample = sampler.shouldSample(...params)
          expect(sample.decision).to.equal(SamplingDecision.RECORD)
          expect(sample.attributes).to.include({
            "custom-key": "value",
            BucketCapacity: 0,
            BucketRate: 0,
          })
          expect(sampler.responseHeaders?.["X-Trace-Options-Response"])
            .to.include("trigger-trace=rate-exceeded")
            .and.to.include("ignored=invalid-key")

          await checkCounters(["trace.service.request_count"])
        })
      })

      describe("signed", () => {
        it("records and samples when there is capacity", async () => {
          const sampler = new TestSampler({
            settings: {
              sampleRate: 0,
              sampleSource: SampleSource.LocalDefault,
              flags: Flags.SAMPLE_START | Flags.TRIGGERED_TRACE,
              buckets: {
                TriggerStrict: { capacity: 0, rate: 0 },
                TriggerRelaxed: { capacity: 20, rate: 10 },
              },
              signatureKey: Buffer.from("key"),
              timestamp: Math.round(Date.now() / 1000),
              ttl: 10,
            },
            localSettings: { triggerMode: true },
            requestHeaders: makeRequestHeaders({
              triggerTrace: true,
              kvs: { "custom-key": "value", "sw-keys": "sw-values" },
              signature: true,
              signatureKey: Buffer.from("key"),
            }),
          })

          const parent = makeSpan({ remote: true, sampled: true })
          const params = makeSampleParams({ parent })

          const sample = sampler.shouldSample(...params)
          expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
          expect(sample.attributes).to.include({
            "custom-key": "value",
            SWKeys: "sw-values",
            BucketCapacity: 20,
            BucketRate: 10,
          })
          expect(sampler.responseHeaders?.["X-Trace-Options-Response"])
            .to.include("auth=ok")
            .and.to.include("trigger-trace=ok")

          await checkCounters([
            "trace.service.request_count",
            "trace.service.tracecount",
            "trace.service.triggered_trace_count",
          ])
        })

        it("records but doesn't sample when there is no capacity", async () => {
          const sampler = new TestSampler({
            settings: {
              sampleRate: 0,
              sampleSource: SampleSource.LocalDefault,
              flags: Flags.SAMPLE_START | Flags.TRIGGERED_TRACE,
              buckets: {
                TriggerStrict: { capacity: 10, rate: 5 },
                TriggerRelaxed: { capacity: 0, rate: 0 },
              },
              signatureKey: Buffer.from("key"),
              timestamp: Math.round(Date.now() / 1000),
              ttl: 10,
            },
            localSettings: { triggerMode: true },
            requestHeaders: makeRequestHeaders({
              triggerTrace: true,
              kvs: { "custom-key": "value", "invalid-key": "value" },
              signature: true,
              signatureKey: Buffer.from("key"),
            }),
          })

          const parent = makeSpan({ remote: true, sampled: true })
          const params = makeSampleParams({ parent })

          const sample = sampler.shouldSample(...params)
          expect(sample.decision).to.equal(SamplingDecision.RECORD)
          expect(sample.attributes).to.include({
            "custom-key": "value",
            BucketCapacity: 0,
            BucketRate: 0,
          })
          expect(sampler.responseHeaders?.["X-Trace-Options-Response"])
            .to.include("auth=ok")
            .and.to.include("trigger-trace=rate-exceeded")
            .and.to.include("ignored=invalid-key")

          await checkCounters(["trace.service.request_count"])
        })
      })
    })

    describe("TRIGGERED_TRACE unset", () =>
      it("record but does not sample when TRIGGERED_TRACE unset", async () => {
        const sampler = new TestSampler({
          settings: {
            sampleRate: 0,
            sampleSource: SampleSource.LocalDefault,
            flags: Flags.SAMPLE_START,
            buckets: {},
            timestamp: Math.round(Date.now() / 1000),
            ttl: 10,
          },
          localSettings: { triggerMode: false },
          requestHeaders: makeRequestHeaders({
            triggerTrace: true,
            kvs: { "custom-key": "value", "invalid-key": "value" },
          }),
        })

        const parent = makeSpan({ remote: true, sampled: true })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD)
        expect(sample.attributes).to.include({ "custom-key": "value" })
        expect(sampler.responseHeaders?.["X-Trace-Options-Response"])
          .to.include("trigger-trace=trigger-tracing-disabled")
          .and.to.include("ignored=invalid-key")

        await checkCounters(["trace.service.request_count"])
      }))
  })

  describe("dice roll", () => {
    it("respects X-Trace-Options keys and values", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: Flags.SAMPLE_START,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: makeRequestHeaders({
          kvs: { "custom-key": "value", "sw-keys": "sw-values" },
        }),
      })

      const parent = makeSpan({ remote: true, sampled: false })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.attributes).to.include({
        "custom-key": "value",
        SWKeys: "sw-values",
      })
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"]).to.include(
        "trigger-trace=not-requested",
      )
    })

    it("records and samples when dice success and sufficient capacity", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          sampleSource: SampleSource.Remote,
          flags: Flags.SAMPLE_START,
          buckets: { [BucketType.DEFAULT]: { capacity: 10, rate: 5 } },
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const params = makeSampleParams({ parent: false })
      const sample = sampler.shouldSample(...params)

      expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
      expect(sample.attributes).to.include({
        SampleRate: 1_000_000,
        SampleSource: 6,
        BucketCapacity: 10,
        BucketRate: 5,
      })

      await checkCounters([
        "trace.service.request_count",
        "trace.service.samplecount",
        "trace.service.tracecount",
      ])
    })

    it("records but doesn't sample when dice success but insufficient capacity", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          sampleSource: SampleSource.Remote,
          flags: Flags.SAMPLE_START,
          buckets: { [BucketType.DEFAULT]: { capacity: 0, rate: 0 } },
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const params = makeSampleParams({ parent: false })
      const sample = sampler.shouldSample(...params)

      expect(sample.decision).to.equal(SamplingDecision.RECORD)
      expect(sample.attributes).to.include({
        SampleRate: 1_000_000,
        SampleSource: 6,
        BucketCapacity: 0,
        BucketRate: 0,
      })

      await checkCounters([
        "trace.service.request_count",
        "trace.service.samplecount",
        "trace.service.tokenbucket_exhaustion_count",
      ])
    })

    it("records but doesn't sample when dice failure", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: Flags.SAMPLE_START,
          buckets: { [BucketType.DEFAULT]: { capacity: 10, rate: 5 } },
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const params = makeSampleParams({ parent: false })
      const sample = sampler.shouldSample(...params)

      expect(sample.decision).to.equal(SamplingDecision.RECORD)
      expect(sample.attributes).to.include({ SampleRate: 0, SampleSource: 2 })
      expect(sample.attributes).not.to.have.property("BucketCapacity")
      expect(sample.attributes).not.to.have.property("BucketRate")

      await checkCounters([
        "trace.service.request_count",
        "trace.service.samplecount",
      ])
    })
  })

  describe("SAMPLE_START unset", () => {
    it("ignores trigger-trace", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: 0x0,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: true },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          kvs: { "custom-key": "value", "invalid-key": "value" },
        }),
      })

      const parent = makeSpan({ remote: true, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.attributes).to.include({ "custom-key": "value" })
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"])
        .to.include("trigger-trace=tracing-disabled")
        .and.to.include("ignored=invalid-key")
    })

    it("records when SAMPLE_THROUGH_ALWAYS set", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const parent = makeSpan({ remote: true, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.RECORD)

      await checkCounters(["trace.service.request_count"])
    })

    it("doesn't record when SAMPLE_THROUGH_ALWAYS unset", async () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          sampleSource: SampleSource.LocalDefault,
          flags: 0x0,
          buckets: {},
          timestamp: Math.round(Date.now() / 1000),
          ttl: 10,
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const parent = makeSpan({ remote: true, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)

      await checkCounters(["trace.service.request_count"])
    })
  })
})
