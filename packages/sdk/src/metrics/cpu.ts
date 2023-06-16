import * as process from "node:process"

import { type BatchObservableResult, ValueType } from "@opentelemetry/api"
import { lazy } from "@swotel/lazy"

import { meter } from "."

const user = lazy(() =>
  meter.createObservableGauge("process.cpuUsage.user", {
    description: "time spent in user mode",
    unit: "μs",
    valueType: ValueType.DOUBLE,
  }),
)
const system = lazy(() =>
  meter.createObservableGauge("process.cpuUsage.system", {
    description: "time spent in system mode",
    unit: "μs",
    valueType: ValueType.DOUBLE,
  }),
)

let previous: NodeJS.CpuUsage | undefined = undefined
function callback(batch: BatchObservableResult) {
  const current = process.cpuUsage()
  if (previous === undefined) {
    previous = current
    return
  }

  batch.observe(user, current.user - previous.user)
  batch.observe(system, current.system - previous.system)
  previous = current
}

export function start() {
  meter.addBatchObservableCallback(callback, [user, system])
}
export function stop() {
  meter.removeBatchObservableCallback(callback, [user, system])
  previous = undefined
}
