import { init } from "./init"

try {
  init("swo.config")
} catch (err) {
  console.warn(err)
}
