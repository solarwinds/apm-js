function triple() {
  const platform = process.platform
  const arch = process.arch

  if (platform === "linux") {
    const glibc = process.report.getReport().header.glibcVersionRuntime
    const abi = glibc ? "gnu" : "musl"

    return `linux-${arch}-${abi}`
  } else {
    return `${platform}-${arch}`
  }
}

const t = triple()
try {
  module.exports = require(`@swotel/bindings-${t}`)
} catch (err) {
  module.exports = new Error(`unsupported platform ${t}`, { cause: err })
}
