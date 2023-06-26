# @solarwinds-apm/bindings

## Structure

This package doesn't use `node-pre-gyp` nor `node-gyp`. Instead, each supported platform get its very own subpackage under [`npm/`](./npm/), which are all listed as optional dependencies of the main package. On modern version of `npm` and other package managers, only the dependency matching the current platform will be downloaded. Then when the main package is required, [`index.js`](./index.js) will itself require the appropriate subpackage for the current platform. The native packages for all platforms can be built from any platform by running `yarn build`.

### Adding a new platform

New platforms can only be added if they are supported by liboboe. The first step to support them is to add the appropriate shared objects (`.so`) for the platform to the list that is downloaded in [`oboe.js`](./oboe.js) and running `yarn oboe` to download them. Then a new subpackage can be created under `npm/` following the `<process.platform>-<process.arch>[-<libc>]` scheme. Refer to the other subpackages for reference. The package should then be added as an optional dependency of the main one and the [build script](./build.js) should be updated to build the code for the new platform.

## Updating oboe

Updating oboe is a fairly simple two-step process. First run `yarn oboe` which will download the latest version. Then check the diff between the current version and the new on in [`oboe_api.h`](./oboe//include/oboe_api.h). The bindings are set up to pretty much mirror the header so any changes should be reflected in them. The typings in [`types/oboe.d.ts`](./types/oboe.d.ts) should also be updated as necessary.

### Adding a new class

In the event where `oboe_api.h` adds a new class, both a source file (`.cc`) and a header (`.hh`) for it should be created following the same general structure as every other class in [`src/oboe/`](./src/oboe/). The source file will also need to be added in the build script.

### New or changed shared objects

Shared objects patterns should all be specified in [`.gitattributes`](./.gitattributes) to use Git LFS. This avoids them making Git slow by taking up massive space in the history.

### glibc

We follow the same minimum glibc policy as liboboe, which means the build script should target either the same version or lower for GNU targets. Due to the way we bundle libstdc++ into the binary we are not limited by the C++ standard supported by liboboe and can target any.
