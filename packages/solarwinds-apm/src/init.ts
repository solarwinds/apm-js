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

import { createRequire } from "node:module"

import { diag, type DiagLogger, metrics } from "@opentelemetry/api"
import { logs } from "@opentelemetry/api-logs"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import {
  defaultResource,
  detectResources,
  type Resource,
  resourceFromAttributes,
} from "@opentelemetry/resources"
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs"
import { MeterProvider } from "@opentelemetry/sdk-metrics"
import {
  BatchSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import {
  getInstrumentations,
  getResourceDetectors,
} from "@solarwinds-apm/instrumentations"

import log from "./commonjs/log.js"
import { type Configuration, printError, read } from "./config.js"
import { environment } from "./env.js"
import { MetricReader } from "./exporters/metrics.js"
import { Logger } from "./logger.js"
import { enableRuntimeMetrics } from "./metrics.js"
import { patch, patchEnv } from "./patches.js"
import { ParentSpanProcessor } from "./processing/parent-span.js"
import { ResponseTimeProcessor } from "./processing/response-time.js"
import { StacktraceProcessor } from "./processing/stacktrace.js"
import { TransactionNameProcessor } from "./processing/transaction-name.js"
import {
  RequestHeadersPropagator,
  ResponseHeadersPropagator,
} from "./propagation/headers.js"
import { TraceContextPropagator } from "./propagation/trace-context.js"
import { type Sampler } from "./sampling/sampler.js"
import {
  LOGGER_PROVIDER,
  METER_PROVIDER,
  SAMPLER,
  TRACER_PROVIDER,
} from "./shared/init.js"
import { componentLogger } from "./shared/logger.js"
import { VERSION } from "./version.js"

const require = createRequire(import.meta.url)

export function init(): boolean {
  let config: Configuration
  try {
    config = read()
  } catch (err) {
    log(
      "Invalid SolarWinds APM configuration, application will not be instrumented.",
    )
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
        "sw.apm.version": VERSION,
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

  return true
}

function initTracing(
  config: Configuration,
  resource: Resource,
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

  if (environment.IS_AWS_LAMBDA) {
    const { JsonSampler } =
      require("./sampling/json.js") as typeof import("./sampling/json.js")
    const { TraceExporter } =
      require("./exporters/traces.js") as typeof import("./exporters/traces.js")

    sampler = new JsonSampler(config, "/tmp/solarwinds-apm-settings.json")
    processors = [
      new TransactionNameProcessor(config),
      new ResponseTimeProcessor(),
      new BatchSpanProcessor(new TraceExporter(config)),
      new ParentSpanProcessor(),
      new StacktraceProcessor(config),
    ]
  } else {
    const { HttpSampler } =
      require("./sampling/http.js") as typeof import("./sampling/http.js")
    const { TraceExporter } =
      require("./exporters/traces.js") as typeof import("./exporters/traces.js")

    sampler = new HttpSampler(config)
    processors = [
      new TransactionNameProcessor(config),
      new ResponseTimeProcessor(),
      new BatchSpanProcessor(new TraceExporter(config)),
      new ParentSpanProcessor(),
      new StacktraceProcessor(config),
    ]
  }

  const provider = new NodeTracerProvider({
    resource,
    sampler,
    spanProcessors: processors,
  })
  provider.register({ propagator })

  SAMPLER.resolve(sampler)
  TRACER_PROVIDER.resolve(provider)
  logger.debug("initialised tracing")
  return provider
}

function initMetrics(
  config: Configuration,
  resource: Resource,
  logger: DiagLogger,
) {
  logger.debug("initialiing metrics")

  const { MetricExporter } =
    require("./exporters/metrics.js") as typeof import("./exporters/metrics.js")
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

function initLogs(
  config: Configuration,
  resource: Resource,
  logger: DiagLogger,
) {
  if (!config.exportLogsEnabled) {
    LOGGER_PROVIDER.resolve(undefined)
    return
  }
  logger.debug("initialising logs")

  const { LogExporter } =
    require("./exporters/logs.js") as typeof import("./exporters/logs.js")

  const provider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(new LogExporter(config))],
  })
  logs.setGlobalLoggerProvider(provider)

  LOGGER_PROVIDER.resolve(provider)
  logger.debug("logs initialised")
  return provider
}
