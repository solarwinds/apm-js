/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

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

const process = require("node:process")
const cproc = require("node:child_process")

function exec(cmd) {
  return cproc.execSync(cmd, { stdio: "inherit" })
}

const image = process.argv[2]
const shell = image.includes("alpine") ? "/bin/sh" : "/bin/bash"

if (!image) {
  throw new Error("No image specified")
}

if (image === "collector") {
  exec(
    "docker compose -f docker/docker-compose.yml logs --since 2m -f otel-collector udpdump",
  )
} else if (image === "logs") {
  exec("docker compose -f docker/docker-compose.yml logs")
} else if (image === "down") {
  exec("docker compose -f docker/docker-compose.yml down")
} else if (process.argv[3] === "build") {
  exec(`docker compose -f docker/docker-compose.yml build ${image}`)
} else {
  require("./env.js")
  const env = Object.entries(process.env)
    .filter(
      ([key]) =>
        key.startsWith("SW_APM_") ||
        key.startsWith("OTEL_") ||
        key.startsWith("AWS_LAMBDA_"),
    )
    .map(([k, v]) => `-e ${k}=${v}`)
    .join(" ")

  // first run yarn install in the context of the container so that platform specific modules get installed
  // then start a shell session with `|| true` so that if the last ran command in the shell errors node doesn't throw
  // finally run yarn install back on the host to reset the platform specific modules
  exec(
    `docker compose -f docker/docker-compose.yml run ${env} --rm ${image} '(yarn install) && (${shell} || true)'; yarn install`,
  )
}
