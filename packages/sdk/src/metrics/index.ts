import { metrics } from "@opentelemetry/api"

import * as eventLoop from "./event-loop"
import * as gc from "./gc"

/* eslint-disable-next-line ts/no-var-requires */
const pkg = require("../../package.json") as { name: string; version: string }

export const meter = metrics.getMeter(pkg.name, pkg.version)

export function start() {
  eventLoop.start()
  gc.start()
}
export function stop() {
  eventLoop.stop()
  gc.stop()
}