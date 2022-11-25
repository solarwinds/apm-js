const process = require("node:process")
const cproc = require("node:child_process")

const shells = {
  alpine: "/bin/sh",
  centos: "/bin/bash",
  debian: "/bin/bash",
}

const image = process.argv[2]
const shell = shells[image]

if (process.argv[3] === "build") {
  cproc.execSync(`docker compose -f docker/docker-compose.yml build ${image}`, {
    stdio: "inherit",
  })
} else {
  // first run yarn install in the context of the container so that platform specific modules get installed
  // then start a shell session with `|| true` so that if the last ran command in the shell errors node doesn't throw
  // finally run yarn install back on the host to reset the platform specific modules
  cproc.execSync(
    `docker compose -f docker/docker-compose.yml run --rm ${image} '(yarn install) && (${shell} || true)'; yarn install`,
    {
      stdio: "inherit",
    },
  )
}
