# solarwinds-apm

The new OpenTelemetry-based SolarWinds APM Node.js library. Currently supports Node.js 16 LTS, 18 LTS and 20.

## Installation and Setup

```sh
npm install --save solarwinds-apm @opentelemetry/api
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

Unlike previous non-OpenTelemetry version, all manual instrumentation and metrics collection are handled through the OpenTelemetry API using the `@opentelemetry/api` packages. The [OpenTelemetry JS documentation](https://opentelemetry.io/docs/instrumentation/js/manual/) for manual instrumentation provides instructions (note that `solarwinds-apm` takes care of the initial registration of all components), and the [SDK docs](https://open-telemetry.github.io/opentelemetry-js/modules/_opentelemetry_api.html) are available to see all that the API provides.

An example of using manual instrumentation APIs in tandem with the library is available [in the main repository](../../examples/hello-manual).

## Migrating from legacy versions

When migrating from older versions not built on top of OTel, `@opentelemetry/api@^1.3.0` must be added as an extra dependency. The config file will also need to be renamed and updated as some of the fields have changed, see the [configuration guide](./CONFIGURATION.md) for details. Manual instrumentation and metrics will also need to be migrated to use the OTel API, except for the `instrument` and `pInstrument` methods which are provided by the `@solarwinds-apm/compat` package to facilitate migrating.

```diff
- const { instrument, pInstrument } = require("solarwinds-apm")
+ const { instrument, pInstrument } = require("@solarwinds-apm/compat")
```
