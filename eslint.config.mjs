import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

/**
 * A zone may not import another zone's features (00-master-plan.md §3). One app serves
 * three audiences, so this is the rule that keeps admin code out of the storefront bundle —
 * and, more to the point, keeps a customer-facing screen from ever rendering something that
 * assumes a staff session.
 *
 * `src/ui`, `src/features/shared`, `src/features/designer`, `src/domain`, `src/i18n` and
 * `src/lib` stay importable from everywhere: they are the shared middle.
 */
/** The `src/app` routes and the `src/features` folder that belong to one zone. */
const ZONE_FILES = {
  // `src/app/**` minus the other two zones, rather than `src/app/[locale]/**`: a flat-config
  // glob is minimatch, so `[locale]` would be read as a character class and match nothing
  // that exists. It also correctly covers the customer routes outside the locale segment,
  // such as `src/app/bff`.
  customer: { files: ["src/app/**", "src/features/customer/**"], ignores: ["src/app/admin/**", "src/app/partner/**"] },
  admin: { files: ["src/app/admin/**", "src/features/admin/**"] },
  partner: { files: ["src/app/partner/**", "src/features/partner/**"] },
};

function zoneBoundary(zone, forbidden) {
  return {
    ...ZONE_FILES[zone],
    rules: {
      // Two rules, because they catch different mistakes. `no-restricted-imports` matches
      // the import *string*, which is what an alias import is; `import/no-restricted-paths`
      // resolves the specifier to a file, which is the only way to catch a relative path
      // that climbs out of the zone (`../../admin/orders`).
      "no-restricted-imports": [
        "error",
        {
          patterns: forbidden.map((other) => ({
            group: [`@/features/${other}`, `@/features/${other}/*`],
            message: boundaryMessage(other),
          })),
        },
      ],
      "import/no-restricted-paths": [
        "error",
        {
          // `target` is the whole app because the `files` glob above has already narrowed
          // this rule to one zone's files; naming the zone twice would only let the two
          // definitions drift.
          zones: forbidden.map((other) => ({
            target: "./src",
            from: `./src/features/${other}`,
            message: boundaryMessage(other),
          })),
        },
      ],
    },
  };
}

function boundaryMessage(zone) {
  return `Zone boundary (00-master-plan.md §3): this file may not import features/${zone}. Move the shared part to src/features/shared, src/ui or src/domain.`;
}

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
    rules: {
      // A parameter named `_x` is a signature a caller depends on but this implementation
      // does not need — a seam waiting for a later deliverable, or a callback that ignores
      // its first argument. Unused *variables* are still reported.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^$" }],
    },
  },

  zoneBoundary("customer", ["admin", "partner"]),
  zoneBoundary("admin", ["customer", "partner"]),
  zoneBoundary("partner", ["customer", "admin"]),

  {
    // `@packio/dieline` is published on its own (ADR-0007): box geometry that knows nothing
    // about this app. An import from `src/` would make it unpublishable.
    files: ["packages/*/src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*", "**/src/lib/*", "**/src/ui/*", "**/src/features/*"],
              message: "packages/* are published independently (ADR-0007) and may not import from this app's src/.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
