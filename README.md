# @solarwinds-apm

This repo holds the source code for the OpenTelemetry-based SolarWinds APM Node.js library and its dependencies. If you're looking for information about the library itself, such as installation and usage instruction, check out its [dedicated README](./packages/solarwinds-apm#README).

## Repository Setup

```sh
git lfs pull
yarn install
```

## Examples

This project contains a few examples of how to use the library in the [`examples/`](./examples/) directory. They can be run using `yarn example <name>` from the project root.

- [`hello`](./examples/hello) is a simple hello world HTTP server.
- [`distributed-hello`](./examples/distributed-hello/) is a simple distributed example where the main HTTP server sends a request to a secondary one and uses the response as its own response.

## Node.js Version Support

The packages in this project support all currently maintained LTS versions. At the moment this means Node.js 16, 18 and 20 are supported.

## License

This project is licensed under the [Apache License, Version 2.0](./LICENSE).
