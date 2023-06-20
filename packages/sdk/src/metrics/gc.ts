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

import {
  constants,
  type NodeGCPerformanceDetail,
  PerformanceObserver,
} from "node:perf_hooks"

import { ValueType } from "@opentelemetry/api"
import { lazy } from "@solarwinds-apm/lazy"

import { meter } from "."

const major = lazy(() =>
  meter.createHistogram("gc.major", {
    description: "measures the duration of major GC cycles",
    unit: "μs",
    valueType: ValueType.DOUBLE,
  }),
)
const minor = lazy(() =>
  meter.createHistogram("gc.minor", {
    description: "measures the duration of minor GC cycles",
    unit: "μs",
    valueType: ValueType.DOUBLE,
  }),
)

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntriesByType("gc")) {
    const detail = entry.detail as NodeGCPerformanceDetail
    switch (detail.kind) {
      case constants.NODE_PERFORMANCE_GC_MAJOR: {
        major.record(entry.duration * 1000)
        break
      }
      case constants.NODE_PERFORMANCE_GC_MINOR: {
        minor.record(entry.duration * 1000)
        break
      }
      default: {
        continue
      }
    }
  }
})

export function start() {
  obs.observe({ type: "gc" })
}
export function stop() {
  obs.disconnect()
}
