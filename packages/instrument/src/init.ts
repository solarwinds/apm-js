import { diag, DiagConsoleLogger } from "@opentelemetry/api"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { Resource } from "@opentelemetry/resources"
import {
  NodeTracerProvider,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-node"
import { oboe } from "@swotel/bindings"
import * as sdk from "@swotel/sdk"

import { readConfig } from "./config/file"
import {
  createReporter,
  oboeLevelToOtelLogger,
  otelLevelToOboeLevel,
} from "./config/oboe"

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
    if (!config.enabled) {
      console.info("Library disabled, application will not be instrumented")
      return
    }

    diag.setLogger(new DiagConsoleLogger(), config.logLevel)
    if (sdk.OBOE_ERROR) {
      diag
        .createComponentLogger({ namespace: "swo/init" })
        .warn(
          "Unsupported platform, application will not be instrumented",
          sdk.OBOE_ERROR,
        )
      return
    }

    const reporter = createReporter(config)

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
    }, otelLevelToOboeLevel(config.logLevel))

    const sampler = new sdk.SwoSampler(
      config,
      diag.createComponentLogger({ namespace: "swo/sampler" }),
    )
    const traceExporter = new sdk.SwoExporter(
      reporter,
      diag.createComponentLogger({ namespace: "swo/exporter" }),
    )

    const parentInfoProcessor = new sdk.SwoParentInfoSpanProcessor()
    const inboundMetricsProcessor = new sdk.SwoInboundMetricsSpanProcessor()
    const spanProcessor = new sdk.CompoundSpanProcessor(traceExporter, [
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
        enabled: config.insertTraceIdsIntoLogs,
      },
      "@opentelemetry/instrumentation-pino": {
        enabled: config.insertTraceIdsIntoLogs,
      },
    })
    sdk.patch(instrumentations, { traceOptionsResponsePropagator })
    registerInstrumentations({ instrumentations })

    const provider = new NodeTracerProvider({
      sampler: new ParentBasedSampler({
        root: sampler,
        remoteParentSampled: sampler,
        remoteParentNotSampled: sampler,
      }),
      resource: Resource.default(),
    })
    provider.addSpanProcessor(spanProcessor)
    provider.register({ propagator })
  }
}
