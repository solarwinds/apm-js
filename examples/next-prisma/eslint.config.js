import coreWebVitals from "eslint-config-next/core-web-vitals"

export default [
  ...coreWebVitals,
  {
    files: ["*.config.js", "*.config.ts"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    ignores: ["app/db/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
]
