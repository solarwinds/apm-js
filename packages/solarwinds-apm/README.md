# solarwinds-apm

The new OpenTelemetry-based SolarWinds APM Node.js library. Currently supports Node.js 16 LTS, 18 LTS and 20.

This library automatically instruments a wide set of frameworks and libraries, see the [Module Compatibility table](../instrumentations/COMPATIBILITY.md) for details.

## Installation and Setup

```sh
npm install --save "solarwinds-apm" "@opentelemetry/api@^1.3.0"
```

Install using your package manager then follow the [configuration guide](./CONFIGURATION.md). Make sure to install the matching version of `@opentelmetry/api` as it is required for the library to work. The two packages should be updated at the same time and kept in sync.

The library can then be initialised either from the command line or the environment. Depending on the Node version the `--loader solarwinds-apm/loader` (<`18.19.0` | <`20.6.0`) or `--import solarwinds-apm` (>=`18.19.0` | >=`20.6.0`) flag should be used.

```sh
# <18.19.0 | <20.6.0
node --loader solarwinds-apm/loader script.js
# >=18.19.0 | >=20.6.0
node --import solarwinds-apm script.js
```

```sh
# <18.19.0 | <20.6.0
export NODE_OPTIONS="--loader solarwinds-apm/loader"
# >=18.19.0 | >=20.6.0
export NODE_OPTIONS="--import solarwinds-apm"

npm start
```

## Custom Instrumentation and Metrics

Unlike previous non-OpenTelemetry version, all manual instrumentation and metrics collection are handled through the OpenTelemetry API using the `@opentelemetry/api` packages. The [OpenTelemetry JS documentation](https://opentelemetry.io/docs/instrumentation/js/manual/) for manual instrumentation provides instructions (note that `solarwinds-apm` takes care of the initial registration of all components), and the [SDK docs](https://open-telemetry.github.io/opentelemetry-js/modules/_opentelemetry_api.html) are available to see all that the API provides.

An example of using manual instrumentation APIs in tandem with the library is available [in the main repository](../../examples/hello-manual).

## Waiting at Startup

The library needs to perform some initialisation work before it's able to collect traces. If startup time is not a concern, it's possible to wait for the library to be ready before doing anything else.

```ts
import { waitUntilReady } from "solarwinds-apm"
// or
const { waitUntilReady } = require("solarwinds-apm")

// wait up to 10 seconds
waitUntilReady(10_000)
```

## Custom Transaction Names

Transaction names are automatically derived from various trace attributes by `solarwinds-apm`. However it is also possible to override the automatic name by calling `setTransactionName` from any code within the transaction.

```ts
import { setTransactionName } from "solarwinds-apm"
// or
const { setTransactionName } = require("solarwinds-apm")

function calledFromWithinTransaction() {
  setTransactionName("custom-transaction")
}
```

## Migrating from legacy versions

When migrating from older versions not built on top of OTel, `@opentelemetry/api@^1.3.0` must be added as an extra dependency. The config file will also need to be renamed and updated as some of the fields have changed, see the [configuration guide](./CONFIGURATION.md) for details. Manual instrumentation and metrics will also need to be migrated to use the OTel API, except for the `instrument` and `pInstrument` methods which are provided by the `@solarwinds-apm/compat` package to facilitate migrating.

```diff
- const { instrument, pInstrument } = require("solarwinds-apm")
+ const { instrument, pInstrument } = require("@solarwinds-apm/compat")
```

## Diagnostic script

[A script](../../scripts/diagnostic.js) that checks for common issues and prints a full report is available in this repository. Simply copy [its contents](../../scripts/diagnostic.js) to a JavaScript file in the same directory as the instrumented application and run it from the same place as the application. The printed report can be very large so it can be useful to pipe the output to a file. For instance, `node diagnostic.js > report`. It is also possible to require the script directly from within an instrumented application to ensure it runs it the same environment. For instance, adding the line `require("./diagnostic.js")`.
