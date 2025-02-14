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

import { diag, metrics } from "@opentelemetry/api"
import { logs } from "@opentelemetry/api-logs"
import { ZoneContextManager } from "@opentelemetry/context-zone"
import { CompositePropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { Resource } from "@opentelemetry/resources"
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs"
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  BatchSpanProcessor,
  WebTracerProvider,
} from "@opentelemetry/sdk-trace-web"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import {
  getInstrumentations,
  getResource,
} from "@solarwinds-apm/instrumentations/web"
import { BucketType, Flags, SampleSource } from "@solarwinds-apm/sampling"

import { LogExporter } from "../exporters/logs.js"
import { MetricExporter } from "../exporters/metrics.js"
import { TraceExporter } from "../exporters/traces.js"
import { LocationProcessor } from "../processing/location.js"
import { ParentSpanProcessor } from "../processing/parent-span.js"
import { ResponseTimeProcessor } from "../processing/response-time.js"
import { TransactionNameProcessor } from "../processing/transaction-name.js"
import { RequestHeadersPropagator } from "../propagation/headers.js"
import { TraceContextPropagator } from "../propagation/trace-context.js"
import { HttpSampler } from "../sampling/http.js"
import { SAMPLER } from "../shared/init.js"
import { componentLogger } from "../shared/logger.js"
import { VERSION } from "../version.js"
import { type Configuration, read } from "./config.js"
import { Logger } from "./logger.js"

export function init() {
  try {
    const config = read()

    diag.setLogger(new Logger(), config.logLevel)
    const logger = componentLogger(init)
    logger.debug("config", config)

    const resource = Resource.default()
      .merge(
        new Resource({
          [ATTR_SERVICE_NAME]: config.service,
          "sw.data.module": "apm",
          "sw.apm.version": VERSION,
        }),
      )
      .merge(getResource())

    const meterProvider = initMetrics(config, resource)
    const tracerProvider = initTracing(config, resource)
    initLogs(config, resource)

    registerInstrumentations({
      instrumentations: getInstrumentations(),
      tracerProvider,
      meterProvider,
    })

    logger.debug("resource", resource.attributes)
  } catch (error) {
    console.error("solarwinds-apm", error)
  }
}

function initTracing(config: Configuration, resource: Resource) {
  const sampler = new HttpSampler(config, {
    sampleRate: 1_000_000,
    sampleSource: SampleSource.LocalDefault,
    flags: Flags.SAMPLE_START | Flags.SAMPLE_THROUGH_ALWAYS,
    buckets: {
      [BucketType.DEFAULT]: {
        capacity: 10,
        rate: 0,
      },
    },
    timestamp: Math.round(Date.now() / 1000),
    ttl: 10,
  })
  SAMPLER.resolve(sampler)

  const provider = new WebTracerProvider({
    resource,
    sampler,
    spanProcessors: [
      new TransactionNameProcessor(config),
      new ResponseTimeProcessor(),
      new BatchSpanProcessor(new TraceExporter(config)),
      new ParentSpanProcessor(),
      new LocationProcessor(),
    ],
  })
  provider.register({
    contextManager: new ZoneContextManager(),
    propagator: new CompositePropagator({
      propagators: [
        new RequestHeadersPropagator(),
        new TraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    }),
  })

  return provider
}

function initMetrics(config: Configuration, resource: Resource) {
  const provider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new MetricExporter(config),
      }),
    ],
  })
  metrics.setGlobalMeterProvider(provider)

  return provider
}

function initLogs(config: Configuration, resource: Resource) {
  if (!config.exportLogsEnabled) {
    return
  }

  const provider = new LoggerProvider({
    resource,
  })
  provider.addLogRecordProcessor(
    new BatchLogRecordProcessor(new LogExporter(config)),
  )
  logs.setGlobalLoggerProvider(provider)

  return provider
}
