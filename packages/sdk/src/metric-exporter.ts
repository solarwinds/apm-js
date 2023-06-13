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
import { oboe } from "@swotel/bindings"
import { OtelHistogram } from "@swotel/histogram"

export class SwoMetricsExporter implements PushMetricExporter {
  constructor(private readonly logger: DiagLogger) {}

  export(
    metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void,
  ): void {
    for (const scopeMetric of metrics.scopeMetrics) {
      const scopeTags = SwoMetricsExporter.scopeTags(scopeMetric.scope)

      for (const metric of scopeMetric.metrics) {
        if (metric.aggregationTemporality !== AggregationTemporality.DELTA) {
          this.logger.warn(
            "aggregation temporalities other than DELTA are not supported",
          )
          continue
        }

        const name = `trace.node.${metric.descriptor.name}`
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
              this.exportSum(dataPoint.value as number, name, tags, tagCount)
              break
            }
            case DataPointType.GAUGE: {
              this.exportGauge(dataPoint.value as number, name, tags, tagCount)
              break
            }
            case DataPointType.HISTOGRAM: {
              const histogram = OtelHistogram.fromHistogram(
                dataPoint.value as Histogram,
              )
              this.exportHistogram(histogram, name, tags, tagCount)
              break
            }
            case DataPointType.EXPONENTIAL_HISTOGRAM: {
              const histogram = OtelHistogram.fromExponentialHistogram(
                dataPoint.value as ExponentialHistogram,
              )
              this.exportHistogram(histogram, name, tags, tagCount)
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

  selectAggregationTemporality(): AggregationTemporality {
    return AggregationTemporality.DELTA
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

  private exportSum(
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

  private exportGauge(
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