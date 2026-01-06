/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import process from "node:process"

import {
  type BatchObservableResult,
  metrics,
  ValueType,
} from "@opentelemetry/api"
import {
  ATTR_CPU_MODE,
  ATTR_PROCESS_CONTEXT_SWITCH_TYPE,
  ATTR_PROCESS_PAGING_FAULT_TYPE,
  CPU_MODE_VALUE_SYSTEM,
  CPU_MODE_VALUE_USER,
  METRIC_PROCESS_CONTEXT_SWITCHES,
  METRIC_PROCESS_CPU_TIME,
  METRIC_PROCESS_MEMORY_USAGE,
  METRIC_PROCESS_PAGING_FAULTS,
  METRIC_PROCESS_UPTIME,
  PROCESS_CONTEXT_SWITCH_TYPE_VALUE_INVOLUNTARY,
  PROCESS_CONTEXT_SWITCH_TYPE_VALUE_VOLUNTARY,
  PROCESS_PAGING_FAULT_TYPE_VALUE_MAJOR,
  PROCESS_PAGING_FAULT_TYPE_VALUE_MINOR,
} from "@opentelemetry/semantic-conventions/incubating"

// This code does not use lazy initialisation, so it needs to
// be imported after the meter provider is registered
const meter = metrics.getMeter("sw.apm.runtime.metrics")

const cpuTime = meter.createObservableCounter(METRIC_PROCESS_CPU_TIME, {
  description: "Total CPU seconds broken down by different states.",
  unit: "s",
  valueType: ValueType.DOUBLE,
})
const memoryUsage = meter.createObservableGauge(METRIC_PROCESS_MEMORY_USAGE, {
  description: "The amount of physical memory in use.",
  unit: "By",
  valueType: ValueType.INT,
})
const contextSwitches = meter.createObservableCounter(
  METRIC_PROCESS_CONTEXT_SWITCHES,
  {
    description: "Number of times the process has been context switched.",
    unit: "{context_switch}",
    valueType: ValueType.INT,
  },
)
const pagingFaults = meter.createObservableCounter(
  METRIC_PROCESS_PAGING_FAULTS,
  {
    description: "Number of page faults the process has made.",
    unit: "{fault}",
    valueType: ValueType.INT,
  },
)
const uptime = meter.createObservableGauge(METRIC_PROCESS_UPTIME, {
  description: "The time the process has been running.",
  unit: "s",
  valueType: ValueType.DOUBLE,
})

function callback(result: BatchObservableResult) {
  const usage = process.resourceUsage()

  result.observe(cpuTime, usage.userCPUTime / 1_000_000, {
    [ATTR_CPU_MODE]: CPU_MODE_VALUE_USER,
  })
  result.observe(cpuTime, usage.systemCPUTime / 1_000_000, {
    [ATTR_CPU_MODE]: CPU_MODE_VALUE_SYSTEM,
  })

  result.observe(memoryUsage, process.memoryUsage.rss())

  if (process.platform !== "win32") {
    result.observe(contextSwitches, usage.voluntaryContextSwitches, {
      [ATTR_PROCESS_CONTEXT_SWITCH_TYPE]:
        PROCESS_CONTEXT_SWITCH_TYPE_VALUE_VOLUNTARY,
    })
    result.observe(contextSwitches, usage.involuntaryContextSwitches, {
      [ATTR_PROCESS_CONTEXT_SWITCH_TYPE]:
        PROCESS_CONTEXT_SWITCH_TYPE_VALUE_INVOLUNTARY,
    })

    result.observe(pagingFaults, usage.minorPageFault, {
      [ATTR_PROCESS_PAGING_FAULT_TYPE]: PROCESS_PAGING_FAULT_TYPE_VALUE_MINOR,
    })
    result.observe(pagingFaults, usage.majorPageFault, {
      [ATTR_PROCESS_PAGING_FAULT_TYPE]: PROCESS_PAGING_FAULT_TYPE_VALUE_MAJOR,
    })
  }

  result.observe(uptime, process.uptime())
}

export function enable() {
  meter.addBatchObservableCallback(callback, [
    cpuTime,
    memoryUsage,
    contextSwitches,
    pagingFaults,
    uptime,
  ])
}
