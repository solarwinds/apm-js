# swotel (name pending)

**_WORK IN PROGRESS_** OTel based SWO Node library playground

## Project structure

- [`docker`](./docker/) - Dockerized dev environment
- [`examples`](./examples/) - Runnable exemples
- [`packages`](./packages/) - Actual Node packages that would get published to NPM
  - [`bindings`](./packages/bindings/) - N-API bindings experiments
  - [`eslint-config`](./packages/eslint-config/) - Shared ESLint config
  - [`instrument`](./packages/instrument/) - Package usable with `node -r` to instrument without the manual OTel setup
  - [`merged-config`](./packages/merged-config/) - Utility to merge a config file with environment variables
  - [`sdk`](./packages/sdk/) - SDK implementing OTel interfaces for SWO
  - [`zig-build`](./packages/zig-build/) - `node-gyp` replacement with cross-compiling support
- [`scripts`](./scripts/) - Project management scripts

## Available commands

First run `git lfs pull` and `yarn install` to get started. This will have to be repeated anytime the dependencies have changed or the version of yarn or oboe is updated. There is no need to run in a container, this should work natively on any machine. However examples and tests need to be ran from Linux x64 or arm64.

- `yarn docker <image>` - Starts a shell session in the specified image
- `yarn docker <image> build` - Builds the specified image
- `yarn docker collector` - Attaches to the test collector log stream
- `yarn build` - Builds everything
- `yarn lint` - Lints everything
- `yarn example <name>` - Runs an example
- `yarn oboe` - Downloads and sets up the latest version of oboe
- `yarn test` - Runs all tests
- `yarn vscode` - Sets up VSCode to work with the project better

Docker shell sessions always have a test collector available to them at `collector:12224`. The test collector certificate is mounted at `/swotel/docker/collector/server-grpc.crt`.

Commands ran from the root directory use a build system to ensure all tasks it depends on are run and provide caching. When this behaviour is not desired, it's possible to run commands in directly each package's directory instead.

## Local dev requirements

- Node.js (16 or newer with corepack)
- clang-format (14 or newer)
- Git LFS

## Devtools

The project is setup to use [Yarn](https://yarnpkg.com/) with workspaces as it is orders of magnitude faster than npm for large projects, especially in Docker where filesystem operations are much slower. [Turborepo](https://turborepo.org) is used as a build system to speedup tasks and make things a lot nicer (ie. automatically build typescript and native dependencies when running an example).
