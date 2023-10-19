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
  type TracerProvider,
} from "@opentelemetry/api"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { Resource } from "@opentelemetry/resources"
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-node"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"
import {
  getDetectedResource,
  getInstrumentations,
} from "@solarwinds-apm/instrumentations"
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

  // initialize instrumentations before any asynchronous code
  const registerInstrumentations = initInstrumentations(config)

  const resource = Resource.default()
    .merge(getDetectedResource())
    .merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      }),
    )
  const reporter = sdk.createReporter(config)

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
    initMessage(resource, reporter),
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
  const sampler = new sdk.SwSampler(
    config,
    diag.createComponentLogger({ namespace: "[sw/sampler]" }),
  )
  const exporter = new sdk.SwExporter(
    reporter,
    diag.createComponentLogger({ namespace: "[sw/exporter]" }),
  )

  const parentInfoProcessor = new sdk.SwParentInfoSpanProcessor()
  const inboundMetricsProcessor = new sdk.SwInboundMetricsSpanProcessor()
  const spanProcessor = new sdk.CompoundSpanProcessor(exporter, [
    parentInfoProcessor,
    inboundMetricsProcessor,
  ])

  const baggagePropagator = new W3CBaggagePropagator()
  const traceContextOptionsPropagator = new sdk.SwTraceContextOptionsPropagator(
    diag.createComponentLogger({ namespace: "[sw/propagator]" }),
  )
  const propagator = new CompositePropagator({
    propagators: [traceContextOptionsPropagator, baggagePropagator],
  })

  const provider = new NodeTracerProvider({
    sampler: new ParentBasedSampler({
      root: sampler,
      remoteParentSampled: sampler,
      remoteParentNotSampled: sampler,
    }),
    resource,
  })

  if (config.experimental.swTraces) {
    provider.addSpanProcessor(spanProcessor)
  }
  if (config.experimental.otlpTraces) {
    const otlp = await import("@opentelemetry/exporter-trace-otlp-grpc").catch(
      () => undefined,
    )
    if (otlp) {
      const { OTLPTraceExporter } = otlp
      provider.addSpanProcessor(
        new BatchSpanProcessor(
          // configurable through standard OTel environment
          new OTLPTraceExporter(),
        ),
      )
    }
  }

  provider.register({ propagator })

  return provider
}

async function initMetrics(
  config: ExtendedSwConfiguration,
  resource: Resource,
  reporter: oboe.Reporter,
  logger: DiagLogger,
) {
  const exporter = new sdk.SwMetricsExporter(
    reporter,
    diag.createComponentLogger({ namespace: "[sw/metrics]" }),
  )

  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: config.metrics.interval,
  })

  const provider = new MeterProvider({
    resource,
    views: config.metrics.views,
  })

  if (config.experimental.swMetrics) {
    provider.addMetricReader(reader)
  }
  if (config.experimental.otlpMetrics) {
    const otlp = await import(
      "@opentelemetry/exporter-metrics-otlp-grpc"
    ).catch(() => undefined)
    if (otlp) {
      const { OTLPMetricExporter } = otlp
      provider.addMetricReader(
        new PeriodicExportingMetricReader({
          // configurable through standard OTel environment
          exporter: new OTLPMetricExporter(),
          exportIntervalMillis: config.metrics.interval,
        }),
      )
    }
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

async function initMessage(resource: Resource, reporter: oboe.Reporter) {
  if (resource.asyncAttributesPending) {
    await resource.waitForAsyncAttributes?.()
  }
  sdk.sendStatus(reporter, await sdk.initMessage(resource, version))
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
