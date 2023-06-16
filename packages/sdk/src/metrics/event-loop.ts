import { ValueType } from "@opentelemetry/api"
import { metrics } from "@swotel/bindings"
import { lazy } from "@swotel/lazy"

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
