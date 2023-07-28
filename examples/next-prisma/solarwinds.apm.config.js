const { PrismaInstrumentation } = require("@prisma/instrumentation")

/** @type {import("solarwinds-apm").ConfigFile} */
module.exports = {
  instrumentations: {
    configs: {
      // Next.js provides its own HTTP instrumentation
      "@opentelemetry/instrumentation-http": { enabled: false },
    },
    extra: [new PrismaInstrumentation()],
  },
}
