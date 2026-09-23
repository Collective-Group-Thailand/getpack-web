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
    // Every eslint-disable in this repo must carry its reason. The three that remain are the
    // mount-time localStorage reads and the fit-to-measured-viewport effect in the designer,
    // each explained where it sits; F4 Part B removes the first two with the designs API.
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
];

export default eslintConfig;
