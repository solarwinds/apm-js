/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

import "./plugin.js"

import { setTimeout } from "node:timers/promises"

import {
  context,
  diag,
  type DiagLogFunction,
  type DiagLogger,
  DiagLogLevel,
  metrics,
  propagation,
  trace,
} from "@opentelemetry/api"
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  type MeterProviderOptions,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  InMemorySpanExporter,
  type SDKRegistrationConfig,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import {
  type NodeTracerConfig,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node"
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { afterEach } from "mocha"

chai.use(chaiAsPromised)

export { expect } from "chai"
export { after, afterEach, before, beforeEach, describe, it } from "mocha"

type Log = [message: string, ...args: unknown[]]

export class TestDiagLogger implements DiagLogger {
  readonly error: DiagLogFunction
  readonly warn: DiagLogFunction
  readonly info: DiagLogFunction
  readonly debug: DiagLogFunction
  readonly verbose: DiagLogFunction

  constructor() {
    this.error = this.#log("error")
    this.warn = this.#log("warn")
    this.info = this.#log("info")
    this.debug = this.#log("debug")
    this.verbose = this.#log("verbose")
  }

  #logs: Record<keyof DiagLogger, Log[]> = {
    error: [],
    warn: [],
    info: [],
    debug: [],
    verbose: [],
  }
  #log(level: keyof DiagLogger): DiagLogFunction {
    return (...log) => {
      this.#logs[level].push(log)
      if (process.env.SW_APM_TEST_LOG) {
        console.log(level.toUpperCase().padEnd(7, " "), "|", ...log)
      }
    }
  }

  get logs(): Record<keyof DiagLogger, Log[]> {
    return this.#logs
  }

  reset() {
    this.#logs = { error: [], warn: [], info: [], debug: [], verbose: [] }
  }
}

const diagLogger = new TestDiagLogger()
diag.setLogger(diagLogger, DiagLogLevel.ALL)

let spanExporter: InMemorySpanExporter
let spanProcessor: SimpleSpanProcessor
let tracerProvider: NodeTracerProvider
let shouldResetTrace = true

let metricExporter: InMemoryMetricExporter
let metricReader: PeriodicExportingMetricReader
let meterProvider: MeterProvider
let shouldResetMetrics = true

export interface OtelConfig {
  trace?: NodeTracerConfig & SDKRegistrationConfig
  metrics?: MeterProviderOptions
}

async function resetOtel(config: OtelConfig = {}) {
  if (shouldResetTrace || config.trace) {
    shouldResetTrace = Boolean(config.trace)

    context.disable()
    propagation.disable()
    trace.disable()

    spanExporter = new InMemorySpanExporter()
    spanProcessor = new SimpleSpanProcessor(spanExporter)
    ;((config.trace ??= {}).spanProcessors ??= []).push(spanProcessor)

    tracerProvider = new NodeTracerProvider(config.trace)
    tracerProvider.register(config.trace)
  } else {
    await spanProcessor.forceFlush()
    spanExporter.reset()
  }

  if (shouldResetMetrics || config.metrics) {
    shouldResetMetrics = Boolean(config.metrics)

    metrics.disable()

    metricExporter = new InMemoryMetricExporter(AggregationTemporality.DELTA)
    metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
    })

    meterProvider = new MeterProvider({
      ...config.metrics,
      readers: [...(config.metrics?.readers ?? []), metricReader],
    })
    metrics.setGlobalMeterProvider(meterProvider)
  } else {
    await metricReader.forceFlush()
    metricExporter.reset()
  }
}
void resetOtel()
afterEach(() => resetOtel())

export const otel = Object.freeze({
  /** Spans processed during the current test */
  spans: async () => {
    await spanProcessor.forceFlush()
    return spanExporter.getFinishedSpans()
  },
  /** Metrics processed during the current test */
  metrics: async () => {
    await metricReader.forceFlush()
    return metricExporter.getMetrics()
  },
  /** Logs processed during the current test */
  get logs() {
    return diagLogger.logs
  },
  /** Reset OTel, optionally with a custom config */
  reset: (config?: OtelConfig) => resetOtel(config),
})

beforeEach(async function () {
  const CURRENT_RETRY = "currentRetry"
  const currentRetry = this.currentTest?.[CURRENT_RETRY]()

  if (currentRetry) {
    this.timeout(1000 + this.timeout())
    await setTimeout(currentRetry * 1000)
  }
})
