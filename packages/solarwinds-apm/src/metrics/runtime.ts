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

import {
  constants,
  type EventLoopUtilization,
  monitorEventLoopDelay,
  type NodeGCPerformanceDetail,
  performance,
  PerformanceObserver,
  type PerformanceObserverEntryList,
} from "node:perf_hooks"
import v8 from "node:v8"

import {
  type BatchObservableResult,
  metrics,
  type ObservableResult,
  ValueType,
} from "@opentelemetry/api"

// This code does not use lazy initialisation, so it needs to
// be imported after the meter provider is registered
const meter = metrics.getMeter("sw.apm.runtime.metrics")

const cpu = {
  user: meter.createObservableGauge("process.cpuUsage.user", {
    description: "time spent in user mode",
    unit: "μs",
    valueType: ValueType.DOUBLE,
  }),
  system: meter.createObservableGauge("process.cpuUsage.system", {
    description: "time spent in system mode",
    unit: "μs",
    valueType: ValueType.DOUBLE,
  }),

  previous: undefined as NodeJS.CpuUsage | undefined,
  callback(batch: BatchObservableResult) {
    const current = process.cpuUsage()
    const previous = this.previous ?? { user: 0, system: 0 }

    batch.observe(this.user, current.user - previous.system)
    batch.observe(this.system, current.system - previous.user)

    this.previous = current
  },

  enable() {
    meter.addBatchObservableCallback(this.callback.bind(this), [
      this.user,
      this.system,
    ])
  },
}

const latency = {
  mean: meter.createObservableGauge("eventloop.mean", {
    description: "mean latency of the event loop",
    unit: "ns",
    valueType: ValueType.DOUBLE,
  }),
  min: meter.createObservableGauge("eventloop.min", {
    description: "minimum latency of the event loop",
    unit: "ns",
    valueType: ValueType.DOUBLE,
  }),
  max: meter.createObservableGauge("eventloop.max", {
    description: "maximum latency of the event loop",
    unit: "ns",
    valueType: ValueType.DOUBLE,
  }),
  stddev: meter.createObservableGauge("eventloop.stddev", {
    description: "standard deviation in the latency of the event loop",
    unit: "ns",
    valueType: ValueType.DOUBLE,
  }),
  percentiles: [50, 90, 95, 99].map((p) => ({
    p,
    meter: meter.createObservableGauge(`eventloop.p${p}`, {
      description: `${p}th percentile latency of the event loop`,
      unit: "ns",
      valueType: ValueType.DOUBLE,
    }),
  })),

  histogram: monitorEventLoopDelay(),
  callback(batch: BatchObservableResult) {
    batch.observe(this.mean, this.histogram.mean)
    batch.observe(this.min, this.histogram.min)
    batch.observe(this.max, this.histogram.max)
    batch.observe(this.stddev, this.histogram.stddev)

    for (const { p, meter } of this.percentiles) {
      batch.observe(meter, this.histogram.percentile(p))
    }

    this.histogram.reset()
  },

  enable() {
    meter.addBatchObservableCallback(this.callback.bind(this), [
      this.mean,
      this.min,
      this.max,
      this.stddev,
      ...this.percentiles.map(({ meter }) => meter),
    ])
  },
}

const elu = {
  meter: meter.createObservableGauge("eventloop.utilization", {
    description:
      "percentage of time the event loop has spent processing callbacks over waiting for events",
    unit: "%",
    valueType: ValueType.DOUBLE,
  }),

  previous: undefined as EventLoopUtilization | undefined,
  callback(self: ObservableResult) {
    const current = performance.eventLoopUtilization()
    const diff = performance.eventLoopUtilization(current, this.previous)

    self.observe(diff.utilization * 100)

    this.previous = current
  },

  enable() {
    this.meter.addCallback(this.callback.bind(this))
  },
}

const gc = {
  major: meter.createHistogram("gc.major", {
    description: "duration of major GC cycles",
    unit: "ms",
    valueType: ValueType.DOUBLE,
  }),
  minor: meter.createHistogram("gc.minor", {
    description: "duration of minor GC cycles",
    unit: "ms",
    valueType: ValueType.DOUBLE,
  }),

  callback(list: PerformanceObserverEntryList) {
    for (const entry of list.getEntriesByType("gc")) {
      const detail = entry.detail as NodeGCPerformanceDetail
      switch (detail.kind) {
        case constants.NODE_PERFORMANCE_GC_MAJOR: {
          this.major.record(entry.duration)
          break
        }
        case constants.NODE_PERFORMANCE_GC_MINOR: {
          this.minor.record(entry.duration)
          break
        }
        default: {
          continue
        }
      }
    }
  },

  enable() {
    new PerformanceObserver(this.callback.bind(this)).observe({ type: "gc" })
  },
}

const memoryUsage = {
  meters: {
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
        description: "memory allocated for ArrayBuffers and SharedArrayBuffers",
        unit: "byte",
        valueType: ValueType.INT,
      },
    ),
  } as const,

  callback(batch: BatchObservableResult) {
    const usage = process.memoryUsage()
    for (const [key, meter] of Object.entries(this.meters)) {
      batch.observe(meter, usage[key])
    }
  },

  enable() {
    meter.addBatchObservableCallback(
      this.callback.bind(this),
      Object.values(this.meters),
    )
  },
}

const heapStatistics = {
  meters: {
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
  } as const,

  callback(batch: BatchObservableResult) {
    const statistics = v8.getHeapStatistics()
    for (const [key, meter] of Object.entries(this.meters)) {
      batch.observe(meter, statistics[key])
    }
  },

  enable() {
    meter.addBatchObservableCallback(
      this.callback.bind(this),
      Object.values(this.meters),
    )
  },
}

export function enable() {
  cpu.enable()
  latency.enable()
  elu.enable()
  gc.enable()
  memoryUsage.enable()
  heapStatistics.enable()
}
