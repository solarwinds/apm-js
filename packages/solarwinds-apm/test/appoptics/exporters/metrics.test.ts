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

import {
  AggregationTemporality,
  ExponentialHistogramAggregation,
  InstrumentType,
} from "@opentelemetry/sdk-metrics"
import { describe, expect, it } from "@solarwinds-apm/test"

import { AppopticsMetricExporter } from "../../../src/appoptics/exporters/metrics.js"

describe(AppopticsMetricExporter.name, () => {
  const exporter = new AppopticsMetricExporter(null!)

  it("uses proper aggregations", () => {
    expect(
      exporter.selectAggregation(InstrumentType.HISTOGRAM),
    ).to.be.instanceof(ExponentialHistogramAggregation)
  })

  it("uses proper aggregation temporalities", () => {
    expect(
      exporter.selectAggregationTemporality(InstrumentType.COUNTER),
    ).to.equal(AggregationTemporality.CUMULATIVE)
    expect(
      exporter.selectAggregationTemporality(InstrumentType.GAUGE),
    ).to.equal(AggregationTemporality.CUMULATIVE)
    expect(
      exporter.selectAggregationTemporality(InstrumentType.HISTOGRAM),
    ).to.equal(AggregationTemporality.DELTA)
    expect(
      exporter.selectAggregationTemporality(InstrumentType.OBSERVABLE_COUNTER),
    ).to.equal(AggregationTemporality.CUMULATIVE)
    expect(
      exporter.selectAggregationTemporality(InstrumentType.OBSERVABLE_GAUGE),
    ).to.equal(AggregationTemporality.CUMULATIVE)
    expect(
      exporter.selectAggregationTemporality(
        InstrumentType.OBSERVABLE_UP_DOWN_COUNTER,
      ),
    ).to.equal(AggregationTemporality.CUMULATIVE)
    expect(
      exporter.selectAggregationTemporality(InstrumentType.UP_DOWN_COUNTER),
    ).to.equal(AggregationTemporality.CUMULATIVE)
  })
})
