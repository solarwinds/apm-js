/*
Copyright 2023 SolarWinds Worldwide, LLC.

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
const globals = require("globals")
const prettier = require("eslint-config-prettier")
const typescriptParser = require("@typescript-eslint/parser")
const typescriptPlugin = require("@typescript-eslint/eslint-plugin")
const tsdocPlugin = require("eslint-plugin-tsdoc")
const importsPlugin = require("eslint-plugin-simple-import-sort")
const headerPlugin = require("eslint-plugin-header")

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

module.exports = [
  // dist folder is always generated
  { ignores: ["dist/**"] },
  // extend from eslint's recommendations as a baseline
  js.configs.recommended,
  // js files assume node environment with es2021
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 12,
      globals: { ...globals.es2021, ...globals.commonjs, ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", unusedOptions],
    },
  },
  // ts files require their own parser and plugins
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      // here we make the assumption that the tsconfig.json is in the root of the project and named that way
      parserOptions: {
        project: true,
        EXPERIMENTAL_useSourceOfProjectReferenceRedirect: true,
      },
    },
    rules: {
      // the typescript plugin provides an "eslint-recommended" config which disables eslint recommended rules
      // that conflict with typescript
      ...typescriptPlugin.configs["eslint-recommended"].overrides[0].rules,
    },
  },
  // ts sources
  {
    files: ["**/*.ts"],
    ignores: ["**/*.d.ts"],
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      tsdoc: tsdocPlugin,
      imports: importsPlugin,
    },
    rules: {
      // extends from typescript strict config
      ...typescriptPlugin.configs["strict-type-checked"].rules,
      // also use the typescript stylistic rules
      ...typescriptPlugin.configs["stylistic-type-checked"].rules,
      // since we use "noUncheckedIndexedAccess" we need non-null assertions
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
      "tsdoc/syntax": "warn",
      "imports/imports": "warn",
      "imports/exports": "warn",
    },
  },
  // ts declarations
  {
    files: ["**/*.d.ts"],
    rules: {
      "no-unused-vars": "off",
    },
  },
  // license notices
  {
    files: ["**/*.js", "**/*.ts"],
    plugins: { header: headerPlugin },
    rules: {
      "header/header": ["error", "block", notice, 2],
    },
  },
  // disable rules that conflict with prettier
  prettier,
]
