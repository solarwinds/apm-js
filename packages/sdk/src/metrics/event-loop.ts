import { ValueType } from "@opentelemetry/api"
import { metrics } from "@swotel/bindings"

import { meter } from "."

// loop iterations to sum when calculating latency
// lower values increase both accuracy and overhead and vice versa
// setting this to 0 will force the event loop into a busy loop
const GRANULARITY = 4

const latency = meter.createHistogram("event_loop.latency", {
  description: `measures the latency of the event loop over ${
    GRANULARITY + 1
  } iterations`,
  unit: "μs",
  valueType: ValueType.DOUBLE,
})

export function start() {
  metrics.eventLoop.setCallback((l) => latency.record(l / 1000), GRANULARITY)
}
export function stop() {
  metrics.eventLoop.setCallback(null)
}
