# Configuration

Configuration options are read from both then environment and an optional configuration file, with environment variables taking precedence over config file values.

All configuration options are optional except for the service key which is always required.

## Environment Variables

| Name                           | Default           | Description                                       |
| ------------------------------ | ----------------- | ------------------------------------------------- |
| **`SW_APM_SERVICE_KEY`**       |                   | **Service key**                                   |
| `SW_APM_ENABLED`               | `true`            | Whether instrumentation should be enabled         |
| `SW_APM_COLLECTOR`             | Default collector | Collector URL                                     |
| `SW_APM_TRUSTED_PATH`          | None              | Path to the collector's SSL certificate           |
| `SW_APM_PROXY`                 | None              | URL of a proxy to use to connect to the collector |
| `SW_APM_LOG_LEVEL`             | `info`            | Logging level for the instrumentation libraries   |
| `SW_APM_TRIGGER_TRACE_ENABLED` | `true`            | Whether trigger tracing should be enabled         |
| `SW_APM_RUNTIME_METRICS`       | `true`            | Whether runtime metrics should be enabled         |

## Configuration File

When required, the package will look for the file in the current working directory under three possible formats, in the following order:

- `solarwinds.apm.config.ts` - TypeScript config, supports all options, required peer dependency on `ts-node`
- `solarwinds.apm.config.js` - JavaScript config, supports all options
- `solarwinds.apm.config.json` - JSON config, doesn't support certain options, optional peer dependency on `json5`

It's also possible to use a custom name for the configuration file using the `SW_APM_CONFIG_FILE` environment variable. The file must have one of the three supported extensions or it will be ignored.

### Type Checking

The package exports a type for the config file which can be used to type check it when using TypeScript or add a JSDoc type annotation when using JavaScript.

```ts
import type { ConfigFile } from "solarwinds-apm"

const config: ConfigFile = {
  // ...
}
export default config
```

```js
/** @type {import('solarwinds-apm').ConfigFile} */
module.exports = {
  // ...
}
```

### Specification

| Key                             | Default           | Description                                                  |
| ------------------------------- | ----------------- | ------------------------------------------------------------ |
| **`serviceKey`**                |                   | **Service key**                                              |
| `enabled`                       | `true`            | Whether instrumentation should be enabled                    |
| `collector`                     | Default collector | Collector URL                                                |
| `trustedPath`                   | None              | Path to the collector's SSL certificate                      |
| `proxy`                         | None              | URL of a proxy to use to connect to the collector            |
| `logLevel`                      | `info`            | Logging level for the instrumentation libraries              |
| `triggerTraceEnabled`           | `true`            | Whether trigger tracing should be enabled                    |
| `runtimeMetrics`                | `true`            | Whether runtime metrics should be enabled                    |
| `tracingMode`                   | None              | Custom tracing mode                                          |
| `insertTraceContextIntoLogs`    | `false`           | Whether to insert trace context information into logs        |
| `insertTraceContextIntoQueries` | `false`           | Whether to insert trace context information into SQL queries |
| `transactionSettings`           | None              | See [Transaction Settings](#transaction-settings)            |
| `instrumentations`              | None              | See [Instrumentations](#instrumentations)                    |
| `metricViews`                   | None              | Custom metric views                                          |

#### Transaction Settings

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

#### Instrumentations

A default set of instrumentations are provided and configured by the library. However in many cases it may be desirable to manually configure the instrumentations or provide additional ones. The `instrumentations` configuration field accepts an object which in turn can contain two fields.

- The `configs` field accepts an object with instrumentation package names mapping to their configuration.
- The `extra` field accepts an array of additional [`Instrumentation`](https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_instrumentation.Instrumentation.html) instances to register.

```js
module.exports = {
  instrumentations: {
    configs: {
      "@opentelemetry/instrumentation-pg": { requireParentSpan: true },
    },
    extra: [new CustomInstrumentation(customInstrumentationConfig)],
  },
}
```
