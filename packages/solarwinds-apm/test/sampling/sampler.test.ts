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

import { context, diag, SpanKind, trace } from "@opentelemetry/api"
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_NETWORK_TRANSPORT,
  ATTR_SERVER_ADDRESS,
  ATTR_URL_PATH,
  ATTR_URL_SCHEME,
} from "@opentelemetry/semantic-conventions"
import {
  BucketType,
  Flags,
  SampleSource,
  type Settings,
} from "@solarwinds-apm/sampling"
import { describe, expect, it, otel } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.js"
import { HEADERS_STORAGE } from "../../src/propagation/headers.js"
import { httpSpanMetadata, Sampler } from "../../src/sampling/sampler.js"
import {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_SCHEME,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_TARGET,
  ATTR_NET_HOST_NAME,
} from "../../src/semattrs.old.js"

class TestSampler extends Sampler {
  constructor(config: Configuration, settings: Settings) {
    super(config, diag)
    this.updateSettings(settings)
  }

  override toString(): string {
    throw new Error("Test sampler")
  }
}

const options = (options: {
  tracing?: boolean
  triggerTrace: boolean
  transactionSettings?: Configuration["transactionSettings"]
}): Configuration =>
  ({
    tracingMode: options.tracing,
    triggerTraceEnabled: options.triggerTrace,
    transactionSettings: options.transactionSettings,
  }) as Configuration

const settings = (options: {
  enabled: boolean
  signatureKey?: Uint8Array
}): Settings => {
  const { enabled, signatureKey } = options

  return {
    sampleRate: 1_000_000,
    sampleSource: SampleSource.Remote,
    flags: enabled
      ? Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS | Flags.TRIGGERED_TRACE
      : 0x0,
    buckets: {
      [BucketType.DEFAULT]: { capacity: 10, rate: 1 },
      [BucketType.TRIGGER_RELAXED]: { capacity: 100, rate: 10 },
      [BucketType.TRIGGER_STRICT]: { capacity: 1, rate: 0.1 },
    },
    signatureKey,
    ttl: 60,
  }
}

describe("httpSpanMetadata", () => {
  it("handles non-http spans properly", () => {
    const span = {
      kind: SpanKind.SERVER,
      attributes: { [ATTR_NETWORK_TRANSPORT]: "udp" },
    }

    const output = httpSpanMetadata(span.kind, span.attributes)
    expect(output).to.deep.equal({ http: false })
  })

  it("handles http client spans properly", () => {
    const span = {
      kind: SpanKind.CLIENT,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: "GET",
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: 200,
        [ATTR_SERVER_ADDRESS]: "solarwinds.com",
        [ATTR_URL_SCHEME]: "https",
        [ATTR_URL_PATH]: "",
      },
    }

    const output = httpSpanMetadata(span.kind, span.attributes)
    expect(output).to.deep.equal({ http: false })
  })

  it("handles http server spans properly", () => {
    const span = {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: "GET",
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: 200,
        [ATTR_SERVER_ADDRESS]: "solarwinds.com",
        [ATTR_URL_SCHEME]: "https",
        [ATTR_URL_PATH]: "",
      },
    }

    const output = httpSpanMetadata(span.kind, span.attributes)
    expect(output).to.deep.equal({
      http: true,
      method: "GET",
      status: 200,
      scheme: "https",
      hostname: "solarwinds.com",
      path: "",
      url: "https://solarwinds.com",
    })
  })

  it("handles legacy http server spans properly", () => {
    const span = {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTR_HTTP_METHOD]: "GET",
        [ATTR_HTTP_STATUS_CODE]: "200",
        [ATTR_HTTP_SCHEME]: "https",
        [ATTR_NET_HOST_NAME]: "solarwinds.com",
        [ATTR_HTTP_TARGET]: "",
      },
    }

    const output = httpSpanMetadata(span.kind, span.attributes)
    expect(output).to.deep.equal({
      http: true,
      method: "GET",
      status: 200,
      scheme: "https",
      hostname: "solarwinds.com",
      path: "",
      url: "https://solarwinds.com",
    })
  })
})

