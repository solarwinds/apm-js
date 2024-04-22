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

import "./plugin.js"

import { metrics, trace } from "@opentelemetry/api"
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
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import {
  type NodeTracerConfig,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"

chai.use(chaiAsPromised)

export { expect } from "chai"
export { after, afterEach, before, beforeEach, describe, it } from "mocha"

let spanExporter: InMemorySpanExporter
let spanProcessor: SimpleSpanProcessor
let tracerProvider: NodeTracerProvider

let metricExporter: InMemoryMetricExporter
let metricReader: PeriodicExportingMetricReader
let meterProvider: MeterProvider

export interface OtelConfig {
  trace?: NodeTracerConfig &
    SDKRegistrationConfig & { processors?: SpanProcessor[] }
  metrics?: MeterProviderOptions
}

function initOtel(config: OtelConfig) {
  trace.disable()
  metrics.disable()

  spanExporter = new InMemorySpanExporter()
  spanProcessor = new SimpleSpanProcessor(spanExporter)

  tracerProvider = new NodeTracerProvider(config.trace)
  for (const processor of [
    ...(config.trace?.processors ?? []),
    spanProcessor,
  ]) {
    tracerProvider.addSpanProcessor(processor)
  }
  tracerProvider.register(config.trace)

  metricExporter = new InMemoryMetricExporter(AggregationTemporality.DELTA)
  metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter })

  meterProvider = new MeterProvider({
    ...config.metrics,
    readers: [...(config.metrics?.readers ?? []), metricReader],
  })
  metrics.setGlobalMeterProvider(meterProvider)
}
initOtel({})

async function resetOtel(config?: OtelConfig) {
  await spanProcessor.forceFlush()
  spanExporter.reset()

  await metricReader.forceFlush()
  metricExporter.reset()

  if (config) {
    initOtel(config)
  }
}
beforeEach(() => resetOtel())

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
  /** Reset OTel, optionally with a custom config */
  reset: (config?: OtelConfig) => resetOtel(config),
})
