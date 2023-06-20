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

import { ValueType } from "@opentelemetry/api"
import { metrics } from "@solarwinds-apm/bindings"
import { lazy } from "@solarwinds-apm/lazy"

import { meter } from "."

// loop iterations to sum when calculating latency
// lower values increase both accuracy and overhead and vice versa
// setting this to 0 will force the event loop into a busy loop
const GRANULARITY = 2

const latency = lazy(() =>
  meter.createHistogram("eventloop", {
    description: `measures the latency of the event loop`,
    unit: "μs",
    valueType: ValueType.DOUBLE,
  }),
)

export function start() {
  metrics.eventLoop.setCallback((l) => {
    for (let i = 0; i < GRANULARITY + 1; i++) {
      latency.record(l / 1000 / (GRANULARITY + 1))
    }
  }, GRANULARITY)
}
export function stop() {
  metrics.eventLoop.setCallback(null)
}
