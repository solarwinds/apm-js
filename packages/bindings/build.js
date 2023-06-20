/*
Copyright 2023 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
const configs = targets.flatMap(({ name, oboe, target, cpu, glibc }) => {
  fs.copyFileSync(`oboe/${oboe}`, `npm/${name}/liboboe.so`)

  const oboeConfig = {
    target,
    cpu,
    glibc,
    output: `npm/${name}/oboe.node`,
    type: "shared",

    sources: [
      "src/oboe/oboe.cc",
      "src/oboe/config.cc",
      "src/oboe/context.cc",
      "src/oboe/custom_metrics.cc",
      "src/oboe/event.cc",
      "src/oboe/metadata.cc",
      "src/oboe/metric_tags.cc",
      "src/oboe/reporter.cc",
      "src/oboe/span.cc",
      "oboe/include/oboe_api.cpp",
    ],
    napiVersion: 8,
    std: "c++17",
    exceptions: true,

    libraries: ["oboe"],
    librariesSearch: [`npm/${name}`],
    include: ["oboe/include"],
    cflags: ["-Wall", "-Wextra", "-Werror"],

    rpath: "$ORIGIN",
  }

  const metricsConfig = {
    target,
    cpu,
    glibc,
    output: `npm/${name}/metrics.node`,
    type: "shared",

    sources: ["src/metrics/metrics.cc"],
    napiVersion: 8,
    std: "c++17",
    exceptions: true,

    cflags: ["-Wall", "-Wextra", "-Werror"],
  }

  return [
    [`${name}:oboe`, oboeConfig],
    [`${name}:metrics`, metricsConfig],
  ]
})

build(Object.fromEntries(configs), __dirname)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
