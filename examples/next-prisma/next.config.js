/** @type {import('next').NextConfig} */
module.exports = {
  serverExternalPackages: ["solarwinds-apm"],
  // the following is only necessary due to a bug in how next.js handles monorepos
  // it is not necessary to include in your own config
  webpack: (config) => {
    config.externals.push({
      "solarwinds-apm": "module solarwinds-apm",
    })
    return config
  },
}
