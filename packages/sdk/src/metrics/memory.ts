import * as process from "node:process"
import * as v8 from "node:v8"

import { type BatchObservableResult, ValueType } from "@opentelemetry/api"
import { lazy } from "@swotel/lazy"

import { meter } from "."

const memoryUsageMeters = lazy(
  () =>
    ({
      rss: meter.createObservableUpDownCounter("process.memoryUsage.rss", {
        description: "resident set size",
        unit: "byte",
        valueType: ValueType.INT,
      }),
      heapTotal: meter.createObservableUpDownCounter(
        "process.memoryUsage.heapTotal",
        {
          description: "total size of the V8 heap",
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      heapUsed: meter.createObservableUpDownCounter(
        "process.memoryUsage.heapUsed",
        {
          description: "used size of the V8 heap",
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      external: meter.createObservableUpDownCounter(
        "process.memoryUsage.external",
        {
          description:
            "memory usage of C++ objects bound to JavaScript objects managed by V8",
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      arrayBuffers: meter.createObservableUpDownCounter(
        "process.memoryUsage.arrayBuffers",
        {
          description:
            "memory allocated for ArrayBuffers and SharedArrayBuffers",
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
    } as const),
)

const heapStatisticsMeters = lazy(
  () =>
    ({
      total_heap_size: meter.createObservableUpDownCounter(
        "v8.heapStatistics.total_heap_size",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      total_heap_size_executable: meter.createObservableUpDownCounter(
        "v8.heapStatistics.total_heap_size_executable",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      total_physical_size: meter.createObservableUpDownCounter(
        "v8.heapStatistics.total_physical_size",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      total_available_size: meter.createObservableUpDownCounter(
        "v8.heapStatistics.total_available_size",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      used_heap_size: meter.createObservableUpDownCounter(
        "v8.heapStatistics.used_heap_size",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      heap_size_limit: meter.createObservableUpDownCounter(
        "v8.heapStatistics.heap_size_limit",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      malloced_memory: meter.createObservableUpDownCounter(
        "v8.heapStatistics.malloced_memory",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
      peak_malloced_memory: meter.createObservableUpDownCounter(
        "v8.heapStatistics.peak_malloced_memory",
        {
          unit: "byte",
          valueType: ValueType.INT,
        },
      ),
    } as const),
)

function memoryUsageCallback(batch: BatchObservableResult) {
  const usage = process.memoryUsage()
  for (const [key, meter] of Object.entries(memoryUsageMeters)) {
    batch.observe(meter, usage[key])
  }
}

function heapStatisticsCallback(batch: BatchObservableResult) {
  const statistics = v8.getHeapStatistics()
  for (const [key, meter] of Object.entries(heapStatisticsMeters)) {
    batch.observe(meter, statistics[key])
  }
}

export function start() {
  meter.addBatchObservableCallback(
    memoryUsageCallback,
    Object.values(memoryUsageMeters),
  )
  meter.addBatchObservableCallback(
    heapStatisticsCallback,
    Object.values(heapStatisticsMeters),
  )
}

export function stop() {
  meter.removeBatchObservableCallback(
    memoryUsageCallback,
    Object.values(memoryUsageMeters),
  )
  meter.removeBatchObservableCallback(
    heapStatisticsCallback,
    Object.values(heapStatisticsMeters),
  )
}
