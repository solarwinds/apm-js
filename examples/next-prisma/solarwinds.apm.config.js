import { PrismaInstrumentation } from "@prisma/instrumentation"

/** @type {import("solarwinds-apm").Config} */
export default {
  instrumentations: {
    configs: {
      // Next.js provides its own HTTP instrumentation
      "@opentelemetry/instrumentation-http": { enabled: false },
    },
    extra: [new PrismaInstrumentation()],
  },
}
