const { PrismaInstrumentation } = require("@prisma/instrumentation")

/** @type {import("solarwinds-apm").Config} */
module.exports = {
  instrumentations: {
    configs: {
      // Next.js provides its own HTTP instrumentation
      "@opentelemetry/instrumentation-http": { enabled: false },
    },
    extra: [new PrismaInstrumentation()],
  },
}