describe("Sampler", () => {
  it("respects enabled settings when no config or transaction settings", async () => {
    const sampler = new TestSampler(
      options({ triggerTrace: false }),
      settings({ enabled: true }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan("test", (span) => {
      expect(span.isRecording()).to.be.true
      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      SampleRate: 1_000_000,
      SampleSource: 6,
      BucketCapacity: 10,
      BucketRate: 1,
    })
  })

  it("respects disabled settings when no config or transaction settings", async () => {
    const sampler = new TestSampler(
      options({ triggerTrace: true }),
      settings({ enabled: false }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan("test", (span) => {
      expect(span.isRecording()).to.be.false
      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.be.empty
  })

  it("respects enabled config when no transaction settings", async () => {
    const sampler = new TestSampler(
      options({ tracing: true, triggerTrace: true }),
      settings({ enabled: false }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan("test", (span) => {
      expect(span.isRecording()).to.be.true
      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      SampleRate: 1_000_000,
      SampleSource: 6,
      BucketCapacity: 10,
      BucketRate: 1,
    })
  })

  it("respects disabled config when no transaction settings", async () => {
    const sampler = new TestSampler(
      options({ tracing: false, triggerTrace: false }),
      settings({ enabled: true }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan("test", (span) => {
      expect(span.isRecording()).to.be.false
      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.be.empty
  })

  it("respects enabled matching transaction setting", async () => {
    const sampler = new TestSampler(
      options({
        tracing: false,
        triggerTrace: false,
        transactionSettings: [{ tracing: true, matcher: () => true }],
      }),
      settings({ enabled: false }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan("test", (span) => {
      expect(span.isRecording()).to.be.true
      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      SampleRate: 1_000_000,
      SampleSource: 6,
      BucketCapacity: 10,
      BucketRate: 1,
    })
  })

  it("respects disabled matching transaction setting", async () => {
    const sampler = new TestSampler(
      options({
        tracing: true,
        triggerTrace: true,
        transactionSettings: [{ tracing: false, matcher: () => true }],
      }),
      settings({ enabled: true }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan("test", (span) => {
      expect(span.isRecording()).to.be.false
      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.be.empty
  })

  it("respects first matching transaction setting", async () => {
    const sampler = new TestSampler(
      options({
        tracing: false,
        triggerTrace: false,
        transactionSettings: [
          { tracing: true, matcher: () => true },
          { tracing: false, matcher: () => true },
        ],
      }),
      settings({ enabled: false }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan("test", (span) => {
      expect(span.isRecording()).to.be.true
      span.end()
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      SampleRate: 1_000_000,
      SampleSource: 6,
      BucketCapacity: 10,
      BucketRate: 1,
    })
  })

  it("matches non-http spans properly", async () => {
    const sampler = new TestSampler(
      options({
        tracing: false,
        triggerTrace: false,
        transactionSettings: [
          { tracing: true, matcher: (name) => name === "CLIENT:test" },
        ],
      }),
      settings({ enabled: false }),
    )
    await otel.reset({ trace: { sampler } })

    trace
      .getTracer("test")
      .startActiveSpan("test", { kind: SpanKind.CLIENT }, (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      SampleRate: 1_000_000,
      SampleSource: 6,
      BucketCapacity: 10,
      BucketRate: 1,
    })
  })

  it("matches http spans properly", async () => {
    const sampler = new TestSampler(
      options({
        tracing: false,
        triggerTrace: false,
        transactionSettings: [
          {
            tracing: true,
            matcher: (name) => name === "http://localhost/test",
          },
        ],
      }),
      settings({ enabled: false }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan(
      "test",
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: "GET",
          [ATTR_URL_SCHEME]: "http",
          [ATTR_SERVER_ADDRESS]: "localhost",
          [ATTR_URL_PATH]: "/test",
        },
      },
      (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      },
    )

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      SampleRate: 1_000_000,
      SampleSource: 6,
      BucketCapacity: 10,
      BucketRate: 1,
    })
  })

  it("matches deprecated http spans properly", async () => {
    const sampler = new TestSampler(
      options({
        tracing: false,
        triggerTrace: false,
        transactionSettings: [
          {
            tracing: true,
            matcher: (name) => name === "http://localhost/test",
          },
        ],
      }),
      settings({ enabled: false }),
    )
    await otel.reset({ trace: { sampler } })

    trace.getTracer("test").startActiveSpan(
      "test",
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_METHOD]: "GET",
          [ATTR_HTTP_SCHEME]: "http",
          [ATTR_NET_HOST_NAME]: "localhost",
          [ATTR_HTTP_TARGET]: "/test",
        },
      },
      (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      },
    )

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      SampleRate: 1_000_000,
      SampleSource: 6,
      BucketCapacity: 10,
      BucketRate: 1,
    })
  })

  it("picks up trigger-trace", async () => {
    const sampler = new TestSampler(
      options({ triggerTrace: true }),
      settings({ enabled: true }),
    )
    await otel.reset({ trace: { sampler } })

    const ctx = HEADERS_STORAGE.set(context.active(), {
      request: { "X-Trace-Options": "trigger-trace" },
      response: {},
    })

    context.with(ctx, () => {
      trace.getTracer("test").startActiveSpan("test", (span) => {
        expect(span.isRecording()).to.be.true
        span.end()
      })
    })

    const spans = await otel.spans()
    expect(spans).to.have.lengthOf(1)
    expect(spans[0]!.attributes).to.include({
      BucketCapacity: 1,
      BucketRate: 0.1,
    })

    expect(HEADERS_STORAGE.get(ctx)?.response).to.include.keys(
      "X-Trace-Options-Response",
    )
  })
})
