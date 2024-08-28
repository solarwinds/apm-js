/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const path = require("node:path")

const js = require("@eslint/js")
const ts = require("typescript-eslint")
const prettier = require("eslint-config-prettier")
const imports = require("eslint-plugin-simple-import-sort")
const notice = require("eslint-plugin-notice")

const licenseTemplate = `
Copyright [yyyy] [name of copyright owner]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
`

// Ensures the license notice is kept up to date
const initialYear = 2023
const currentYear = new Date().getFullYear()
const year =
  currentYear === initialYear ? currentYear : `${initialYear}-${currentYear}`

const holder = "SolarWinds Worldwide, LLC."

const license = licenseTemplate
  .replace("[yyyy]", year)
  .replace("[name of copyright owner]", holder)
  .trim()

module.exports = ({ allowDefaultProject = ["*.js", "*.cjs", "*.mjs"] } = {}) =>
  ts.config(
    // dist folder is always ignored
    { ignores: ["dist/**"] },
    // all files use typescript-eslint as a baseline
    {
      files: [
        "**/*.js",
        "**/*.cjs",
        "**/*.mjs",
        "**/*.ts",
        "**/*.cts",
        "**/*.mts",
      ],
      extends: [
        js.configs.recommended,
        ...ts.configs.stylistic,
        ...ts.configs.strict,
      ],
      plugins: { imports, notice },
      languageOptions: {
        parserOptions: {
          projectService: {
            allowDefaultProject,
            defaultProject: path.join(__dirname, "../../tsconfig.base.json"),
          },
        },
      },
      rules: {
        "imports/imports": "warn",
        "imports/exports": "warn",
        "notice/notice": ["error", { template: `/*\n${license}\n*/\n\n` }],

        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-require-imports": "off",
        // don't count variables starting with an underscore as unused
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            vars: "all",
            varsIgnorePattern: "^_",
            args: "all",
            argsIgnorePattern: "^_",
            caughtErrors: "all",
            caughtErrorsIgnorePattern: "^_",
            ignoreRestSiblings: false,
          },
        ],
      },
    },
    // ts files use extra rules enabled by type checking
    {
      files: ["**/*.ts", "**/*.cts", "**/*.mts"],
      extends: [
        ...ts.configs.stylisticTypeCheckedOnly,
        ...ts.configs.strictTypeCheckedOnly,
      ],
      rules: {
        "@typescript-eslint/consistent-type-imports": [
          "warn",
          {
            prefer: "type-imports",
            fixStyle: "inline-type-imports",
            disallowTypeAnnotations: false,
          },
        ],
        "@typescript-eslint/prefer-literal-enum-member": "off",
        "@typescript-eslint/restrict-template-expressions": [
          "warn",
          {
            allowNumber: true,
          },
        ],
        "@typescript-eslint/no-deprecated": "warn",
        "@typescript-eslint/no-require-imports": "error",
      },
    },
    // chai assertions in tests are treated as unused expressions
    {
      files: ["**/*.test.*"],
      rules: {
        "@typescript-eslint/no-unused-expressions": "off",
      },
    },
    // disable rules that conflict with prettier
    prettier,
  )
