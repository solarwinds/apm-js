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
import { logs } from "@opentelemetry/api-logs"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import {
  type Instrumentation,
  registerInstrumentations,
} from "@opentelemetry/instrumentation"
import { Resource } from "@opentelemetry/resources"
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  type LogRecordProcessor,
} from "@opentelemetry/sdk-logs"
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
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"
import {
  getDetectedResource,
  getInstrumentations,
} from "@solarwinds-apm/instrumentations"
import { IS_SERVERLESS } from "@solarwinds-apm/module"
import * as sdk from "@solarwinds-apm/sdk"

import {
  type ExtendedSwConfiguration,
  printError,
  readConfig,
} from "./config.js"
import { FULL_VERSION } from "./version.js"

export async function init() {
  let config
  try {
    config = readConfig()
    if (config instanceof Promise) config = await config
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
  let registerInstrumentations = initInstrumentations(config)
  if (registerInstrumentations instanceof Promise) {
    registerInstrumentations = await registerInstrumentations
  }

  let resource = Resource.default().merge(
    new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      "sw.data.module": "apm",
      "sw.apm.version": FULL_VERSION,
    }),
  )
  resource = resource.merge(
    await getDetectedResource(config.dev.extraResourceDetection),
  )

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
    initLogs(config, resource),
    initMessage(config, resource, reporter),
  ])
  registerInstrumentations(tracerProvider, meterProvider)
}

function initInstrumentations(config: ExtendedSwConfiguration) {
  const traceOptionsResponsePropagator =
    new sdk.SwTraceOptionsResponsePropagator()

  const registrer = (instrumentations: Instrumentation[]) => {
    instrumentations = [
      ...instrumentations,
      ...(config.instrumentations.extra ?? []),
    ]

    return (tracerProvider: TracerProvider, meterProvider: MeterProvider) =>
      registerInstrumentations({
        instrumentations,
        tracerProvider,
        meterProvider,
      })
  }

  const instrumentations = getInstrumentations(
    sdk.patch(config.instrumentations.configs ?? {}, {
      ...config,
      responsePropagator: traceOptionsResponsePropagator,
    }),
    config.dev.instrumentationsDefaultDisabled,
  )

  if (instrumentations instanceof Promise)
    return instrumentations.then(registrer)
  else return registrer(instrumentations)
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

async function initLogs(config: ExtendedSwConfiguration, resource: Resource) {
  if (!config.exportLogsEnabled) return

  const provider = new LoggerProvider({ resource })

  const processors = await logRecordProcessors(config)
  for (const processor of processors) {
    provider.addLogRecordProcessor(processor)
  }

  logs.setGlobalLoggerProvider(provider)

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
  sdk.sendStatus(reporter, await sdk.initMessage(resource, FULL_VERSION))
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
    const { TraceExporter } = await import("./exporters/traces.js")
    const exporter = new TraceExporter(config)

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
    const { MetricExporter } = await import("./exporters/metrics.js")
    const exporter = new MetricExporter(config)
    readers.push(
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: config.metrics.interval,
      }),
    )
  }

  return readers
}

async function logRecordProcessors(
  config: ExtendedSwConfiguration,
): Promise<LogRecordProcessor[]> {
  const { LogExporter } = await import("./exporters/logs.js")
  return [new BatchLogRecordProcessor(new LogExporter(config))]
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
