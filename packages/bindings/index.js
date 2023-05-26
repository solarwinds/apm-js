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

function nativeRequireAssign(name, exports) {
  const t = triple()
  try {
    exports[name] = require(`@swotel/bindings-${t}/${name}.node`)
  } catch (cause) {
    exports[name] = new Error(`unsupported platform ${t}`, { cause })
  }
}

const e = (module.exports = {})
nativeRequireAssign("oboe", e)
nativeRequireAssign("metrics", e)
