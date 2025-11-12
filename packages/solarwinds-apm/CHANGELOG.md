# [16.0.0](https://github.com/solarwinds/apm-js/releases/tag/v16.0.0)

## Breaking changes

- Removed support for AppOptics and proprietary native code
  - HTTP proxying is now supported on all platforms and implemented in pure JavaScript.
  - AppOptics customers should stay on the `15.x.x` release line for the time being.
- Migrated to stable HTTP semantic conventions
  - A summary of the changes can be found in the [OpenTelemetry documentation](https://opentelemetry.io/docs/specs/semconv/non-normative/http-migration/#summary-of-changes).
  - This change may affect transaction names for some applications.
- Reworked runtime metrics to match the semantic conventions
  - Semantic [Node.js](https://opentelemetry.io/docs/specs/semconv/runtime/nodejs-metrics/) and [V8](https://opentelemetry.io/docs/specs/semconv/runtime/v8js-metrics/) metrics are now collected.
  - Semantic [process](https://opentelemetry.io/docs/specs/semconv/system/process-metrics/) metrics are now collected (CPU, memory, context switches, faults).
  - This change may affect custom dashboards and alerts.
  - A new dashboard for Node.js applications powered by these metrics will be available in the future.
- The `fs`, `net` and `dns` instrumentations are now disabled by default as they are very noisy, and must be explicitly enabled if required.
  - See the [configuration options for instrumentations](./CONFIGURATION.md#instrumentations).

## New features and improvements

- Per-span opt-in stacktrace collection
  - This feature can be used via the new `spanStacktraceFilter` configuration option.
- Declarative transaction naming
  - This feature can be used via the new `transactionName` configuration option.
- Stable semantic conventions for database instrumentations
  - The previous unstable attributes are still exported for compatibility, but will be removed in a future release.
- OpenAI instrumentation
- OracleDB instrumentation

## Fixes

- Proper type declarations for CommonJS
- More Cassandra span attributes by default
- Explicit units and descriptions for all metrics

# [15.5.2](https://github.com/solarwinds/apm-js/releases/tag/v15.5.2)

## Fixes

- Proper calculation of event loop delay metrics

# [15.5.1](https://github.com/solarwinds/apm-js/releases/tag/v15.5.1)

## Fixes

- Check for compatibility against library build date instead of current date

# [15.5.0](https://github.com/solarwinds/apm-js/releases/tag/v15.5.0)

## New features and improvements

- Node.js 24 support
- Only patch instrumented packages to improve performance and compatibility
- New API to flush telemetry data and best effort to flush on shutdown

## Fixes

- Send logs if requested even if log correlation is disabled
- Always properly set trace response headers
- Don't hang forever in some API calls when the library is disabled

## Internal changes

- Upgrade to OpenTelemetry SDK 2.0
- Enable `gzip` compression by default

# [15.4.0](https://github.com/solarwinds/apm-js/releases/tag/v15.4.0)

## New features and improvements

- Added generic resource attributes detection for Kubernetes

## Fixes

- Collect all metrics with the proper aggregation temporality
- Cap metrics cardinality

# [15.2.0](https://github.com/solarwinds/apm-js/releases/tag/v15.2.0)

## New features and improvements

- Added resource attribute detections for EKS and GCP

# [15.1.0](https://github.com/solarwinds/apm-js/releases/tag/v15.1.0)

## New features and improvements

- New `SW_APM_LOG_STDERR` and `SW_APM_LOG_NULL` flags to redirect logging output

## Internal changes

- Retrieve sampling settings using HTTP instead of gRPC
- Use pure JavaScript crypto

# [15.0.0](https://github.com/solarwinds/apm-js/releases/tag/v15.0.0)

## Breaking changes

- `@opentelemetry/api` dependency upgraded to `^1.9.0`.
- Removed support for initialisation via `--require` and `--loader` flags. The only supported initialisation method is now `--import`.
- Removed support for Node.js 16. The supported versions are now 18 (`^18.19.0`), 20 (`^20.8.0`), 22 and future LTS releases.
- `waitUntilReady` changed to return a promise.

## New features and improvements

- Added support for exporting logs.
- Added support for non-Linux platforms (Windows, macOS, etc).

## Internal changes

- Upgraded liboboe to `15.0.2`.
- Use OTLP as default export protocol.

# [14.1.0](https://github.com/solarwinds/apm-js/releases/tag/v14.1.0)

## New features and improvements

- Support ESM handlers in AWS Lambda.

## Fixes

- Do not insert invalid trace context in prepared PostgreSQL statements.
- Properly handle custom gauge metrics.

# [14.0.4](https://github.com/solarwinds/apm-js/releases/tag/v14.0.3)

## Fixes

- Update `import-in-the-middle` transitive dependency to fix ESM loader issues.

# [14.0.3](https://github.com/solarwinds/apm-js/releases/tag/v14.0.3)

## Fixes

- Properly support user-provided `@opentelemetry/api` in Lambda.

# [14.0.0](https://github.com/solarwinds/apm-js/releases/tag/v14.0.0)

## Breaking changes

- This is a completely new version of the instrumentation library built upon OpenTelemetry.
- The library now requires the `@opentelemetry/api` package to be installed alongside it, with the version range `^1.9.0`.
- The public API surface of the library has been greatly reduced. The `@opentelemetry/api` package can instead be used for all custom instrumentation needs.
- The configuration file name has changed and some options have been renamed or altered. Check out [the configuration guide](./CONFIGURATION.md) for more details.
- The list of instrumented libraries has changed as the library now uses OpenTelemetry instrumentation. Custom instrumentations can now also be provided by the user. See [the updated list of bundled instrumentations](../instrumentations/COMPATIBILITY.md) for more details.
- The new library is written in TypeScript and will always provide up to date and accurate type declarations.
- The new library will support all LTS Node.js versions up to one year after their End of Life. Support for older versions will not be provided since they should not be used.

## New features and improvements

- ESM is now supported by default. The recommended way to load the library is now using the `--import` flag instead of the `--require` flag.

## Internal changes

- Upgraded liboboe to `14.1.0`
