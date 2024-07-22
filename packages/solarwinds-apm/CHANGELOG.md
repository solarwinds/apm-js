# [14.0.3](https://github.com/solarwinds/apm-js/releases/tag/v14.0.3)

## Fixes

- Properly support user-provided `@opentelemetry/api` in Lambda.

# [14.0.2](https://github.com/solarwinds/apm-js/releases/tag/v14.0.2)

## Breaking changes

- This is a completely new version of the instrumentation library built upon OpenTelemetry.
- The library now requires the `@opentelemetry/api` package to be installed alongside it, with the version range `^1.3.0`.
- The public API surface of the library has been greatly reduced. The `@opentelemetry/api` package can instead be used for all custom instrumentation needs.
- The configuration file name has changed and some options have been renamed or altered. Check out [the configuration guide](./CONFIGURATION.md) for more details.
- The list of instrumented libraries has changed as the library now uses OpenTelemetry instrumentation. Custom instrumentations can now also be provided by the user. See [the updated list of bundled instrumentations](../instrumentations/COMPATIBILITY.md) for more details.
- The new library is written in TypeScript and will always provide up to date and accurate type declarations.
- The new library will support all LTS Node.js versions up to one year after their End of Life. Support for older versions will not be provided since they should not be used.

## New features and improvements

- ESM is now supported by default. The recommended way to load the library is now using the `--import` flag instead of the `--require` flag.

## Internal changes

- Upgraded liboboe to `14.1.0`
