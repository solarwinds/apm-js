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

import { setTimeout } from "node:timers/promises"

import {
  diag,
  type DiagLogger,
  metrics,
  type TracerProvider,
} from "@opentelemetry/api"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { detectResourcesSync, Resource } from "@opentelemetry/resources"
import {
  MeterProvider,
  type MetricReader,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  BatchSpanProcessor,
  type Sampler,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { type oboe } from "@solarwinds-apm/bindings"
import {
  getInstrumentations,
  getResource,
} from "@solarwinds-apm/instrumentations"

import { type AppopticsSampler } from "./appoptics/sampler.js"
import { type Configuration, printError, read } from "./config.js"
import { componentLogger, Logger } from "./logger.js"
import { patch } from "./patches.js"
import { ParentSpanProcessor } from "./processing/parent-span.js"
import { ResponseTimeProcessor } from "./processing/response-time.js"
import { TransactionNameProcessor } from "./processing/transaction-name.js"
import {
  RequestHeadersPropagator,
  ResponseHeadersPropagator,
} from "./propagation/headers.js"
import { TraceContextPropagator } from "./propagation/trace-context.js"
import { type GrpcSampler } from "./sampling/grpc.js"
import { VERSION } from "./version.js"

// portion of the public API that depends on initialisation
interface Api {
  waitUntilReady: (timeout: number) => Promise<boolean>
}
export const api: Api = {
  waitUntilReady: () => Promise.resolve(false),
}

export async function init() {
  let config: Configuration
  try {
    config = await read()
  } catch (err) {
    console.warn(
      "Invalid SolarWinds APM configuration, application will not be instrumented.",
    )
    printError(err)
    return
  }

  diag.setLogger(new Logger(), config.logLevel)
  const logger = componentLogger(init)
  logger.debug("working directory", process.cwd())
  logger.debug("config", config)

  if (!config.enabled) {
    logger.warn("Library disabled, application will not be instrumented.")
    return
  }

  const registerInstrumentations = await initInstrumentations(config, logger)
  const resource = Resource.default()
    .merge(
      new Resource({
        [ATTR_SERVICE_NAME]: config.service,
        "sw.data.module": "apm",
        "sw.apm.version": VERSION,
      }),
    )
    .merge(
      getResource(
        config.resourceDetectors.configs ?? {},
        config.resourceDetectors.set!,
      ),
    )
    .merge(
      detectResourcesSync({
        detectors: config.resourceDetectors.extra,
      }),
    )

  let oboe: oboe.Reporter | undefined
  if (config.legacy) {
    logger.debug("using oboe")

    const { reporter, ERROR } = await import("./appoptics/reporter.js")
    if (ERROR) {
      logger.warn(
        "Unsupported platform for AppOptics, application will not be instrumented.",
        ERROR,
      )
      return
    }

    oboe = await reporter(config, resource)
  }

  const meterProvider = await initMetrics(config, resource, oboe, logger)
  const [tracerProvider] = await Promise.all([
    initTracing(config, resource, oboe, logger),
    initLogs(config, resource, logger),
  ])

  registerInstrumentations(tracerProvider, meterProvider)
}

async function initInstrumentations(config: Configuration, logger: DiagLogger) {
  logger.debug("initialising instrumentations")

  const provided = await getInstrumentations(
    patch(config.instrumentations.configs ?? {}, {
      ...config,
      responsePropagator: new ResponseHeadersPropagator(),
    }),
    config.instrumentations.set!,
  )
  const extra = config.instrumentations.extra ?? []

  return (tracerProvider: TracerProvider, meterProvider: MeterProvider) => {
    registerInstrumentations({
      instrumentations: [...provided, ...extra],
      tracerProvider,
      meterProvider,
    })
    logger.debug("initialised instrumentations")
  }
}

async function initTracing(
  config: Configuration,
  resource: Resource,
  oboe: oboe.Reporter | undefined,
  logger: DiagLogger,
) {
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

  if (oboe) {
    const [
      { AppopticsSampler },
      { AppopticsTraceExporter },
      { AppopticsInboundMetricsProcessor },
    ] = await Promise.all([
      import("./appoptics/sampler.js"),
      import("./appoptics/exporters/traces.js"),
      import("./appoptics/processing/inbound-metrics.js"),
    ])

    sampler = new AppopticsSampler(
      config,
      diag.createComponentLogger({ namespace: "[solarwinds-apm / sampler]" }),
    )
    processors = [
      new AppopticsInboundMetricsProcessor(config),
      new BatchSpanProcessor(new AppopticsTraceExporter(oboe)),
      new ParentSpanProcessor(),
    ]

    api.waitUntilReady = (timeout) =>
      Promise.resolve((sampler as AppopticsSampler).isReady(timeout))
  } else {
    const [{ GrpcSampler }, { TraceExporter }] = await Promise.all([
      import("./sampling/grpc.js"),
      import("./exporters/traces.js"),
    ])

    sampler = new GrpcSampler(config)
    processors = [
      new TransactionNameProcessor(config),
      new ResponseTimeProcessor(),
      new BatchSpanProcessor(new TraceExporter(config)),
      new ParentSpanProcessor(),
    ]

    api.waitUntilReady = (timeout) =>
      new Promise((resolve) => {
        void (sampler as GrpcSampler).ready.then(() => {
          resolve(true)
        })
        void setTimeout(timeout).then(() => {
          resolve(false)
        })
      })
  }

  const provider = new NodeTracerProvider({
    sampler,
    resource,
  })
  for (const processor of processors) {
    provider.addSpanProcessor(processor)
  }
  provider.register({ propagator })

  logger.debug("initialised tracing")
  return provider
}

async function initMetrics(
  config: Configuration,
  resource: Resource,
  oboe: oboe.Reporter | undefined,
  logger: DiagLogger,
) {
  logger.debug("initialiing metrics")

  let readers: MetricReader[]

  if (oboe) {
    const { AppopticsMetricExporter } = await import(
      "./appoptics/exporters/metrics.js"
    )
    readers = [
      new PeriodicExportingMetricReader({
        exporter: new AppopticsMetricExporter(oboe),
      }),
    ]
  } else {
    const { MetricExporter } = await import("./exporters/metrics.js")
    readers = [
      new PeriodicExportingMetricReader({
        exporter: new MetricExporter(config),
      }),
    ]
  }

  const provider = new MeterProvider({
    resource,
    readers,
  })
  metrics.setGlobalMeterProvider(provider)

  if (config.runtimeMetrics) {
    logger.debug("initialising runtime metrics")

    const { enable } = await import("./metrics/runtime.js")
    enable()
  }

  logger.debug("initialised metrics")
  return provider
}

async function initLogs(
  config: Configuration,
  resource: Resource,
  logger: DiagLogger,
) {
  if (!config.exportLogsEnabled) return
  logger.debug("initialising logs")

  const [
    { logs },
    { BatchLogRecordProcessor, LoggerProvider },
    { LogExporter },
  ] = await Promise.all([
    import("@opentelemetry/api-logs"),
    import("@opentelemetry/sdk-logs"),
    import("./exporters/logs.js"),
  ])

  const provider = new LoggerProvider({ resource })
  provider.addLogRecordProcessor(
    new BatchLogRecordProcessor(new LogExporter(config)),
  )
  logs.setGlobalLoggerProvider(provider)

  logger.debug("logs initialised")
  return provider
}
