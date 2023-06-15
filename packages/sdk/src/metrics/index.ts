import { metrics } from "@opentelemetry/api"
import { lazy } from "@swotel/lazy"

import * as cpu from "./cpu"
import * as eventLoop from "./event-loop"
import * as gc from "./gc"
import * as memory from "./memory"

/* eslint-disable-next-line ts/no-var-requires */
const pkg = require("../../package.json") as { name: string; version: string }

export const meter = lazy(() => metrics.getMeter(pkg.name, pkg.version))

export function start() {
  cpu.start()
  eventLoop.start()
  gc.start()
  memory.start()
}
export function stop() {
  cpu.stop()
  eventLoop.stop()
  gc.stop()
  memory.stop()
}
