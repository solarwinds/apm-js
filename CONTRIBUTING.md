## Project structure

This project is structured as a monorepo separated into a few key directories.

- [`packages`](./packages/) contains the published npm packages, which may each have their own `README` and `CONTRIBUTING.md` files
- [`examples`](./examples/) contains runnable example projects
- [`scripts`](./scripts/) contains project management scripts
- [`docker`](./docker/) contains anything related to the Docker environment used for CI and examples
- [`lambda`](./lambda/) contains the skeleton used to build AWS Lambda layers

## Running tests

Tests can be run with `pnpm test`, either at the project root for all packages or in a package's directory for just that package. Additionally, when running in a package directory, any arguments accepted by Jest can be passed to the command.

## Code style

Code style is enforced throughout the entire project with `oxfmt` and `oxlint`. The `oxfmt` configuration is at [`.oxfmtrc.json`](./.oxfmtrc.json) and the `oxlint` configuration [lives under its own package](./packages/configs/src/oxlint.ts).

Code style can be checked using `pnpm run lint` and fixed as much as possible with `pnpm run lint:fix`. Note that `pnpm run lint` is run in CI. It's recommended to set your editor to format on save and use an `oxc` extension.

## Node version support

This project aims to support all currently maintained and future LTS Node versions.

When a new future LTS is released the project should be updated to support it so that by the time it becomes an LTS it has already been well-tested. In most cases this doesn't require any changes, but it sometimes might.

When a version has been EOL for over a year, support for it should be removed. This project should not encourage customers to use unsupported, potentially insecure Node versions. The `engines` field of `package.json` files should be updated. The version of `@types/node` depended on by all packages should be updated to match the lowest supported version. The [base tsconfig](./packages/configs/tsconfig.json) and [`tsdown` config](./packages/configs/tsdown.config.ts) should be updated. CI should be updated to test against the new version and the lowest supported version.

## Versioning

All packages in the workspace are versioned independently following semver. After making changes to packages, the required version bump strategy for the changes should be specified by running `pnpm change`. When ready to publish the new packages, `pnpm run version:latest` can be run to change the version of each package by going through all the bump strategies required by changes since the last release and picking the highest one. Tags will be created for all the new versions. It is also possible to use `pnpm run version:prerelease` to create a prerelease version instead.

## Releasing

Releasing is done through a manually triggered GitHub workflow, which internally uses `pnpm run release`. It uses trusted publishing and generates provenance metadata, so DO NOT RELEASE PACKAGES FROM YOUR LOCALE MACHINE.

## Adding packages

New packages can be added in the `packages/` directory when the functionality doesn't really fit in any other package or might be useful individually. A good starting point for a simple TypeScript package with tests is the [`sampling`](./packages/sampling/) package. New packages should attempt to follow the same structure as existing ones as much as possible to keep things consistent and easy to navigate and work with.

Running a command in one package should do the same thing as running it in another package and most packages should share the same set of basic scripts.

- `build` should build TypeScript packages.
- `lint` should lint the source following the shared code style using Prettier and ESLint without applying fixes.
- `lint:fix` should lint the source following the shared code style and apply fixes where possible.
- `test` should run the test suite if there is one.

This is especially important given this repo uses NX to run commands in all packages at once from the root by depending on this set of shared scripts existing. It is also used to run examples by ensuring any package an example depends on is built before running it.

## ES Modules vs CommonJS

We target ESM and only support Node.js versions that support `require(ESM)`. New CommonJS code should be avoided as much as possible.

## Adding examples

Examples should be standalone projects in the `examples/` directory. The structure here is a lot more lax than with the rest of the project since different examples might call for different structures, but the source is still required to adhere to the code style which is checked in CI. Example packages should have a simple and clear name. Their package name should be `@solarwinds-apm/example-<name>`, the package should be private and not have a version field. A brief description of the example should be added to the main README. A simple starting point is the [`hello`](./examples/hello/) example.
