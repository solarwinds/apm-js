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

const js = require("@eslint/js")
const ts = require("typescript-eslint")
const prettier = require("eslint-config-prettier")
const imports = require("eslint-plugin-simple-import-sort")
const header = require("eslint-plugin-header")
const tsdoc = require("eslint-plugin-tsdoc")
const deprecation = require("eslint-plugin-deprecation")
const globals = require("globals")

const noticeTemplate = `
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

const notice = noticeTemplate
  .replace("[yyyy]", year)
  .replace("[name of copyright owner]", holder)

// don't count variables starting with an underscore as unused
const unusedOptions = {
  vars: "all",
  varsIgnorePattern: "^_",
  args: "all",
  argsIgnorePattern: "^_",
  caughtErrors: "all",
  caughtErrorsIgnorePattern: "^_",
  ignoreRestSiblings: false,
}

module.exports = ts.config(
  // dist folder is always generated
  { ignores: ["dist/**"] },
  // extend from eslint's recommendations as a baseline
  js.configs.recommended,
  // js files assume node environment with es2022
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 13,
      globals: { ...globals.es2021, ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", unusedOptions],
    },
  },
  // ts files use typescript-eslint and some extra rules
  {
    files: ["**/*.ts"],
    extends: [
      ...ts.configs.strictTypeChecked,
      ...ts.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        EXPERIMENTAL_useProjectService: true,
      },
    },
    plugins: { tsdoc, deprecation },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": ["warn", unusedOptions],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "warn",
        {
          allowNumber: true,
        },
      ],
      "tsdoc/syntax": "warn",
      "deprecation/deprecation": "warn",
    },
  },
  // imports and license notices
  {
    files: ["**/*.js", "**/*.ts"],
    plugins: { imports, header },
    rules: {
      "imports/imports": "warn",
      "imports/exports": "warn",
      "header/header": ["error", "block", notice, 2],
    },
  },
  // disable rules that conflict with prettier
  prettier,
)
