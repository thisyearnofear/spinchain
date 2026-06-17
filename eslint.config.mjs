import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Allow underscore-prefixed unused variables (intentional)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }]
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/.cre_build_tmp.js",
    "app/lib/chainlink/**/*.js",
    // Non-app trees. Without these, a bare `eslint` from the repo root
    // walks contracts/evm/.pnpm/** (thousands of dependency files) and
    // aborts the process (SIGABRT) before linting any source.
    "**/.pnpm/**",
    "contracts/**",
    "circuits/**",
    "ios/**",
    "android/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
