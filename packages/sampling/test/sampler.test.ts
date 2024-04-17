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

import { createHmac, randomBytes } from "node:crypto"

import {
  createTraceState,
  diag,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  trace,
  TraceFlags,
} from "@opentelemetry/api"
import { SamplingDecision } from "@opentelemetry/sdk-trace-base"
import { describe, expect, it } from "@solarwinds-apm/test"

import {
  OboeSampler,
  type SampleParams,
  SpanType,
  spanType,
} from "../src/sampler.js"
import { Flags, type LocalSettings, type Settings } from "../src/settings.js"
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
  parent?: Span
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
    trace.setSpan(ROOT_CONTEXT, object.parent),
    object.parent.spanContext().traceId,
    object.name,
    object.kind,
    {},
    [],
  ]
}

interface MakeRequestHeaders {
  triggerTrace?: boolean
  signature?: boolean | "bad-timestamp"
  signatureKey?: string
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
    options.signatureKey ??= randomBytes(8).toString("hex")
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

interface TestSamplerOptions {
  settings: Settings
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
    this.updateSettings(options.settings)
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
    return "TestSampler"
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
    it("respects parent sampled", () => {
      const sampler = new TestSampler({
        settings: { sampleRate: 0, flags: 0x0, buckets: {} },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const parent = makeSpan({ remote: false, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
    })

    it("respects parent not sampled", () => {
      const sampler = new TestSampler({
        settings: { sampleRate: 0, flags: 0x0, buckets: {} },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      const parent = makeSpan({ remote: false, sampled: false })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.decision).to.equal(SamplingDecision.NOT_RECORD)
    })
  })

  describe("invalid X-Trace-Options-Signature", () => {
    it("rejects missing signature key", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
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
    })

    it("rejects bad timestamp", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          signatureKey: "key",
        },
        localSettings: { triggerMode: true },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          signature: "bad-timestamp",
          signatureKey: "key",
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
    })

    it("rejects bad signature", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 1_000_000,
          flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
          signatureKey: "key1",
        },
        localSettings: { triggerMode: true },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          signature: true,
          signatureKey: "key2",
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
    })
  })

  describe("ENTRY span with valid sw context", () => {
    it("ignores trigger-trace", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          flags: Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
        },
        localSettings: { triggerMode: false },
        requestHeaders: makeRequestHeaders({
          triggerTrace: true,
          kvs: { "custom-key": "value" },
        }),
      })

      const parent = makeSpan({ remote: true, sw: true, sampled: true })
      const params = makeSampleParams({ parent })

      const sample = sampler.shouldSample(...params)
      expect(sample.attributes).to.include({ "custom-key": "value" })
      expect(sampler.responseHeaders?.["X-Trace-Options-Response"]).to.include(
        "trigger-trace=ignored",
      )
    })

    describe("SAMPLE_THROUGH_ALWAYS set", () => {
      const sampler = new TestSampler({
        settings: {
          sampleRate: 0,
          flags: Flags.SAMPLE_THROUGH_ALWAYS,
          buckets: {},
        },
        localSettings: { triggerMode: false },
        requestHeaders: {},
      })

      it("respects parent sampled", () => {
        const parent = makeSpan({ remote: true, sw: true, sampled: true })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
      })

      it("respects parent not sampled", () => {
        const parent = makeSpan({ remote: true, sw: true, sampled: false })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD)
      })

      it("respects sw sampled over w3c not sampled", () => {
        const parent = makeSpan({ remote: true, sw: "inverse", sampled: false })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD_AND_SAMPLED)
      })

      it("respects sw not sampled over w3c sampled", () => {
        const parent = makeSpan({ remote: true, sw: "inverse", sampled: true })
        const params = makeSampleParams({ parent })

        const sample = sampler.shouldSample(...params)
        expect(sample.decision).to.equal(SamplingDecision.RECORD)
      })
    })

    describe("SAMPLE_THROUGH_ALWAYS unset", () => {
      describe("SAMPLE_START set", () =>
        it("records but does not sample", () => {
          const sampler = new TestSampler({
            settings: {
              sampleRate: 0,
              flags: Flags.SAMPLE_START,
              buckets: {},
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
        }))

      describe("SAMPLE_START unset", () =>
        it("does not record or sample", () => {
          const sampler = new TestSampler({
            settings: {
              sampleRate: 0,
              flags: 0x0,
              buckets: {},
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
        }))
    })
  })
})
