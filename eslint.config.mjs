import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

import noMoneyArithmetic from "./eslint-rules/no-money-arithmetic.mjs";
import noStockPhotos from "./eslint-rules/no-stock-photos.mjs";

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

/**
 * Attributes that are read aloud or shown to a person.
 *
 * A screen reader user hears `aria-label`, so an untranslated one is an English-only
 * screen for exactly the audience least able to work around it (design-system.md §6).
 * `alt` is required by the component API already; this makes sure it is not a literal.
 * An empty `alt=""` is exempt: that is the standard way to mark an image decorative, and
 * it is the absence of copy rather than untranslated copy.
 */
const UNTRANSLATED_ATTRIBUTE = {
  selector:
    "JSXAttribute[name.name=/^(alt|title|placeholder|aria-label|aria-placeholder|aria-roledescription|aria-valuetext|aria-description)$/] > Literal[value!='']",
  message:
    "This attribute is read by a person or a screen reader, so its text belongs in src/i18n (design-system.md §8). Pass a translated string instead of a literal.",
};

/**
 * Token-usage rules of the art direction (D-180), matched in class strings — plain literals
 * and template-literal parts, which is where `className` and `cva` keep them. A utility starts
 * the string or follows a space, a variant colon or `!`.
 *
 * What a linter cannot see — that teal is only ever on an action — is documented in Storybook
 * (Docs/Tokens) and left to review.
 */
function classPattern(regex, message) {
  return [
    { selector: `Literal[value=${regex}]`, message },
    { selector: `TemplateElement[value.raw=${regex}]`, message },
  ];
}

const UTILITY_START = "(^|[\\s:!])";

/** Kraft tones are surfaces and illustration, never text. */
const KRAFT_AS_TEXT = classPattern(
  `/${UTILITY_START}(text|placeholder|caret|decoration)-kraft/`,
  "Kraft tones are for surfaces and illustration only, never text (D-180). Use text-fg or text-muted.",
);

/** Components name semantic tokens; a primitive step bypasses the themes and the contrast gate. */
const PRIMITIVE_PALETTE = classPattern(
  `/${UTILITY_START}(bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide|shadow|placeholder|caret)-(neutral|brand|green|orange|amber|red|blue)-(50|[1-9]00|950)\\b/`,
  "Raw palette steps skip the themes and the contrast gate (ADR-0003). Use a semantic token such as bg-surface, text-muted or bg-primary.",
);

/** Amber is for promotions and kraft for decoration; zones reach both through src/ui components. */
const ACCENT_OR_KRAFT_OUTSIDE_UI = classPattern(
  `/${UTILITY_START}(bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide|shadow)-(accent|kraft)(-|\\b)/`,
  'accent (amber) is for promotions only and kraft for decoration only (D-180). Use <Badge tone="accent"> for a campaign badge, or add the decorative piece to src/ui.',
);

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
      // Generated from the OpenAPI contract (ADR-0006). Regenerate with `pnpm gen:api`;
      // `pnpm gen:api --check` in CI is what keeps them honest, not the linter.
      "src/lib/api/schema.d.ts",
      "src/lib/api/schema.seed.d.ts",
      "mocks/generated/**",
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

  {
    /**
     * UI copy comes from `src/i18n`, not from JSX (design-system.md §8).
     *
     * A hard-coded string is not a style problem: it is a string that will never be
     * translated, never reviewed against `docs/ui/voice-and-tone.md`, and never found when
     * someone greps for wording to change. Thai is the default locale and English is a real
     * audience, so a literal that slips through ships a half-English screen.
     *
     * `src/ui` is included deliberately. Its components take their copy as props
     * (`skipLabel`, `label`, `choiceLabels`) precisely so they stay usable in Storybook and
     * in exports — a primitive with a Thai string baked in breaks both.
     *
     * `allowedStrings` is punctuation, not copy: a separator between two translated parts, a
     * required marker, a currency sign, an arrow. Anything with meaning goes through
     * `src/i18n`, and anything numeric through `formatTHB` or the date formatters in
     * `src/i18n/format.ts`.
     */
    files: ["src/app/**/*.tsx", "src/features/**/*.tsx", "src/ui/**/*.tsx"],
    ignores: ["**/*.stories.tsx", "**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          // `ignoreProps: false` would flag `type="button"`, `name="email"` and every
          // className in the repo — 350-odd findings, none of them copy, which is how a rule
          // gets switched off. The attributes that *are* copy are caught precisely below.
          ignoreProps: true,
          allowedStrings: [
            "·",
            "—",
            "–",
            "-",
            "/",
            "|",
            ":",
            ",",
            ".",
            "×",
            "+",
            "@",
            "?",
            "!",
            "฿",
            "%",
            "#",
            "*",
            "→",
            "©",
            // The home ticker's separator (design language v2).
            "✦",
          ],
          // `elementOverrides` would be the natural way to exempt `<Kbd>`, but it crashes
          // eslint-plugin-react 7.37.5: enabling it registers a `VariableDeclaration` visitor
          // that calls `isRequireStatement(d.init)` without a null check, so any `let x;` in
          // the codebase takes the whole lint run down. Keycaps come from `KEYCAP` in
          // `src/ui/components/Kbd.tsx` instead, which is where the ⌘/Ctrl split belongs
          // anyway.
        },
      ],

      // The other half of the copy rule, plus the D-180 colour rules — see the constants at
      // the top. One `no-restricted-syntax` list, because a later config object naming the
      // same rule replaces this one's options rather than adding to them.
      "no-restricted-syntax": ["error", UNTRANSLATED_ATTRIBUTE, ...KRAFT_AS_TEXT, ...PRIMITIVE_PALETTE],
    },
  },

  {
    // Zones may not reach for the promotional amber or the kraft tones directly: they get them
    // through `src/ui` components (`<Badge tone="accent">`, `SectionDivider`), which is where
    // "amber = promotions only" can be kept true (D-180).
    files: ["src/app/**/*.tsx", "src/features/**/*.tsx"],
    ignores: ["**/*.stories.tsx", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        UNTRANSLATED_ATTRIBUTE,
        ...KRAFT_AS_TEXT,
        ...PRIMITIVE_PALETTE,
        ...ACCENT_OR_KRAFT_OUTSIDE_UI,
      ],
    },
  },

  {
    // Stories may show anything, but kraft is still never text.
    files: ["src/**/*.stories.tsx"],
    rules: { "no-restricted-syntax": ["error", ...KRAFT_AS_TEXT] },
  },

  {
    // The storefront formats prices and strengths and never computes them (CLAUDE.md; U2.F1 §7).
    files: ["src/features/customer/**/*.{ts,tsx}", "src/features/shared/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.stories.tsx"],
    plugins: { packio: { rules: { "no-money-arithmetic": noMoneyArithmetic } } },
    rules: { "packio/no-money-arithmetic": "error" },
  },

  {
    // Photos come from the CMS, never a stock library (Phase 4 §4.6) — in every zone and in the mocks.
    files: ["src/**/*.{ts,tsx}", "mocks/**/*.ts"],
    plugins: { "packio-photos": { rules: { "no-stock-photos": noStockPhotos } } },
    rules: { "packio-photos/no-stock-photos": "error" },
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
