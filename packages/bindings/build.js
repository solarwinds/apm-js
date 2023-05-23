const fs = require("node:fs")
const { build } = require("zig-build")

const targets = [
  {
    name: "linux-arm64-gnu",
    oboe: "liboboe-1.0-aarch64.so",
    target: "aarch64-linux-gnu",
    cpu: "generic",
    glibc: "2.27",
  },
  {
    name: "linux-arm64-musl",
    oboe: "liboboe-1.0-alpine-aarch64.so",
    target: "aarch64-linux-musl",
    cpu: "generic",
  },
  {
    name: "linux-x64-gnu",
    oboe: "liboboe-1.0-x86_64.so",
    target: "x86_64-linux-gnu",
    cpu: "x86_64_v3",
    glibc: "2.27",
  },
  {
    name: "linux-x64-musl",
    oboe: "liboboe-1.0-alpine-x86_64.so",
    target: "x86_64-linux-musl",
    cpu: "x86_64_v3",
  },
]
const configs = targets.map(({ name, oboe, target, cpu, glibc }) => {
  fs.copyFileSync(`oboe/${oboe}`, `npm/${name}/liboboe.so`)

  const config = {
    target,
    cpu,
    glibc,
    output: `npm/${name}/oboe.node`,
    type: "shared",

    sources: [
      "src/bindings.cc",
      "src/context.cc",
      "src/custom_metrics.cc",
      "src/event.cc",
      "src/metadata.cc",
      "src/metric_tags.cc",
      "src/reporter.cc",
      "src/span.cc",
      "oboe/include/oboe_api.cpp",
    ],
    napiVersion: 8,
    std: "c++17",
    exceptions: true,

    libraries: ["oboe"],
    librariesSearch: [`npm/${name}`],
    include: ["oboe/include"],
    cflags: ["-Wall", "-Wextra" /*"-Werror"*/],

    rpath: "$ORIGIN",
  }

  return [name, config]
})

build(Object.fromEntries(configs), __dirname)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
