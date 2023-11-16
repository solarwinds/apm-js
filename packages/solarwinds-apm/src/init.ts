/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

import {
  diag,
  type DiagLogFunction,
  type DiagLogger,
  metrics,
  type TextMapPropagator,
  type TracerProvider,
} from "@opentelemetry/api"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { Resource } from "@opentelemetry/resources"
import {
  MeterProvider,
  type MetricReader,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import { type Sampler, type SpanProcessor } from "@opentelemetry/sdk-trace-base"
import {
  NodeTracerProvider,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-node"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"
import {
  getDetectedResource,
  getInstrumentations,
} from "@solarwinds-apm/instrumentations"
import { lazy } from "@solarwinds-apm/lazy"
import { IS_SERVERLESS } from "@solarwinds-apm/module"
import * as sdk from "@solarwinds-apm/sdk"

import { version } from "../package.json"
import {
  type ExtendedSwConfiguration,
  printError,
  readConfig,
} from "./config.js"
import { setter } from "./symbols.js"

export async function init() {
  // init only once
  const setInit = setter("init")
  if (!setInit) return
  setInit()

  let config: ExtendedSwConfiguration
  try {
    config = readConfig()
  } catch (err) {
    console.warn(
      "Invalid SolarWinds APM configuration, application will not be instrumented",
    )
    printError(err)
    return
  }

  diag.setLogger(new sdk.SwDiagLogger(), config.otelLogLevel)
  const logger = diag.createComponentLogger({ namespace: "[sw/init]" })

  if (!config.enabled) {
    logger.info("Library disabled, application will not be instrumented")
    return
  }
  if (sdk.OBOE_ERROR) {
    logger.warn(
      "Unsupported platform, application will not be instrumented",
      sdk.OBOE_ERROR,
    )
    return
  }

  // initialize instrumentations before any asynchronous code or imports
  const registerInstrumentations = initInstrumentations(config)

  const resource = Resource.default()
    .merge(getDetectedResource())
    .merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      }),
    )
  const reporter = lazy(() => sdk.createReporter(config))

  oboe.debug_log_add((module, level, sourceName, sourceLine, message) => {
    const logger = diag.createComponentLogger({
      namespace: `[sw/oboe/${module}]`,
    })
    const log = oboeLevelToOtelLogger(level, logger)

    if (sourceName && level > oboe.DEBUG_INFO) {
      const source = { source: sourceName, line: sourceLine }
      log(message, source)
    } else {
      log(message)
    }
  }, config.oboeLogLevel)

  const [tracerProvider, meterProvider] = await Promise.all([
    initTracing(config, resource, reporter),
    initMetrics(config, resource, reporter, logger),
    initMessage(config, resource, reporter),
  ])
  registerInstrumentations(tracerProvider, meterProvider)
}

function initInstrumentations(config: ExtendedSwConfiguration) {
  const traceOptionsResponsePropagator =
    new sdk.SwTraceOptionsResponsePropagator()

  const instrumentations = [
    ...getInstrumentations(
      sdk.patch(config.instrumentations.configs ?? {}, {
        ...config,
        responsePropagator: traceOptionsResponsePropagator,
      }),
    ),
    ...(config.instrumentations.extra ?? []),
  ]

  return (tracerProvider: TracerProvider, meterProvider: MeterProvider) =>
    registerInstrumentations({
      instrumentations,
      tracerProvider,
      meterProvider,
    })
}

async function initTracing(
  config: ExtendedSwConfiguration,
  resource: Resource,
  reporter: oboe.Reporter,
) {
  const provider = new NodeTracerProvider({
    sampler: sampler(config),
    resource,
  })

  const processors = await spanProcessors(config, reporter)
  for (const processor of processors) {
    provider.addSpanProcessor(processor)
  }

  provider.register({ propagator: propagator() })

  return provider
}

