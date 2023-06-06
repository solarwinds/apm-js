import { diag, DiagConsoleLogger } from "@opentelemetry/api"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { Resource } from "@opentelemetry/resources"
import {
  NodeTracerProvider,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-node"
import * as sdk from "@swotel/sdk"

import { readConfig } from "./config/file"
import { createReporter } from "./config/oboe"

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
    const reporter = createReporter(config)

    diag.setLogger(new DiagConsoleLogger(), config.logLevel)
    const logger = diag.createComponentLogger({ namespace: "swo" })
    if (sdk.OBOE_ERROR) {
      logger.warn(
        "Unsupported platform, application will not be instrumented",
        sdk.OBOE_ERROR,
      )
      return
    }

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

    const instrumentations = getNodeAutoInstrumentations()
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
