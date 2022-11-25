const fs = require("fs")
const build = require("@swotel/zig-build").default

const targets = [
  {
    name: "linux-arm64-gnu",
    triple: "aarch64-linux-gnu",
  },
  {
    name: "linux-arm64-musl",
    triple: "aarch64-linux-musl",
  },
  {
    name: "linux-x64-gnu",
    triple: "x86_64-linux-gnu",
  },
  {
    name: "linux-x64-musl",
    triple: "x86_64-linux-musl",
  },
]
const configs = targets.map(({ name, triple }) => {
  fs.copyFileSync(`npm/${name}/liboboe.so`, `npm/${name}/liboboe-1.0.so.0`)

  const config = {
    target: triple,
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
    napiVersion: 6,
    std: "c++17",
    exceptions: true,

    libraries: ["oboe"],
    librariesSearch: [`npm/${name}`],
    include: ["oboe/include"],
    cflags: ["-Wall", "-Wextra", "-Werror"],

    rpath: "$ORIGIN",
  }
  if (triple.startsWith("x86_64")) config.cpu = "sandybridge"
  if (triple.endsWith("gnu")) config.glibc = "2.17"

  return [name, config]
})

build(Object.fromEntries(configs), __dirname)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
