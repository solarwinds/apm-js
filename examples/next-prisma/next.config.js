/** @type {import("next").NextConfig} */
export default {
	serverExternalPackages: ["solarwinds-apm", "@opentelemetry/api", "@prisma/adapter-libsql"],
	// only required because this example is part of the monorepo
	webpack: (config) => {
		config.externals.push({
			"solarwinds-apm": "module solarwinds-apm",
		})
		return config
	},
}
