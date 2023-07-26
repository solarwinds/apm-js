/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    instrumentationHook: true,
    serverActions: true,
  },
  webpack: (config) => {
    config.externals.push({
      "solarwinds-apm": "commonjs solarwinds-apm",
    })
    return config
  },
}
