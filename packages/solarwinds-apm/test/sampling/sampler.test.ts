/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { context, diag, SpanKind, trace } from "@opentelemetry/api"
import { BucketType, Flags, SampleSource } from "@solarwinds-apm/sampling"
import { describe, expect, it, otel } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.ts"
import { HEADERS_STORAGE } from "../../src/propagation/headers.ts"
import { httpSpanMetadata, parseSettings, Sampler } from "../../src/sampling/sampler.ts"

class TestSampler extends Sampler {
	constructor(config: Configuration, settings: unknown) {
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

const settings = (options: { enabled: boolean; signatureKey?: Uint8Array }): unknown => {
	const { enabled, signatureKey } = options

	return {
		value: 1_000_000,
		flags: enabled ? "SAMPLE_START,SAMPLE_THROUGH_ALWAYS,TRIGGER_TRACE" : "",
		arguments: {
			BucketCapacity: 10,
			BucketRate: 1,
			TriggerRelaxedBucketCapacity: 100,
			TriggerRelaxedBucketRate: 10,
			TriggerStrictBucketCapacity: 1,
			TriggerStrictBucketRate: 0.1,
			SignatureKey: new TextDecoder().decode(signatureKey),
		},
		timestamp: Math.round(Date.now() / 1000),
		ttl: 60,
	}
}

describe(httpSpanMetadata.name, () => {
	it("handles non-http spans properly", () => {
		const span = {
			kind: SpanKind.SERVER,
			attributes: { "network.transport": "udp" },
		}

		const output = httpSpanMetadata(span.kind, span.attributes)
		expect(output).to.deep.equal({ http: false })
	})

	it("handles http client spans properly", () => {
		const span = {
			kind: SpanKind.CLIENT,
			attributes: {
				"http.request.method": "GET",
				"http.response.status_code": 200,
				"server.address": "solarwinds.com",
				"url.scheme": "https",
				"url.path": "",
			},
		}

		const output = httpSpanMetadata(span.kind, span.attributes)
		expect(output).to.deep.equal({ http: false })
	})

	it("handles http server spans properly", () => {
		const span = {
			kind: SpanKind.SERVER,
			attributes: {
				"http.request.method": "GET",
				"http.response.status_code": 200,
				"server.address": "solarwinds.com",
				"url.scheme": "https",
				"url.path": "",
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
				"http.method": "GET",
				"http.status_code": "200",
				"http.scheme": "https",
				"net.host.name": "solarwinds.com",
				"http.target": "",
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

describe(parseSettings.name, () => {
	it("correctly parses JSON settings", () => {
		const timestamp = Math.round(Date.now() / 1000)

		const json = {
			flags: "SAMPLE_START,SAMPLE_THROUGH_ALWAYS,TRIGGER_TRACE,OVERRIDE",
			value: 500_000,
			arguments: {
				BucketCapacity: 0.2,
				BucketRate: 0.1,
				TriggerRelaxedBucketCapacity: 20,
				TriggerRelaxedBucketRate: 10,
				TriggerStrictBucketCapacity: 2,
				TriggerStrictBucketRate: 1,
				SignatureKey: "key",
			},
			timestamp,
			ttl: 120,
			warning: "warning",
		}

		const setting = parseSettings(json)
		expect(setting).to.deep.equal({
			sampleRate: 500_000,
			sampleSource: SampleSource.Remote,
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
			timestamp,
			ttl: 120,
			warning: "warning",
		})
	})
})

describe(Sampler.name, () => {
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
				transactionSettings: [{ tracing: true, matcher: (name) => name === "CLIENT:test" }],
			}),
			settings({ enabled: false }),
		)
		await otel.reset({ trace: { sampler } })

		trace.getTracer("test").startActiveSpan("test", { kind: SpanKind.CLIENT }, (span) => {
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
					"http.request.method": "GET",
					"url.scheme": "http",
					"server.address": "localhost",
					"url.path": "/test",
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
					"http.method": "GET",
					"http.scheme": "http",
					"net.host.name": "localhost",
					"http.target": "/test",
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

		expect(HEADERS_STORAGE.get(ctx)?.response).to.include.keys("X-Trace-Options-Response")
	})
})
