# Configuration

Configuration options are read from both the environment and an optional configuration file, with environment variables taking precedence over config file values.

All configuration options are optional except for the service key which is always required.

## Configuration File

When required, the package will look for the file in the current working directory under three possible formats, in the following order:

- `solarwinds.apm.config.ts` - TypeScript config, supports all options, requires a TypeScript loader such as `ts-node` or `tsx`
- `solarwinds.apm.config.js` - JavaScript config, supports all options, `.cjs` extension also accepted
- `solarwinds.apm.config.json` - JSON config, doesn't support option settings such as functions or custom classes since only valid JSON syntax is accepted

It's also possible to use a custom name for the configuration file using the `SW_APM_CONFIG_FILE` environment variable. The file must have one of the three supported extensions or it will be ignored.

### Type Checking

The package exports a type for the config file which can be used to type check it when using TypeScript or add a JSDoc type annotation when using JavaScript.

```ts
import type { Config } from "solarwinds-apm"

const config: Config = {
  // ...
}
export default config
```

```js
/** @type {import("solarwinds-apm").Config} */
module.exports = {
  // ...
}
```

## Specification

| Key                             | Environment                    | Default           | Description                                                                    |
| ------------------------------- | ------------------------------ | ----------------- | ------------------------------------------------------------------------------ |
| **`serviceKey`**                | **`SW_APM_SERVICE_KEY`**       |                   | **Service key**. See [Service Name](#service-name)                             |
| `enabled`                       | `SW_APM_ENABLED`               | `true`            | Whether instrumentation should be enabled                                      |
| `collector`                     | `SW_APM_COLLECTOR`             | Default collector | Collector URL                                                                  |
| `trustedpath`                   | `SW_APM_TRUSTEDPATH`           | None              | Path to the collector's SSL certificate                                        |
| `proxy`                         | `SW_APM_PROXY`                 | None              | URL of a proxy to use to connect to the collector                              |
| `logLevel`                      | `SW_APM_LOG_LEVEL`             | `warn`            | Logging level for the instrumentation libraries. See [Log Levels](#log-levels) |
| `triggerTraceEnabled`           | `SW_APM_TRIGGER_TRACE_ENABLED` | `true`            | Whether trigger tracing should be enabled                                      |
| `runtimeMetrics`                | `SW_APM_RUNTIME_METRICS`       | `true`            | Whether runtime metrics should be collected                                    |
| `tracingMode`                   | `SW_APM_TRACING_MODE`          | None              | Custom tracing mode                                                            |
| `transactionName`               | `SW_APM_TRANSACTION_NAME`      | None              | Custom transaction name for all spans                                          |
| `exportLogsEnabled`             | `SW_APM_EXPORT_LOGS_ENABLED`   | `false`           | Whether to export logs to the collector. See [Logs Export](#logs-export)       |
| `insertTraceContextIntoLogs`    |                                | `false`           | Whether to insert trace context information into logs                          |
| `insertTraceContextIntoQueries` |                                | `false`           | Whether to insert trace context information into SQL queries                   |
| `transactionSettings`           |                                | None              | See [Transaction Settings](#transaction-settings)                              |
| `instrumentations`              |                                | None              | See [Instrumentations](#instrumentations)                                      |

### Service Name

By default the service name portion of the service key is used, e.g. `my-service` if the service key is `SW_APM_SERVICE_KEY=api-token:my-service`. If the `OTEL_SERVICE_NAME` or `OTEL_RESOURCE_ATTRIBUTES` environment variable is used to specify a service name, it will take precedence over the default.

### Log Levels

The following log levels are available in increasing order of verbosity.

- `none`
- `error`
- `warn`
- `info`
- `debug`
- `verbose`
- `all`

### Logs Export

It is possible to export logs to the collector by explicitly enabling the feature. This feature integrates directly with select logging libraries listed below. Support will be added to more libraries in the future if requested.

- `winston`

### Transaction Settings

Transaction settings allow filtering out certain transactions, based on URL for web requests, and the type and name concatenated with a colon for everything else. This option should be set to an array of objects.

Each entry must have a `tracing` key set to either `enabled` or `disabled` which determines the outcome if it is matched against. The entry must also either have a `regex` key set to a string or `RegExp` object which will be matched against, or a `matcher` key set to a function taking a string and returning `true` if it should match.

If multiple entries match, the first one will be used. Note that setting `tracing` to `enabled` does not guarantee the transaction will be traced.

```js
module.exports = {
  transactionSettings: [
    {
      tracing: "disabled",
      regex: /\/auth\/.*$/,
    },
    {
      tracing: "disabled",
      matcher: (id) => {
        const [ty] = id.split(":")
        if (ty === "CLIENT") return true
      },
    },
  ],
}
```

### Instrumentations

A [default set of instrumentations](../instrumentations/COMPATIBILITY.md) are provided and configured by the library. However in many cases it may be desirable to manually configure the instrumentations or provide additional ones. The `instrumentations` configuration field accepts an object which in turn can contain two fields.

- The `configs` field accepts an object with instrumentation package names mapping to their configuration.
- The `extra` field accepts an array of additional [`Instrumentation`](https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_instrumentation.Instrumentation.html) instances to register.

```js
module.exports = {
  instrumentations: {
    configs: {
      "@opentelemetry/instrumentation-pg": { requireParentSpan: true },
      // it is also possible to disable instrumentations completely if preferred
      "@opentelemetry/instrumentation-fs": { enabled: false },
    },
    extra: [new CustomInstrumentation(customInstrumentationConfig)],
  },
}
```
