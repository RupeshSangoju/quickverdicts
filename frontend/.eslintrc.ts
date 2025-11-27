import type { Linter } from "eslint";

const config: Linter.Config = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    "next",
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
  ],
  plugins: [
    "@typescript-eslint",
    "unused-imports",
  ],
  rules: {
    /**
     * === JSX text rules ===
     * Disable error for unescaped characters like ' and " in JSX
     */
    "react/no-unescaped-entities": "off",

    /**
     * === Unused variables ===
     * Ignore args/vars/catch params that start with "_"
     */
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],

    /**
     * === Unused imports plugin ===
     * Automatically remove unused imports when running --fix
     */
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      },
    ],
  },

  /**
   * Ignore certain folders completely
   */
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".next/",
    "public/",
    "scripts/",
    "legacy/",
  ],
};

export default config;