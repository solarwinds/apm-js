/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { context, diag, metrics, propagation, trace } from "@opentelemetry/api"
import { logs } from "@opentelemetry/api-logs"
import { ZoneContextManager } from "@opentelemetry/context-zone"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import {
	defaultResource,
	detectResources,
	type Resource,
	resourceFromAttributes,
} from "@opentelemetry/resources"
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs"
import { MeterProvider } from "@opentelemetry/sdk-metrics"
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { getInstrumentations, getResourceDetectors } from "@solarwinds-apm/instrumentations/web"
import { BucketType, Flags, SampleSource } from "@solarwinds-apm/sampling"

import meta from "../../package.json" with { type: "json" }
import { LogExporter } from "../exporters/logs.ts"
import { MetricReader } from "../exporters/metrics.ts"
import { MetricExporter } from "../exporters/metrics.ts"
import { TraceExporter } from "../exporters/traces.ts"
import { LocationProcessor } from "../processing/location.ts"
import { ParentSpanProcessor } from "../processing/parent-span.ts"
import { ResponseTimeProcessor } from "../processing/response-time.ts"
import { TransactionNameProcessor } from "../processing/transaction-name.ts"
import { RequestHeadersPropagator } from "../propagation/headers.ts"
import { TraceContextPropagator } from "../propagation/trace-context.ts"
import { HttpSampler } from "../sampling/http.ts"
import { LOGGER_PROVIDER, METER_PROVIDER, SAMPLER, TRACER_PROVIDER } from "../shared/init.ts"
import { componentLogger } from "../shared/logger.ts"
import { type Configuration, read } from "./config.ts"
import { Logger } from "./logger.ts"

export function init() {
	try {
		const config = read()

		diag.setLogger(new Logger(config), config.logLevel)
		const logger = componentLogger(init)
		logger.debug("config", config)

		if (!config.enabled) {
			logger.warn("Library disabled, application will not be instrumented.")

			SAMPLER.resolve(undefined)
			TRACER_PROVIDER.resolve(undefined)
			METER_PROVIDER.resolve(undefined)
			LOGGER_PROVIDER.resolve(undefined)
			return
		}

		const resource = detectResources({ detectors: getResourceDetectors() })
			.merge(defaultResource())
			.merge(
				resourceFromAttributes({
					[ATTR_SERVICE_NAME]: config.service,
					"sw.data.module": "apm",
					"sw.apm.version": meta.version,
				}),
			)

		const meterProvider = initMetrics(config, resource)
		const tracerProvider = initTracing(config, resource)
		initLogs(config, resource)

		registerInstrumentations({
			instrumentations: getInstrumentations(),
			tracerProvider,
			meterProvider,
		})

		logger.debug("resource", resource.attributes)
	} catch (error) {
		console.error("solarwinds-apm", error)
	}
}

function initTracing(config: Configuration, resource: Resource) {
	const sampler = new HttpSampler(config, {
		sampleRate: 1_000_000,
		sampleSource: SampleSource.LocalDefault,
		flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
		buckets: {
			[BucketType.DEFAULT]: {
				capacity: 10,
				rate: 0,
			},
		},
		timestamp: Math.round(Date.now() / 1000),
		ttl: 10,
	})

	const provider = new TracerProvider({
		resource,
		sampler,
		spanProcessors: [
			new TransactionNameProcessor(config),
			new ResponseTimeProcessor(),
			new BatchSpanProcessor({ exporter: new TraceExporter(config) }),
			new ParentSpanProcessor(),
			new LocationProcessor(),
		],
	})
	trace.setGlobalTracerProvider(provider)

	propagation.setGlobalPropagator(
		new CompositePropagator({
			propagators: [
				new RequestHeadersPropagator(),
				new TraceContextPropagator(),
				new W3CBaggagePropagator(),
			],
		}),
	)

	const contextManager = new ZoneContextManager()
	contextManager.enable()
	context.setGlobalContextManager(contextManager)

	SAMPLER.resolve(sampler)
	TRACER_PROVIDER.resolve(provider)
	return provider
}

function initMetrics(config: Configuration, resource: Resource) {
	const provider = new MeterProvider({
		resource,
		readers: [
			new MetricReader({
				exporter: new MetricExporter(config),
			}),
		],
	})
	metrics.setGlobalMeterProvider(provider)

	METER_PROVIDER.resolve(provider)
	return provider
}

function initLogs(config: Configuration, resource: Resource) {
	if (!config.exportLogsEnabled) {
		LOGGER_PROVIDER.resolve(undefined)
		return
	}

	const provider = new LoggerProvider({
		resource,
		processors: [new BatchLogRecordProcessor({ exporter: new LogExporter(config) })],
	})
	logs.setGlobalLoggerProvider(provider)

	LOGGER_PROVIDER.resolve(provider)
	return provider
}
