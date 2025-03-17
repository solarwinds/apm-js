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

import { type Configuration } from "../../src/config.js"
import { MetricExporter, MetricReader } from "../../src/exporters/metrics.js"

describe(MetricReader.name, () => {
  const reader = new MetricReader({
    exporter: new MetricExporter({
      otlp: { metricsEndpoint: "https://metrics", headers: {} },
    } as unknown as Configuration),
  })

  it("uses proper aggregations", () => {
    expect(reader.selectAggregation(InstrumentType.HISTOGRAM)).to.be.instanceof(
      ExponentialHistogramAggregation,
    )
  })

  it("uses proper aggregation temporalities", () => {
    expect(
      reader.selectAggregationTemporality(InstrumentType.COUNTER),
    ).to.equal(AggregationTemporality.DELTA)
    expect(reader.selectAggregationTemporality(InstrumentType.GAUGE)).to.equal(
      AggregationTemporality.DELTA,
    )
    expect(
      reader.selectAggregationTemporality(InstrumentType.HISTOGRAM),
    ).to.equal(AggregationTemporality.DELTA)
    expect(
      reader.selectAggregationTemporality(InstrumentType.OBSERVABLE_COUNTER),
    ).to.equal(AggregationTemporality.DELTA)
    expect(
      reader.selectAggregationTemporality(InstrumentType.OBSERVABLE_GAUGE),
    ).to.equal(AggregationTemporality.DELTA)
    expect(
      reader.selectAggregationTemporality(
        InstrumentType.OBSERVABLE_UP_DOWN_COUNTER,
      ),
    ).to.equal(AggregationTemporality.DELTA)
    expect(
      reader.selectAggregationTemporality(InstrumentType.UP_DOWN_COUNTER),
    ).to.equal(AggregationTemporality.DELTA)
  })
})
