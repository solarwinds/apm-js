import { init } from "./init"

export { type ConfigFile } from "./config"

try {
  init("swo.config")
} catch (err) {
  console.warn(err)
}
