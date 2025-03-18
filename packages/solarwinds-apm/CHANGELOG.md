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
