# solarwinds-apm

The new OpenTelemetry-based SolarWinds APM Node.js library. Currently following `@opentelemetry/api@1.4.x` with support for Node.js 16, 18 and 20.

## Installation and Setup

```sh
npm install --save solarwinds-apm @opentelemetry/api@1.4.x
```

Install using your package manager then follow the [configuration guide](./CONFIGURATION.md). Make sure to install the matching version of `@opentelmetry/api` as it is required for the library to work. The two packages should be updated at the same time and kept in sync.

The library can then be initialised either from the command line, the environment, or directly from code.

```sh
node -r solarwinds-apm script.js
```

```sh
export NODE_OPTIONS="-r solarwinds-apm"
npm start
```

```js
require("solarwinds-apm")
// ...
```

## Custom Instrumentation and Metrics

Unlike previous non-OpenTelemetry version, all manual instrumentation and metrics collection are handled through the OpenTelemetry API using the `@opentelemetry/api` packages. The [OpenTelemetry JS documentation](https://opentelemetry.io/docs/instrumentation/js/manual/) for manual instrumentation provides instructions. Note that this library takes care of the initial registration of all components.
