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
