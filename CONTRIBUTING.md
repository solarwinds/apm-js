# solarwinds-apm

## Requirements

- Node.js 16 or higher with corepack enabled
- Git LFS
- clang-format 14 or higher (only required by the C++ code)

## Project setup

```sh
# Pull latest LFS objects
git lfs pull
# Install latest dependencies
yarn install

# Setup VSCode for the project (optional)
yarn vscode
```

The first two steps need to be repeated any time changes are made upstream that affect either the dependencies of any package or any of the files stored in LFS. It's a good habit to do it after any pull/checkout/merge/rebase.

## Project structure

This project is structured as a monorepo separated into a few key directories.

- [`packages`](./packages/) contains the published npm packages, which may each have their own `README` and `CONTRIBUTING.md` files
- [`examples`](./examples/) contains runnable example projects
- [`scripts`](./scripts/) contains project management scripts
- [`docker`](./docker/) contains anything related to the docker environment used in CI, for running examples, and optionally for development

## Docker

The project includes a set of Docker images for various combinations of Node versions and Linux distros. We attempt to keep images for every supported Node version and a selection of representative distros.

- Alpine
- Amazon Linux
- Debian
- RHEL/CentOS through RedHat's UBI
- Ubuntu

The lowest supported Node version should be coupled with the oldest supported distro versions, while the newest supported Node version should be coupled with the latest distro versions. This is to cover a wide range of environments while keeping the number of images manageable.

It is possible to start a development environment in any of the images using `yarn docker <image>`. This will start a shell session in the image with the project mounted under `/swotel`. The environment will also have both the APM test collector and the OTel collector available at `apm-collector:12224` and `otel-collector:4317` respectively.

## Running tests

Tests can be run with `yarn test`, either at the project root for all packages or in a package's directory for just that package. Additionally, when running in a package directory, any arguments accepted by Jest can be passed to the command. Note that while most of the tests do not depend on the bindings, some do and will fail on unsupported platforms. An easy way to run tests on a supported platform is to use the docker environment.

## Code style

Code style is enforced throughout the entire project with Prettier and ESLint. The Prettier configuration is at [`.prettierrc.json`](./.prettierrc.json) and the ESLint configuration [lives under its own package](./packages/eslint-config/index.js) and uses the new flat config format. The native C++ code is checked more summarily with clang-format.

Code style can be checked using `yarn lint` and fixed as much as possible with `yarn lint:fix`. Note that `yarn lint` is run in CI. It's recommended to set your editor to format on save and use an ESLint integration.

## Node version support

This project aims to support all currently maintained and future LTS Node versions.

When a new future LTS is released (any even-numbered Node versions) the project should be updated to support it so that by the time it becomes an LTS it has already been well-tested. In most cases this doesn't require any change apart from updating the Docker images. It is however possible, although unlikely, that a future release may break native code or a dependency, which should be kept in mind.

When a current LTS goes out of maintenance, support for it should be removed. This project should not support its dependents in using unsupported, potentially insecure Node versions. The version of `@types/node` depended on by all packages should be updated to the next LTS version, for instance going from `^14.0.0` to `^16.0.0`. The `target` in the [base tsconfig](./tsconfig.base.json) should be updated to the highest standard supported by the next LTS version (check [`node.green`](https://node.green) for this) and the same should be done for the `languageOptions` in the ESLint configuration package. The Docker images for the old LTS should be removed, and the distro versions used by the Docker images for the next LTS should be changed to the lowest supported versions if necessary, for instance removing `14-alpine3.12` and moving from `16-alpine` to `16-alpine:3.12`. All `package.json` `engines` fields should also be updated to the next LTS version.

## Upgrading dependencies

Shared dependencies across the project should all use the same version whenever possible. Most of the dependencies can be updated using `yarn upgrade-interactive`, with special care taken when the version change is breaking. All non-OTel dependencies should use caret ranges whenever possible.

OTel dependencies should not be upgraded using this command and the work should be done manually. Special care must be taken to consider version compatibility between different OTel packages, and the version should be specified with only the patch version being variable, for instance `1.4.x`. The `@opentelemetry/api` package should never be listed in the `dependencies` and always in `peerDependencies` and `devDependencies` if needed instead. The only version of it in the dependency tree should always be the one provided by the instrumented application. The required version should be updated in the main package's [README](./packages/solarwinds-apm/README.md).

Dependencies on other packages in the workspace never need to be updated as they should always use `workspace:^` ranges which ensures versions stay in sync.

The Yarn version can be updated using `yarn set version latest` and the Yarn plugins can be updated using `yarn plugins:upgrade`.

## Versioning

All packages in the workspace are versioned independently following semver. After making changes to packages, the required version bump strategy for the changes should be specified by running `yarn version check --interactive`. This requirement is checked in CI using `yarn version check`. When ready to publish the new packages, `yarn version apply --all` can be run to change the version of each package by going through all the bump strategies required by changes since the last release and picking the highest one. It is also possible to use `yarn version apply --all --prerelease` to create a prerelease version instead.

## Adding packages

New packages can be added in the `packages/` directory when the functionality doesn't really fit in any other package or might be useful individually. A good starting point for a simple TypeScript package with tests is the [`dependencies`](./packages/dependencies/) package. New packages should attempt to follow the same structure as existing ones as much as possible to keep things consistent and easy to navigate and work with.

Running a command in one package should do the same thing as running it in another package and most packages should share the same set of basic scripts.

- `build` should build TypeScript packages.
- `lint` should lint the source following the shared code style using Prettier and ESLint without applying fixes.
- `lint:fix` should lint the source following the shared code style and apply fixes where possible.
- `test` should run the test suite if there is one.

This is especially important given this repo uses Turborepo to run commands in all packages at once from the root by depending on this set of shared scripts existing. It is also used to run examples by ensuring any package an example depends on is built before running it.

## Adding examples

Examples should be standalone projects in the `examples/` directory. The structure here is a lot more lax than with the rest of the project since different examples might call for different structures, but the source is still required to adhere to the code style which is checked in CI. Example packages should have a simple and clear name. Their package name should be `@solarwinds-apm/example-<name>`, the package should be private and not have a version field. A brief description of the example should be added to the main README. A simple starting point is the [`hello`](./examples/hello/) example.
