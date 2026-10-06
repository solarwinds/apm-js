/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

import { defineConfig, type OxlintConfig } from "oxlint"
import recommended from "oxlint-config-presets/@eslint/recommended.json" with { type: "json" }
import tsStrict from "oxlint-config-presets/@typescript-eslint/strict-type-checked.json" with { type: "json" }
import tsStylistic from "oxlint-config-presets/@typescript-eslint/stylistic-type-checked.json" with { type: "json" }

import base from "../../../.oxlintrc.json" with { type: "json" }

const license = `/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/`

export default defineConfig({
	extends: [base as OxlintConfig, recommended],
	plugins: ["oxc", "eslint", "import", "node", "promise"],
	jsPlugins: ["eslint-plugin-license-header"],
	categories: {
		correctness: "error",
		suspicious: "warn",
		perf: "warn",
	},
	rules: {
		"license-header/header": ["error", license.split("\n")],
		"no-unused-vars": [
			"warn",
			{
				vars: "all",
				varsIgnorePattern: "^_",
				args: "all",
				argsIgnorePattern: "^_",
				caughtErrors: "all",
				caughtErrorsIgnorePattern: "^_",
			},
		],
		"no-shadow": "off",
		"no-underscore-dangle": "off",
		"import/no-cycle": "warn",
		"import/no-unassigned-import": "off",
		"promise/always-return": "off",
	},
	overrides: [
		{
			files: ["*.{js,cjs,mjs}"],
			plugins: ["oxc", "eslint", "import", "node", "promise"],
			env: {
				node: true,
			},
		},
		{
			files: ["*.{ts,cts,mts}"],
			plugins: ["oxc", "eslint", "typescript", "import", "node", "jsdoc", "promise"],
			rules: {
				...(tsStrict.rules as {}),
				...(tsStylistic.rules as {}),

				"typescript/consistent-type-imports": [
					"warn",
					{
						prefer: "type-imports",
						fixStyle: "inline-type-imports",
						disallowTypeAnnotations: false,
					},
				],
				"typescript/restrict-template-expressions": [
					"warn",
					{
						allowNumber: true,
					},
				],
				"typescript/no-deprecated": "warn",

				"typescript/consistent-return": "off",
				"typescript/no-empty-object-type": "off",
				"typescript/no-non-null-assertion": "off",
				"typescript/no-unsafe-type-assertion": "off",
				"typescript/prefer-literal-enum-member": "off",
			},
		},
		{
			files: ["*.test.{js,ts}"],
			rules: {
				"no-unused-expressions": "off",
			},
		},
		{
			files: ["*.{cjs,cts}"],
			env: {
				commonjs: true,
			},
		},
		...tsStrict.overrides!,
		...tsStylistic.overrides!,
	],
})
