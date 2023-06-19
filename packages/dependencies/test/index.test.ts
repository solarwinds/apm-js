import { dependencies } from "../src"
import { type PnpApi } from "../src/pnp-api"

// eslint-disable-next-line
const pnpApi = require("node:module").findPnpApi(__dirname) as PnpApi
// eslint-disable-next-line
const packageJson = require("../package.json") as {
  devDependencies: Record<string, string>
}

it.each(Object.keys(packageJson.devDependencies))("detects %s", (name) => {
  const deps = dependencies(pnpApi)
  expect(deps.has(name)).toBe(true)
})
