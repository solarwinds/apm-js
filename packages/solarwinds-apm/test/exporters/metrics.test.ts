/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import {
	AggregationTemporality,
	AggregationType,
	InstrumentType,
} from "@opentelemetry/sdk-metrics"
import { describe, expect, it } from "@solarwinds-apm/test"

import { type Configuration } from "../../src/config.ts"
import { MetricExporter, MetricReader } from "../../src/exporters/metrics.ts"

describe(MetricExporter.name, () => {
	const exporter = new MetricExporter({
		otlp: { metricsEndpoint: "https://metrics", headers: {} },
	} as unknown as Configuration)
	const reader = new MetricReader({ exporter })

	it("uses proper aggregations", () => {
		expect(reader.selectAggregation(InstrumentType.HISTOGRAM)).to.deep.equal({
			type: AggregationType.EXPONENTIAL_HISTOGRAM,
			options: {
				recordMinMax: true,
			},
		})
	})

	it("uses proper aggregation temporalities", () => {
		for (const component of [exporter, reader]) {
			expect(component.selectAggregationTemporality(InstrumentType.COUNTER)).to.equal(
				AggregationTemporality.DELTA,
			)
			expect(component.selectAggregationTemporality(InstrumentType.GAUGE)).to.equal(
				AggregationTemporality.DELTA,
			)
			expect(component.selectAggregationTemporality(InstrumentType.HISTOGRAM)).to.equal(
				AggregationTemporality.DELTA,
			)
			expect(
				component.selectAggregationTemporality(InstrumentType.OBSERVABLE_COUNTER),
			).to.equal(AggregationTemporality.DELTA)
			expect(component.selectAggregationTemporality(InstrumentType.OBSERVABLE_GAUGE)).to.equal(
				AggregationTemporality.DELTA,
			)
			expect(
				component.selectAggregationTemporality(InstrumentType.OBSERVABLE_UP_DOWN_COUNTER),
			).to.equal(AggregationTemporality.DELTA)
			expect(component.selectAggregationTemporality(InstrumentType.UP_DOWN_COUNTER)).to.equal(
				AggregationTemporality.DELTA,
			)
		}
	})
})
