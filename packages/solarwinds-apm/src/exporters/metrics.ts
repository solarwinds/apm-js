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

import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import {
  Aggregation,
  AggregationTemporality,
  ExponentialHistogramAggregation,
  InstrumentType,
  PeriodicExportingMetricReader,
  type PeriodicExportingMetricReaderOptions,
} from "@opentelemetry/sdk-metrics"

import { type Configuration } from "../shared/config.js"

export class MetricExporter extends OTLPMetricExporter {
  constructor(config: Configuration & { trustedpath?: string }) {
    super({
      url: config.otlp.metrics,
      headers: config.headers,
      httpAgentOptions: {
        ca: config.trustedpath,
      },
    })
  }

  override selectAggregation(instrumentType: InstrumentType): Aggregation {
    switch (instrumentType) {
      case InstrumentType.HISTOGRAM: {
        return new ExponentialHistogramAggregation(undefined, true)
      }
      default: {
        return Aggregation.Default()
      }
    }
  }

  override selectAggregationTemporality(): AggregationTemporality {
    return AggregationTemporality.DELTA
  }
}

const DEFAULT_CARDINALITY_LIMIT = 200
export interface MetricReaderOptions
  extends PeriodicExportingMetricReaderOptions {
  cardinalityLimit?: number
}

export class MetricReader extends PeriodicExportingMetricReader {
  readonly #cardinalityLimit: number

  constructor(options: MetricReaderOptions) {
    super(options)
    this.#cardinalityLimit =
      options.cardinalityLimit ?? DEFAULT_CARDINALITY_LIMIT
  }

  override selectCardinalityLimit(instrumentType: InstrumentType): number {
    return Math.min(
      super.selectCardinalityLimit(instrumentType),
      this.#cardinalityLimit,
    )
  }
}
