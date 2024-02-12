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
import { IS_SERVERLESS } from "@solarwinds-apm/module"
import * as sdk from "@solarwinds-apm/sdk"

import { version } from "../package.json"
import {
  type ExtendedSwConfiguration,
  printError,
  readConfig,
} from "./config.js"

export async function init() {
  let config: ExtendedSwConfiguration
  try {
    const configOrPromise = readConfig()
    if (configOrPromise instanceof Promise) config = await configOrPromise
    else config = configOrPromise
  } catch (err) {
    console.warn(
      "Invalid SolarWinds APM configuration, application will not be instrumented",
    )
    printError(err)
    return
  }

  diag.setLogger(new sdk.SwDiagLogger(), config.otelLogLevel)
  const logger = diag.createComponentLogger({ namespace: "[sw/init]" })
  logger.debug(`CWD is ${process.cwd()}`)
  logger.debug("SolarWinds APM configuration", config)

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

  let resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      "sw.data.module": "apm",
    }),
  )
  if (config.dev.resourceDetection) {
    resource = resource.merge(getDetectedResource())
  }

  const [reporter, serverlessApi] = IS_SERVERLESS
    ? [undefined, sdk.createServerlessApi(config)]
    : [sdk.createReporter(config), undefined]

  oboe.debug_log_add((level, sourceName, sourceLine, message) => {
    const logger = diag.createComponentLogger({
      namespace: `[sw/oboe]`,
    })
    const log = oboeLevelToOtelLogger(level, logger)

    if (sourceName && level > oboe.INIT_LOG_LEVEL_INFO) {
      const source = { source: sourceName, line: sourceLine }
      log(message, source)
    } else {
      log(message)
    }
  }, config.oboeLogLevel)

  const [tracerProvider, meterProvider] = await Promise.all([
    initTracing(config, resource, reporter, serverlessApi),
    initMetrics(config, resource, logger, reporter),
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
  reporter: oboe.Reporter | undefined,
  serverlessApi: oboe.OboeAPI | undefined,
) {
  const provider = new NodeTracerProvider({
    sampler: sampler(config, serverlessApi),
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
  logger: DiagLogger,
  reporter: oboe.Reporter | undefined,
) {
  const readers = await metricReaders(config, reporter)

  const provider = new MeterProvider({
    resource,
    readers,
    views: [...sdk.metrics.views, ...config.metrics.views],
  })

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
  reporter: oboe.Reporter | undefined,
) {
  if (!config.dev.initMessage || !reporter) return

  if (resource.asyncAttributesPending) {
    await resource.waitForAsyncAttributes?.()
  }
  sdk.sendStatus(reporter, await sdk.initMessage(resource, version))
}

function sampler(
  config: ExtendedSwConfiguration,
  serverlessApi: oboe.OboeAPI | undefined,
): Sampler {
  const sampler = new sdk.SwSampler(
    config,
    diag.createComponentLogger({ namespace: "[sw/sampler]" }),
    serverlessApi,
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
  reporter: oboe.Reporter | undefined,
): Promise<SpanProcessor[]> {
  const processors: SpanProcessor[] = []
  const logger = diag.createComponentLogger({ namespace: "[sw/processor]" })

  const parentInfoProcessor = new sdk.SwParentInfoSpanProcessor()

  if (config.dev.swTraces) {
    const exporter = new sdk.SwExporter(
      config,
      reporter!,
      diag.createComponentLogger({ namespace: "[sw/exporter]" }),
    )
    const inboundMetricsProcessor = new sdk.SwInboundMetricsSpanProcessor()
    processors.push(
      new sdk.CompoundSpanProcessor(
        exporter,
        [parentInfoProcessor, inboundMetricsProcessor],
        logger,
      ),
    )
  }

  if (config.dev.otlpTraces) {
    const { SwOtlpExporter } = await import("@solarwinds-apm/sdk/otlp-exporter")
    const exporter = new SwOtlpExporter(config)

    const responseTimeProcessor = new sdk.SwResponseTimeProcessor(config)
    const transactionNameProcessor = new sdk.SwTransactionNameProcessor()

    processors.push(
      new sdk.CompoundSpanProcessor(
        exporter,
        [parentInfoProcessor, responseTimeProcessor, transactionNameProcessor],
        logger,
      ),
    )
  }

  return processors
}

async function metricReaders(
  config: ExtendedSwConfiguration,
  reporter: oboe.Reporter | undefined,
): Promise<MetricReader[]> {
  const readers: MetricReader[] = []

  if (config.dev.swMetrics) {
    const exporter = new sdk.SwMetricsExporter(
      reporter!,
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
    const { SwOtlpMetricsExporter } = await import(
      "@solarwinds-apm/sdk/otlp-metrics-exporter"
    )
    const exporter = new SwOtlpMetricsExporter()
    readers.push(
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: config.metrics.interval,
      }),
    )
  }

  return readers
}

// https://github.com/boostorg/log/blob/boost-1.82.0/include/boost/log/trivial.hpp#L42-L50
export function oboeLevelToOtelLogger(
  level: number,
  logger: DiagLogger,
): DiagLogFunction {
  switch (level) {
    case 0:
      return logger.verbose.bind(logger)
    case 1:
      return logger.debug.bind(logger)
    case 2:
      return logger.info.bind(logger)
    case 3:
      return logger.warn.bind(logger)
    case 4:
    case 5:
    default:
      return logger.error.bind(logger)
  }
}
