/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

import { inspect } from "node:util"

import { type Attributes, type DiagLogger } from "@opentelemetry/api"
import {
  type ExportResult,
  ExportResultCode,
  type InstrumentationScope,
} from "@opentelemetry/core"
import {
  Aggregation,
  AggregationTemporality,
  DataPointType,
  type ExponentialHistogram,
  ExponentialHistogramAggregation,
  type Histogram,
  type InstrumentDescriptor,
  InstrumentType,
  type PushMetricExporter,
  type ResourceMetrics,
} from "@opentelemetry/sdk-metrics"
import { oboe } from "@solarwinds-apm/bindings"
import { OtelHistogram } from "@solarwinds-apm/histogram"

export class SwoMetricsExporter implements PushMetricExporter {
  constructor(private readonly logger: DiagLogger) {}

  export(
    metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void,
  ): void {
    for (const scopeMetric of metrics.scopeMetrics) {
      const scopeTags = SwoMetricsExporter.scopeTags(scopeMetric.scope)

      for (const metric of scopeMetric.metrics) {
        const name = `trace.node.${metric.descriptor.name}`
        const temporality = metric.aggregationTemporality
        const descriptorTags = SwoMetricsExporter.descriptorTags(
          metric.descriptor,
        )

        for (const dataPoint of metric.dataPoints) {
          const dataPointTags = SwoMetricsExporter.dataPointTags(
            dataPoint.attributes,
          )
          const [tags, tagCount] = SwoMetricsExporter.oboeTags({
            ...scopeTags,
            ...descriptorTags,
            ...dataPointTags,
          })

          switch (metric.dataPointType) {
            case DataPointType.SUM: {
              if (temporality === AggregationTemporality.DELTA) {
                this.exportCounter(
                  dataPoint.value as number,
                  name,
                  tags,
                  tagCount,
                )
              } else {
                this.exportSummary(
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
                this.exportSummary(
                  dataPoint.value as number,
                  name,
                  tags,
                  tagCount,
                )
              } else {
                this.logger.warn(
                  "gauges with delta aggregation are not supported",
                )
              }
              break
            }
            case DataPointType.HISTOGRAM: {
              if (temporality === AggregationTemporality.DELTA) {
                const histogram = OtelHistogram.fromHistogram(
                  dataPoint.value as Histogram,
                )
                this.exportHistogram(histogram, name, tags, tagCount)
              } else {
                this.logger.warn(
                  "histograms with cumulative aggregation are not supported",
                )
              }
              break
            }
            case DataPointType.EXPONENTIAL_HISTOGRAM: {
              if (temporality === AggregationTemporality.DELTA) {
                const histogram = OtelHistogram.fromExponentialHistogram(
                  dataPoint.value as ExponentialHistogram,
                )
                this.exportHistogram(histogram, name, tags, tagCount)
              } else {
                this.logger.warn(
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

  selectAggregationTemporality(
    instrumentType: InstrumentType,
  ): AggregationTemporality {
    switch (instrumentType) {
      case InstrumentType.UP_DOWN_COUNTER:
      case InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
      case InstrumentType.OBSERVABLE_GAUGE:
        return AggregationTemporality.CUMULATIVE
      default:
        return AggregationTemporality.DELTA
    }
  }
  selectAggregation(instrumentType: InstrumentType): Aggregation {
    switch (instrumentType) {
      case InstrumentType.HISTOGRAM:
        return new ExponentialHistogramAggregation(undefined, true)
      default:
        return Aggregation.Default()
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve()
  }
  shutdown(): Promise<void> {
    return Promise.resolve()
  }

  private exportCounter(
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

  private exportSummary(
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

  private exportHistogram(
    histogram: OtelHistogram,
    name: string,
    tags: oboe.MetricTags,
    tagCount: number,
  ) {
    const stats = {
      count: histogram.count,
      min: histogram.min,
      max: histogram.max,
      mean: histogram.mean(),
      stddev: histogram.stddev(),
      p50: histogram.percentile(50),
      p75: histogram.percentile(75),
      p90: histogram.percentile(90),
      p95: histogram.percentile(95),
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

  private static oboeTags(
    tags: Record<string, string>,
  ): [tags: oboe.MetricTags, count: number] {
    const entries = Object.entries(tags)
    const count = entries.length

    const oboeTags = new oboe.MetricTags(count)
    for (const [i, [k, v]] of entries.entries()) {
      oboeTags.add(i, k, v)
    }
    return [oboeTags, count]
  }

  private static scopeTags(
    scope: InstrumentationScope,
  ): Record<string, string> {
    const tags: Record<string, string> = { "scope.name": scope.name }
    if (scope.version) {
      tags["scope.version"] = scope.version
    }
    return tags
  }

  private static descriptorTags(
    descriptor: InstrumentDescriptor,
  ): Record<string, string> {
    return {
      description: descriptor.description,
      unit: descriptor.unit,
    }
  }

  private static dataPointTags(attributes: Attributes): Record<string, string> {
    return Object.fromEntries(
      Object.entries(attributes)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => {
          if (Array.isArray(v)) {
            return [k, inspect(v, { breakLength: Infinity, compact: true })]
          } else {
            return [k, v!.toString()]
          }
        }),
    )
  }
}
