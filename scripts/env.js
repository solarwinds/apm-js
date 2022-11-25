const fs = require("node:fs")
const path = require("node:path")

const envPath = path.join(__dirname, "..", ".env")

if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, "utf8")
  const kvs = contents
    .split("\n")
    .map((l) => l.split("=", 2).map((s) => s.trim()))
    .filter((l) => l.length == 2)
  Object.assign(process.env, Object.fromEntries(kvs))
}
