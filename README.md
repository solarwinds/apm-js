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
- [`hello-distributed`](./examples/hello-distributed/) is a simple distributed example where the main HTTP server sends a request to a secondary one and uses the response as its own response.
- [`hello-manual`](./examples/hello-manual/) is an example of how to use the OTel API for manually instrumenting code on top of `solarwinds-apm`.
- [`express-mysql`](./examples/express-mysql/) is a simple todo-list API using `express` and `mysql2`.
- [`fastify-postgres`](./examples/fastify-postgres/) is a simple todo-list API using `fastify` and `pg`.
- [`next-prisma`](./examples/next-prisma/) is a fullstack todo-list application using [Next.js](https://nextjs.org) and [Prisma](https://prisma.io).

## Node.js Version Support

The packages in this project support all LTS Node.js versions up until their End Of Life plus 1 year. At the moment this means Node.js 18, 20 and 22 are supported.

## License

This project is licensed under the [Apache License, Version 2.0](./LICENSE).
