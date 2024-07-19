import fs from "node:fs"
import path from "node:path"
import satisfies from "semver/functions/satisfies.js"

try {
  const BUNDLED_API = "/opt/solarwinds-apm/node_modules/@opentelemetry/api"
  const dirs = []

  // Add relative node_modules dirs to the search paths
  const TASK_ROOT = process.env.LAMBDA_TASK_ROOT
  if (TASK_ROOT) {
    let dir = TASK_ROOT
    while (true) {
      dirs.push(path.join(dir, "node_modules"))

      const parent = path.dirname(dir)
      if (dir !== parent) {
        dir = parent
      } else {
        break
      }
    }
  }

  // Add entries from NODE_PATH to the search paths
  const NODE_PATH = process.env.NODE_PATH?.split(":") ?? []
  dirs.push(...NODE_PATH)

  // Search for a use-provided OTel API
  for (const dir of dirs) {
    const api = path.join(dir, "@opentelemetry", "api")
    let version
    try {
      // Try and read the package.json version in this search path
      version = JSON.parse(
        fs.readFileSync(path.join(api, "package.json"), { encoding: "utf-8" }),
      ).version
    } catch {
      // No valid package.json found, search next path
      continue
    }

    try {
      // Try and override our bundled OTel API if the user provides it
      if (satisfies(version, "{{api-version}}")) {
        fs.rmSync(BUNDLED_API, { recursive: true, force: true })
        fs.symlinkSync(api, BUNDLED_API)
      }
    } catch {
      // Something is wrong, bail
      break
    }
  }

  await import("{{name}}")
} catch (error) {
  console.error(error)
}
