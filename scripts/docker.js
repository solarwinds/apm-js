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
} else if (image === "down") {
  exec("docker compose -f docker/docker-compose.yml down")
} else if (process.argv[3] === "build") {
  exec(`docker compose -f docker/docker-compose.yml build ${image}`)
} else {
  // first run yarn install in the context of the container so that platform specific modules get installed
  // then start a shell session with `|| true` so that if the last ran command in the shell errors node doesn't throw
  // finally run yarn install back on the host to reset the platform specific modules
  exec(
    `docker compose -f docker/docker-compose.yml run --rm ${image} '(yarn install) && (${shell} || true)'; yarn install`,
  )
}
