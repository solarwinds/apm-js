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

import util from "node:util"

import { type Attributes } from "@opentelemetry/api"
import {
  type ExportResult,
  ExportResultCode,
  type InstrumentationScope,
} from "@opentelemetry/core"
import {
  Aggregation,
  AggregationTemporality,
  DataPointType,
  type ExponentialHistogram as ExponentialHistogramDatapoint,
  ExponentialHistogramAggregation,
  type Histogram as HistogramDatapoint,
  InstrumentType,
  type MetricDescriptor,
  type ResourceMetrics,
} from "@opentelemetry/sdk-metrics"
import { oboe } from "@solarwinds-apm/bindings"
import {
  explicit,
  exponential,
  type Histogram,
} from "@solarwinds-apm/histogram"

import { componentLogger } from "../../logger.js"

const MAX_TAGS = 50

export class AppopticsMetricExporter {
  readonly #logger = componentLogger(AppopticsMetricExporter)
  readonly #reporter: oboe.Reporter

  constructor(reporter: oboe.Reporter) {
    this.#reporter = reporter
  }

  export(
    metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void,
  ): void {
    for (const scopeMetric of metrics.scopeMetrics) {
      const scopeTags = this.#scopeTags(scopeMetric.scope)

      for (const metric of scopeMetric.metrics) {
        const name = metric.descriptor.name
        const temporality = metric.aggregationTemporality
        const descriptorTags = this.#descriptorTags(metric.descriptor)

        for (const dataPoint of metric.dataPoints) {
          const dataPointTags = this.#dataPointTags(dataPoint.attributes)
          const [tags, tagCount] = this.#oboeTags({
            ...scopeTags,
            ...descriptorTags,
            ...dataPointTags,
          })

          switch (metric.dataPointType) {
            case DataPointType.SUM: {
              if (temporality === AggregationTemporality.DELTA) {
                this.#exportCounter(
                  dataPoint.value as number,
                  name,
                  tags,
                  tagCount,
                )
              } else {
                this.#exportSummary(
                  dataPoint.value as number,
                  name,
                  tags,
                  tagCount,
                )
              }
              break
            }
            case DataPointType.GAUGE: {
              if (temporality === AggregationTemporality.CUMULATIVE) {
                this.#exportSummary(
                  dataPoint.value as number,
                  name,
                  tags,
                  tagCount,
                )
              } else {
                this.#logger.warn(
                  "gauges with delta aggregation are not supported",
                )
              }
              break
            }
            case DataPointType.HISTOGRAM: {
              if (temporality === AggregationTemporality.DELTA) {
                const histogram = explicit(
                  dataPoint.value as HistogramDatapoint,
                )
                this.#exportHistogram(histogram, name, tags, tagCount)
              } else {
                this.#logger.warn(
                  "histograms with cumulative aggregation are not supported",
                )
              }
              break
            }
            case DataPointType.EXPONENTIAL_HISTOGRAM: {
              if (temporality === AggregationTemporality.DELTA) {
                const histogram = exponential(
                  dataPoint.value as ExponentialHistogramDatapoint,
                )
                this.#exportHistogram(histogram, name, tags, tagCount)
              } else {
                this.#logger.warn(
                  "histograms with cumulative aggregation are not supported",
                )
              }
              break
            }
          }
        }
      }
    }

    resultCallback({
      code: ExportResultCode.SUCCESS,
    })
  }

  selectAggregation(instrumentType: InstrumentType): Aggregation {
    switch (instrumentType) {
      case InstrumentType.HISTOGRAM: {
        return new ExponentialHistogramAggregation(undefined, true)
      }
      default: {
        return Aggregation.Default()
      }
    }
  }
  selectAggregationTemporality(
    instrumentType: InstrumentType,
  ): AggregationTemporality {
    switch (instrumentType) {
      case InstrumentType.HISTOGRAM: {
        return AggregationTemporality.DELTA
      }
      default: {
        return AggregationTemporality.CUMULATIVE
      }
    }
  }

  forceFlush(): Promise<void> {
    this.#reporter.flush()
    return Promise.resolve()
  }
  shutdown(): Promise<void> {
    oboe.Context.shutdown()
    return Promise.resolve()
  }

  #exportCounter(
    value: number,
    name: string,
    tags: oboe.MetricTags,
    tagCount: number,
  ) {
    oboe.CustomMetrics.increment({
      name,
      count: value,
      tags,
      tags_count: tagCount,
      host_tag: 1,
      service_name: null,
    })
  }

  #exportSummary(
    value: number,
    name: string,
    tags: oboe.MetricTags,
    tagCount: number,
  ) {
    oboe.CustomMetrics.summary({
      name,
      value,
      count: 1,
      tags,
      tags_count: tagCount,
      host_tag: 1,
      service_name: null,
    })
  }

  #exportHistogram(
    histogram: Histogram,
    name: string,
    tags: oboe.MetricTags,
    tagCount: number,
  ) {
    const stats = {
      count: histogram.count,
      min: histogram.min,
      max: histogram.max,
      p50: histogram.getPercentile(50),
      p95: histogram.getPercentile(95),
      p99: histogram.getPercentile(99),
    }
    const filtered = Object.entries(stats).filter(([, v]) => v !== undefined)
    for (const [stat, value] of filtered) {
      oboe.CustomMetrics.summary({
        name: `${name}.${stat}`,
        value: value!,
        count: 1,
        tags,
        tags_count: tagCount,
        host_tag: 1,
        service_name: null,
      })
    }
  }

  #oboeTags(
    tags: Record<string, string>,
  ): [tags: oboe.MetricTags, count: number] {
    const entries = Object.entries(tags)
    const count = Math.max(entries.length, MAX_TAGS)
    entries.length = count

    const oboeTags = new oboe.MetricTags(count)
    for (const [i, [k, v]] of entries.entries()) {
      oboeTags.add(i, k, v)
    }
    return [oboeTags, count]
  }

  #scopeTags(scope: InstrumentationScope): Record<string, string> {
    const tags: Record<string, string> = { "scope.name": scope.name }
    if (scope.version) {
      tags["scope.version"] = scope.version
    }
    return tags
  }

  #descriptorTags(descriptor: MetricDescriptor): Record<string, string> {
    return {
      description: descriptor.description,
      unit: descriptor.unit,
    }
  }

  #dataPointTags(attributes: Attributes): Record<string, string> {
    return Object.fromEntries(
      Object.entries(attributes)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => {
          if (Array.isArray(v)) {
            return [
              k,
              util.inspect(v, { breakLength: Infinity, compact: true }),
            ]
          } else {
            return [k, v!.toString()]
          }
        }),
    )
  }
}
