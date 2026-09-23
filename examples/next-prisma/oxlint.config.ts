import { defineConfig } from "oxlint"

export default defineConfig({
	plugins: ["oxc", "eslint", "typescript", "nextjs"],
	categories: {
		correctness: "error",
		suspicious: "warn",
		perf: "warn",
	},
})
