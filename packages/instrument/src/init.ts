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
import { Resource } from "@opentelemetry/resources"
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  NodeTracerProvider,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-node"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"
import { oboe } from "@swotel/bindings"
import * as sdk from "@swotel/sdk"

import { type ExtendedSwoConfiguration, readConfig } from "./config"

export function init(configName: string) {
  /* eslint-disable-next-line ts/no-var-requires */
  const pkg = require("../package.json") as { name: string; version: string }
  const id = `${pkg.name}@${pkg.version}`
  const initSymbol = Symbol.for(`${id}/init`)

  if (!(initSymbol in globalThis)) {
    Object.defineProperty(globalThis, initSymbol, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    })

    const config = readConfig(configName)

    diag.setLogger(new DiagConsoleLogger(), config.otelLogLevel)
    const initLogger = diag.createComponentLogger({ namespace: "swo/init" })

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

    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      }),
    )

    initTracing(config, resource, initLogger)
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
  config: ExtendedSwoConfiguration,
  resource: Resource,
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
      namespace: `swo/oboe/${module}`,
    })
    const log = oboeLevelToOtelLogger(level, logger)

    if (sourceName && level > oboe.DEBUG_INFO) {
      const source = { source: sourceName, line: sourceLine }
      log(message, source)
    } else {
      log(message)
    }
  }, config.oboeLogLevel)

  const sampler = new sdk.SwoSampler(
    config,
    diag.createComponentLogger({ namespace: "swo/sampler" }),
  )
  const exporter = new sdk.SwoExporter(
    reporter,
    diag.createComponentLogger({ namespace: "swo/exporter" }),
  )

  const parentInfoProcessor = new sdk.SwoParentInfoSpanProcessor()
  const inboundMetricsProcessor = new sdk.SwoInboundMetricsSpanProcessor()
  const spanProcessor = new sdk.CompoundSpanProcessor(exporter, [
    parentInfoProcessor,
    inboundMetricsProcessor,
  ])

  const baggagePropagator = new W3CBaggagePropagator()
  const traceContextOptionsPropagator =
    new sdk.SwoTraceContextOptionsPropagator(
      diag.createComponentLogger({ namespace: "swo/propagator" }),
    )
  const propagator = new CompositePropagator({
    propagators: [traceContextOptionsPropagator, baggagePropagator],
  })

  const traceOptionsResponsePropagator =
    new sdk.SwoTraceOptionsResponsePropagator()

  const instrumentations = getNodeAutoInstrumentations({
    "@opentelemetry/instrumentation-bunyan": {
      enabled: config.insertTraceContextIntoLogs,
    },
    "@opentelemetry/instrumentation-pino": {
      enabled: config.insertTraceContextIntoLogs,
    },
    ...config.instrumentations,
  })
  sdk.patch(instrumentations, { traceOptionsResponsePropagator })
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
  config: ExtendedSwoConfiguration,
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

  const exporter = new sdk.SwoMetricsExporter(
    diag.createComponentLogger({ namespace: "swo/metrics" }),
  )

  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 60_000,
  })

  const provider = new MeterProvider({
    resource,
    views: config.views,
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
