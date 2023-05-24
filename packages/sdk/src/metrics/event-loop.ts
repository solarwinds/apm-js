import { ValueType } from "@opentelemetry/api"
import { metrics } from "@swotel/bindings"

import { meter } from "."

// loop iterations to sum when calculating latency
// lower values increase the accuracy and overhead and vice versa
// setting this to 0 will force the event loop into a busy loop
const GRANULARITY = 2

const latency = meter.createHistogram("event_loop.latency", {
  description: "measures the latency of the event loop",
  unit: "ns",
  valueType: ValueType.INT,
})

export function start() {
  metrics.eventLoop.setCallback((l) => latency.record(l), GRANULARITY)
}
export function stop() {
  metrics.eventLoop.setCallback(null)
}
