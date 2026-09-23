import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

// eslint-config-next 16 ships native flat configs, so FlatCompat/@eslint/eslintrc is gone.
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "storybook-static/**",
      "legacy/**",
      "packages/*/dist/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  prettier,
  {
    // The React Compiler rules that eslint-config-next 16 turns on flag four pre-existing
    // patterns in the designer that was inherited from BoxStudio (setState inside the
    // localStorage load effects, and a useMemo the compiler cannot preserve). F0.1 must move
    // that code without changing its behaviour, so they stay visible as warnings and are
    // fixed in F0 Session 0.2, when the designer UI is rebuilt on src/ui.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