async function initMetrics(
  config: ExtendedSwConfiguration,
  resource: Resource,
  reporter: oboe.Reporter,
  logger: DiagLogger,
) {
  const provider = new MeterProvider({
    resource,
    views: config.metrics.views,
  })

  const readers = await metricReaders(config, reporter)
  for (const reader of readers) {
    provider.addMetricReader(reader)
  }

  metrics.setGlobalMeterProvider(provider)

  if (config.runtimeMetrics) {
    if (sdk.METRICS_ERROR) {
      logger.warn(
        "Unsupported platform, runtime metrics will not be collected",
        sdk.METRICS_ERROR,
      )
    } else {
      sdk.metrics.start()
    }
  }

  return provider
}

async function initMessage(
  config: ExtendedSwConfiguration,
  resource: Resource,
  reporter: oboe.Reporter,
) {
  if (!config.dev.initMessage) return

  if (resource.asyncAttributesPending) {
    await resource.waitForAsyncAttributes?.()
  }
  sdk.sendStatus(reporter, await sdk.initMessage(resource, version))
}

function sampler(config: ExtendedSwConfiguration): Sampler {
  const sampler = new sdk.SwSampler(
    config,
    diag.createComponentLogger({ namespace: "[sw/sampler]" }),
    IS_SERVERLESS ? new oboe.OboeAPI() : undefined,
  )
  return new ParentBasedSampler({
    root: sampler,
    remoteParentSampled: sampler,
    remoteParentNotSampled: sampler,
  })
}

function propagator(): TextMapPropagator<unknown> {
  const baggagePropagator = new W3CBaggagePropagator()
  const traceContextOptionsPropagator = new sdk.SwTraceContextOptionsPropagator(
    diag.createComponentLogger({ namespace: "[sw/propagator]" }),
  )
  return new CompositePropagator({
    propagators: [traceContextOptionsPropagator, baggagePropagator],
  })
}

async function spanProcessors(
  config: ExtendedSwConfiguration,
  reporter: oboe.Reporter,
): Promise<SpanProcessor[]> {
  const processors: SpanProcessor[] = []

  const parentInfoProcessor = new sdk.SwParentInfoSpanProcessor()
  const inboundMetricsProcessor = new sdk.SwInboundMetricsSpanProcessor()

  if (config.dev.swTraces) {
    const exporter = new sdk.SwExporter(
      reporter,
      diag.createComponentLogger({ namespace: "[sw/exporter]" }),
    )
    processors.push(
      new sdk.CompoundSpanProcessor(exporter, [
        parentInfoProcessor,
        inboundMetricsProcessor,
      ]),
    )
  }

  if (config.dev.otlpTraces) {
    const { SwOtlpExporter } = await import("@solarwinds-apm/sdk/otlp-exporter")
    const exporter = new SwOtlpExporter()
    processors.push(
      // TODO: inboundMetricsProcessor replacement ? is it even necessary here ?
      new sdk.CompoundSpanProcessor(exporter, [parentInfoProcessor]),
    )
  }

  return processors
}

async function metricReaders(
  config: ExtendedSwConfiguration,
  reporter: oboe.Reporter,
): Promise<MetricReader[]> {
  const readers: MetricReader[] = []

  if (config.dev.swMetrics) {
    const exporter = new sdk.SwMetricsExporter(
      reporter,
      diag.createComponentLogger({ namespace: "[sw/metrics]" }),
    )
    readers.push(
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: config.metrics.interval,
      }),
    )
  }

  if (config.dev.otlpMetrics) {
    const { OTLPMetricExporter } = await import(
      "@opentelemetry/exporter-metrics-otlp-grpc"
    )
    const exporter = new OTLPMetricExporter()
    readers.push(
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: config.metrics.interval,
      }),
    )
  }

  return readers
}

export function oboeLevelToOtelLogger(
  level: number,
  logger: DiagLogger,
): DiagLogFunction {
  switch (level) {
    case oboe.DEBUG_ERROR:
      return logger.error.bind(logger)
    case oboe.DEBUG_WARNING:
      return logger.warn.bind(logger)
    case oboe.DEBUG_INFO:
      return logger.info.bind(logger)
    case oboe.DEBUG_LOW:
      return logger.debug.bind(logger)
    default:
      return logger.verbose.bind(logger)
  }
}
