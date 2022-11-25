## Background

We previously used `node-gyp` and `node-pre-gyp` for bindings. This was the best solution at the time it was implemented, but since then better options have appeared.

Let's start with the issues with `node-pre-gyp`.

- Needs to be a runtime dependency and requires a postinstall script.
- Binaries need to be hosted separately from the package and then downloaded.

Nowadays npm supports new manifest fields that make these requirements obsolete. By publishing packages containing the platform specific binaries, specifying the `os`, `cpu` and `libc` fields in their manifests, and adding all of them as `optionalDependencies`, npm will automatically download the binary package that matches.

`node-pre-gyp` also supports building the binaries from source if none match the host system, but this is not useful to us as we already build for every platform that we support.

Now regarding `node-gyp`.

- Does not support cross-compilation.
- Poorly documented and annoying to configure.

The lack of cross-compilation support forces us to maintain an elaborate build process using target-specific Docker containers. This is made more complicated by the need to link against an old enough version of glibc to support nearly decade-old LTS distros (namely RHEL7 which ships with glibc 2.17).

As of recently there was no way to work around this. However, the Zig project now [bundles clang with cross-compilation support from any host to any target and supports linking against a specific version of glibc](https://andrewkelley.me/post/zig-cc-powerful-drop-in-replacement-gcc-clang.html). This solves all of the issues we have with `node-gyp`, and also makes it possible to build locally on any dev machine.

This then becomes a choice between continuing to maintain the complex and breakage-prone build setup we previously used and maintaining a wrapper around the Zig compiler. The latter provides a much better developer experience for the rest of the project and should require less frequent maintenance, which is why [`zig-build`](../zig-build/) exists.

Another pain with the previous bindings was that they were not only bindings to liboboe but an abstraction layer over it. They were designed specifically to be used from the `solarwinds-apm` package and would have been very cumbersome to use in the context of OTel.

This also meant that every oboe update required updating two layers of abstraction; the bindings' abstraction of oboe and the main package's abstraction of the bindings. The logic was split across two completely separate codebases.

## Implementation

These bindings replace `node-pre-gyp` with npm's builtin support of platform specific packages, and replaces `node-gyp` with [`zig-build`](../zig-build/). They are also purely bindings to oboe with the minimum required level of abstraction to bridge the JS<->C barrier.

The [`oboe` directory](./oboe/) is very similar to the previous bindings and simply contains a vendored copy of oboe.

The [`npm` directory](./npm/) contains the platform specific packages. Each of those includes only three files. `oboe.node` is the N-API addon. `liboboe.so` is a symlink to the platform specific liboboe, not included in the published npm package but present to make the directory usable as a library search path for the compiler. `liboboe-1.0.so.0` is the copy of the platform specific liboboe dynamically loaded by the addon at runtime, copied from the target of the symlink during the build process as npm doesn't resolve symlinks when publishing.

The [`src` directory](./src/) contains the one to one bindings to [`oboe_api.h`](./oboe/include/oboe_api.h). The only abstractions are [`misc.hh`](./src/misc.hh) which provides constants and [`util.hh`](./src/util.hh) which provides utilities and N-API wrappers to make the bindings as concise as possible. This means any change to oboe clearly maps to a change to the bindings, and also means code using the bindings is a clear usage example of oboe applicable to any other language.

The [`index.d.ts` file](./index.d.ts) contains manually maintained TypeScript definitions for the bindings. They should be very easy to maintain as any change to oboe also clearly maps to a change to the type definitions.

The [`index.js` file](./index.js) simply checks what the host platform is and loads requires the appropriate platform specific package.

The [`test` directory](./test/) contains tests for the bindings. We use Jest for testing.

The [`build.js` file](./build.js) is the build script. It uses `zig-build` to build the addon for every supported platform in parallel, from any host. It outputs the addon binary for each target to the appropriate platform specific package directory and copies the `liboboe.so` symlinks to `liboboe-1.0.so.0`.

## Caveats

Zig is still very young and we don't know if it will stick around. This raises the question of the stability of this workflow. Thankfully we do not depend on the Zig compiler directly, only on its wrapper of Clang. If the Zig project were to go unmaintained, we would simply have to switch to using Clang directly instead. In this scenario we would lose Zig's ability to link against a specific glibc version and need to go back to building public releases from a CentOS 7 container to link against glibc 17 and support all LTS distros.

This would still require changes to the build process and take some time. Thankfully, even in the case where Zig stops being maintained we can keep using the current tarball for a while. At the time of writing we are using Zig 0.10.0, which comes with Clang 15. For comparison, Debian Bullseye packages Clang 11, Ubuntu 22.04 packages Clang 14 and RHEL7 packages Clang 3. Clang 15 will more than likely be a viable C++ compiler long enough to migrate to anything else.
