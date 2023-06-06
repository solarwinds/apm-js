const process = require("node:process")
const cproc = require("node:child_process")

require("./env.js")

const example = process.argv[2]
const collector = process.argv[3] === "collector"

function exec(cmd) {
  return cproc.execSync(cmd, { stdio: "inherit" })
}

// build example and its deps outside of the container
exec(`turbo run build --filter=./examples/${example}...`)

// get env vars that will be passed to the container
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key.startsWith("SW_APM_")),
)
if (collector) {
  env.SW_APM_COLLECTOR = "apm-collector:12224"
  env.SW_APM_TRUSTED_PATH = "/swotel/docker/apm-collector/server-grpc.crt"
}

// run example inside container
const dockerEnv = Object.entries(env)
  .map(([k, v]) => `-e ${k}=${v}`)
  .join(" ")
exec(
  `docker compose -f docker/docker-compose.yml run ${dockerEnv} -e PORT=8080 -p 8080:8080 --rm 18-alpine 'cd ./examples/${example} && yarn install && (yarn start || true)'; yarn install`,
)
