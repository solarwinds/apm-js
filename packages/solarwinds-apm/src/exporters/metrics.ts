/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import {
	type AggregationOption,
	AggregationTemporality,
	AggregationType,
	InstrumentType,
	PeriodicExportingMetricReader,
	type PeriodicExportingMetricReaderOptions,
} from "@opentelemetry/sdk-metrics"

import { type Configuration, exporterConfig } from "./config.ts"

export class MetricExporter extends OTLPMetricExporter {
	constructor(config: Configuration) {
		super(exporterConfig(config, "metrics"))
	}

	override selectAggregationTemporality(): AggregationTemporality {
		return AggregationTemporality.DELTA
	}
}

const DEFAULT_CARDINALITY_LIMIT = 200
export interface MetricReaderOptions extends PeriodicExportingMetricReaderOptions {
	cardinalityLimit?: number
}

export class MetricReader extends PeriodicExportingMetricReader {
	readonly #cardinalityLimit: number

	constructor(options: MetricReaderOptions) {
		super(options)
		this.#cardinalityLimit = options.cardinalityLimit ?? DEFAULT_CARDINALITY_LIMIT
	}

	override selectAggregation(instrumentType: InstrumentType): AggregationOption {
		switch (instrumentType) {
			case InstrumentType.HISTOGRAM: {
				return {
					type: AggregationType.EXPONENTIAL_HISTOGRAM,
					options: {
						recordMinMax: true,
					},
				}
			}
			default: {
				return super.selectAggregation(instrumentType)
			}
		}
	}

	override selectCardinalityLimit(instrumentType: InstrumentType): number {
		return Math.min(super.selectCardinalityLimit(instrumentType), this.#cardinalityLimit)
	}
}
