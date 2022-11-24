const globals = require("globals")
const prettier = require("eslint-config-prettier")
const typescriptParser = require("@typescript-eslint/parser")
const typescriptPlugin = require("@typescript-eslint/eslint-plugin")
const tsdocPlugin = require("eslint-plugin-tsdoc")
const jestPlugin = require("eslint-plugin-jest")

// we use the new ESLint config formats which lets us alias plugins
// so it's useful to be able to also alias the rules provided in their recommended configs
const mapRules = (rules, oldKey = "", newKey = "") =>
  Object.fromEntries(
    Object.entries(rules).map(([k, v]) => [k.replace(oldKey, newKey), v]),
  )

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
  "eslint:recommended",
  // use jest plugin and recommended configs in tests
  {
    files: ["**/*.test.js", "**/*.test.ts"],
    languageOptions: {
      globals: globals.jest,
    },
    plugins: { jest: jestPlugin },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      ...jestPlugin.configs.style.rules,
    },
  },
  // js files assume node environment with es2020
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 11,
      globals: { ...globals.es2020, ...globals.commonjs, ...globals.node },
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
      parserOptions: { project: ["./tsconfig.json"] },
    },
    plugins: { ts: typescriptPlugin, tsdoc: tsdocPlugin },
    rules: {
      // the typescript plugin provides an "eslint-recommended" config which disables eslint recommended rules
      // that conflict with typescript
      ...typescriptPlugin.configs["eslint-recommended"].overrides[0].rules,
      // extends from typescript recommended config
      ...mapRules(
        typescriptPlugin.configs["recommended"].rules,
        "@typescript-eslint",
        "ts",
      ),
      // also use rules that require type information
      ...mapRules(
        typescriptPlugin.configs["recommended-requiring-type-checking"].rules,
        "@typescript-eslint",
        "ts",
      ),
      // also use the typescript recommended strict rules
      ...mapRules(
        typescriptPlugin.configs["strict"].rules,
        "@typescript-eslint",
        "ts",
      ),
      // since we use "noUncheckedIndexedAccess" we need non-null assertions
      "ts/no-non-null-assertion": "off",
      "ts/no-unused-vars": ["warn", unusedOptions],
      "tsdoc/syntax": "warn",
    },
  },
  // disable rules that conflict with prettier
  { rules: prettier.rules },
]
