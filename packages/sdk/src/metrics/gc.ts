import {
  constants,
  type NodeGCPerformanceDetail,
  PerformanceObserver,
} from "node:perf_hooks"

import { ValueType } from "@opentelemetry/api"

import { meter } from "."

const major = meter.createHistogram("gc.major", {
  description: "measures the duration of major GC cycles",
  unit: "ms",
  valueType: ValueType.DOUBLE,
})
const minor = meter.createHistogram("gc.minor", {
  description: "measures the duration of minor GC cycles",
  unit: "ms",
  valueType: ValueType.DOUBLE,
})

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntriesByType("gc")) {
    const detail = entry.detail as NodeGCPerformanceDetail
    switch (detail.kind) {
      case constants.NODE_PERFORMANCE_GC_MAJOR: {
        major.record(entry.duration)
        break
      }
      case constants.NODE_PERFORMANCE_GC_MINOR: {
        minor.record(entry.duration)
        break
      }
      default: {
        continue
      }
    }
  }
})

export function start() {
  obs.observe({ type: "gc", buffered: true })
}
export function stop() {
  obs.disconnect()
}
