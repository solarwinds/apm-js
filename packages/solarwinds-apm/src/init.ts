/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { context, diag, type DiagLogger, metrics, propagation, trace } from "@opentelemetry/api"
import { logs } from "@opentelemetry/api-logs"
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
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
import {
	BatchSpanProcessor,
	type SpanProcessor,
	TracerProvider,
} from "@opentelemetry/sdk-trace"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { getInstrumentations, getResourceDetectors } from "@solarwinds-apm/instrumentations"

import meta from "../package.json" with { type: "json" }
import { type Configuration, printError, read } from "./config.ts"
import { environment } from "./env.ts"
import { LogExporter } from "./exporters/logs.ts"
import { MetricExporter, MetricReader } from "./exporters/metrics.ts"
import { TraceExporter } from "./exporters/traces.ts"
import log from "./log.ts"
import { Logger } from "./logger.ts"
import { enableRuntimeMetrics } from "./metrics.ts"
import { patch, patchEnv } from "./patches.ts"
import { ParentSpanProcessor } from "./processing/parent-span.ts"
import { ResponseTimeProcessor } from "./processing/response-time.ts"
import { StacktraceProcessor } from "./processing/stacktrace.ts"
import { TransactionNameProcessor } from "./processing/transaction-name.ts"
import { RequestHeadersPropagator, ResponseHeadersPropagator } from "./propagation/headers.ts"
import { TraceContextPropagator } from "./propagation/trace-context.ts"
import { HttpSampler } from "./sampling/http.ts"
import { JsonSampler } from "./sampling/json.ts"
import { type Sampler } from "./sampling/sampler.ts"
import { LOGGER_PROVIDER, METER_PROVIDER, SAMPLER, TRACER_PROVIDER } from "./shared/init.ts"
import { componentLogger } from "./shared/logger.ts"

export function init(): boolean {
	let config: Configuration
	try {
		config = read()
	} catch (err) {
		log("Invalid SolarWinds APM configuration, application will not be instrumented.")
		printError(err)
		return false
	}

	diag.setLogger(new Logger(config), config.logLevel)
	const logger = componentLogger(init)
	logger.debug("working directory", process.cwd())
	logger.debug("config", config)

	if (!config.enabled) {
		logger.warn("Library disabled, application will not be instrumented.")
		return false
	}
	patchEnv(config)
	patch(
		config.instrumentations.configs,
		config.resourceDetectors.configs,
		{
			...config,
			responsePropagator: new ResponseHeadersPropagator(),
		},
		logger,
	)

	const instrumentations = getInstrumentations(
		config.instrumentations.configs,
		config.instrumentations.set,
	)
	const detectors = getResourceDetectors(
		config.resourceDetectors.configs,
		config.resourceDetectors.set,
	)

	const resource = defaultResource()
		.merge(
			detectResources({
				detectors: [...detectors, ...config.resourceDetectors.extra],
			}),
		)
		.merge(
			resourceFromAttributes({
				[ATTR_SERVICE_NAME]: config.service,
				"sw.data.module": "apm",
				"sw.apm.version": meta.version,
			}),
		)

	const meterProvider = initMetrics(config, resource, logger)
	const tracerProvider = initTracing(config, resource, logger)
	initLogs(config, resource, logger)

	registerInstrumentations({
		instrumentations: [...instrumentations, ...config.instrumentations.extra],
		tracerProvider,
		meterProvider,
	})

	let exited = false
	Object.entries({
		SIGINT: 2,
		SIGTERM: 15,
		beforeExit: -128,
	}).map(([signal, code]) =>
		process.once(signal, () => {
			if (exited) return
			exited = true

			void Promise.all([TRACER_PROVIDER, METER_PROVIDER, LOGGER_PROVIDER])
				.then((providers) =>
					Promise.all(providers.map((provider) => provider?.shutdown() ?? Promise.resolve())),
				)
				.finally(() => process.exit(128 + code))
		}),
	)

	return true
}

export function initNoop() {
	;[SAMPLER, TRACER_PROVIDER, METER_PROVIDER, LOGGER_PROVIDER].map((c) => {
		c.resolve(undefined)
	})
}

function initTracing(config: Configuration, resource: Resource, logger: DiagLogger) {
	logger.debug("initialising tracing")

	let sampler: Sampler
	let processors: SpanProcessor[]
	const propagator = new CompositePropagator({
		propagators: [
			new RequestHeadersPropagator(),
			new TraceContextPropagator(),
			new W3CBaggagePropagator(),
		],
	})
	const contextManager = new AsyncLocalStorageContextManager()

	if (environment.IS_AWS_LAMBDA) {
		sampler = new JsonSampler(config, "/tmp/solarwinds-apm-settings.json")
		processors = [
			new TransactionNameProcessor(config),
			new ResponseTimeProcessor(),
			new BatchSpanProcessor({ exporter: new TraceExporter(config) }),
			new ParentSpanProcessor(),
			new StacktraceProcessor(config),
		]
	} else {
		sampler = new HttpSampler(config)
		processors = [
			new TransactionNameProcessor(config),
			new ResponseTimeProcessor(),
			new BatchSpanProcessor({ exporter: new TraceExporter(config) }),
			new ParentSpanProcessor(),
			new StacktraceProcessor(config),
		]
	}

	const provider = new TracerProvider({
		resource,
		sampler,
		spanProcessors: processors,
	})
	trace.setGlobalTracerProvider(provider)
	propagation.setGlobalPropagator(propagator)
	contextManager.enable()
	context.setGlobalContextManager(contextManager)

	SAMPLER.resolve(sampler)
	TRACER_PROVIDER.resolve(provider)
	logger.debug("initialised tracing")
	return provider
}

function initMetrics(config: Configuration, resource: Resource, logger: DiagLogger) {
	logger.debug("initialisng metrics")

	const readers: MetricReader[] = [
		new MetricReader({
			exporter: new MetricExporter(config),
		}),
	]

	const provider = new MeterProvider({
		resource,
		readers,
	})
	metrics.setGlobalMeterProvider(provider)

	if (config.runtimeMetrics) {
		logger.debug("initialising runtime metrics")
		enableRuntimeMetrics()
	}

	METER_PROVIDER.resolve(provider)
	logger.debug("initialised metrics")
	return provider
}

function initLogs(config: Configuration, resource: Resource, logger: DiagLogger) {
	if (!config.exportLogsEnabled) {
		LOGGER_PROVIDER.resolve(undefined)
		return
	}
	logger.debug("initialising logs")

	const provider = new LoggerProvider({
		resource,
		processors: [new BatchLogRecordProcessor({ exporter: new LogExporter(config) })],
	})
	logs.setGlobalLoggerProvider(provider)

	LOGGER_PROVIDER.resolve(provider)
	logger.debug("logs initialised")
	return provider
}
