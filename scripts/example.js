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

import "dotenv/config"

import { execSync } from "node:child_process"
import process from "node:process"

const example = process.argv[2]
const collector = process.argv.slice(3).includes("collector")
const proxy = process.argv.slice(3).includes("proxy")

function exec(cmd) {
  return execSync(cmd, { stdio: "inherit" })
}

// build example and its deps outside of the container
exec(`turbo run build --filter=./examples/${example}...`)

// get env vars that will be passed to the container
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      key.startsWith("SW_APM_") ||
      key.startsWith("OTEL_") ||
      key.startsWith("AWS_LAMBDA_"),
  ),
)
if (collector) {
  env.SW_APM_COLLECTOR = "apm-collector:12224"
  env.SW_APM_TRUSTED_PATH =
    "/solarwinds-apm/docker/apm-collector/server-grpc.crt"
  env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://otel-collector:4318"
}
if (proxy) {
  env.SW_APM_PROXY = "http://proxy:3128"
}

// run example inside container
const dockerEnv = Object.entries(env)
  .map(([k, v]) => `-e ${k}=${v}`)
  .join(" ")
exec(
  `docker compose -f docker/docker-compose.yml run ${dockerEnv} -e PORT=8080 -p 8080:8080 --rm example 'cd ./examples/${example} && yarn install && (yarn start || true)'; yarn install`,
)
