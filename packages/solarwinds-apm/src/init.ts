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
  DiagConsoleLogger,
  type DiagLogFunction,
  type DiagLogger,
  metrics,
} from "@opentelemetry/api"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import {
  detectResourcesSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
  Resource,
} from "@opentelemetry/resources"
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  NodeTracerProvider,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-node"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@solarwinds-apm/bindings"
import * as sdk from "@solarwinds-apm/sdk"

import { type ExtendedSwConfiguration, readConfig } from "./config"

export function init() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJson = require("../package.json") as {
    name: string
    version: string
  }
  const id = `${packageJson.name}@${packageJson.version}`
  const initSymbol = Symbol.for(`${id}/init`)

  if (!(initSymbol in globalThis)) {
    Object.defineProperty(globalThis, initSymbol, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    })

    const config = readConfig()

    diag.setLogger(new DiagConsoleLogger(), config.otelLogLevel)
    const initLogger = diag.createComponentLogger({ namespace: "sw/init" })

    if (!config.enabled) {
      initLogger.info("Library disabled, application will not be instrumented")
      return
    }
    if (!config.serviceName) {
      initLogger.warn(
        "Invalid service key, application will not be instrumented",
      )
      return
    }

    const resource = Resource.default()
      .merge(
        detectResourcesSync({
          detectors: [hostDetectorSync, osDetectorSync, processDetectorSync],
        }),
      )
      .merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        }),
      )

    initTracing(config, resource, packageJson.version, initLogger)
    switch (config.runtimeMetrics) {
      case true: {
        initMetrics(config, resource, initLogger)
        break
      }
      case false:
        break
    }
  }
}

function initTracing(
  config: ExtendedSwConfiguration,
  resource: Resource,
  version: string,
  logger: DiagLogger,
) {
  if (sdk.OBOE_ERROR) {
    logger.warn(
      "Unsupported platform, application will not be instrumented",
      sdk.OBOE_ERROR,
    )
    return
  }

  const reporter = sdk.createReporter(config)

  oboe.debug_log_add((module, level, sourceName, sourceLine, message) => {
    const logger = diag.createComponentLogger({
      namespace: `sw/oboe/${module}`,
    })
    const log = oboeLevelToOtelLogger(level, logger)

    if (sourceName && level > oboe.DEBUG_INFO) {
      const source = { source: sourceName, line: sourceLine }
      log(message, source)
    } else {
      log(message)
    }
  }, config.oboeLogLevel)

  sdk.sendStatus(reporter, sdk.initMessage(resource, version))

  const sampler = new sdk.SwSampler(
    config,
    diag.createComponentLogger({ namespace: "sw/sampler" }),
  )
  const exporter = new sdk.SwExporter(
    reporter,
    diag.createComponentLogger({ namespace: "sw/exporter" }),
  )

  const parentInfoProcessor = new sdk.SwParentInfoSpanProcessor()
  const inboundMetricsProcessor = new sdk.SwInboundMetricsSpanProcessor()
  const spanProcessor = new sdk.CompoundSpanProcessor(exporter, [
    parentInfoProcessor,
    inboundMetricsProcessor,
  ])

  const baggagePropagator = new W3CBaggagePropagator()
  const traceContextOptionsPropagator = new sdk.SwTraceContextOptionsPropagator(
    diag.createComponentLogger({ namespace: "sw/propagator" }),
  )
  const propagator = new CompositePropagator({
    propagators: [traceContextOptionsPropagator, baggagePropagator],
  })

  const traceOptionsResponsePropagator =
    new sdk.SwTraceOptionsResponsePropagator()

  const instrumentations = [
    ...getNodeAutoInstrumentations(
      sdk.patch(config.instrumentations?.configs ?? {}, {
        ...config,
        responsePropagator: traceOptionsResponsePropagator,
      }),
    ),
    ...(config.instrumentations?.extra ?? []),
  ]
  registerInstrumentations({ instrumentations })

  const provider = new NodeTracerProvider({
    sampler: new ParentBasedSampler({
      root: sampler,
      remoteParentSampled: sampler,
      remoteParentNotSampled: sampler,
    }),
    resource,
  })
  provider.addSpanProcessor(spanProcessor)
  provider.register({ propagator })
}

function initMetrics(
  config: ExtendedSwConfiguration,
  resource: Resource,
  logger: DiagLogger,
) {
  if (sdk.METRICS_ERROR) {
    logger.warn(
      "Unsupported platform, metrics will not be collected",
      sdk.METRICS_ERROR,
    )
    return
  }

  const exporter = new sdk.SwMetricsExporter(
    diag.createComponentLogger({ namespace: "sw/metrics" }),
  )

  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 60_000,
  })

  const provider = new MeterProvider({
    resource,
    views: config.metricViews,
  })
  provider.addMetricReader(reader)
  metrics.setGlobalMeterProvider(provider)

  sdk.metrics.start()
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
