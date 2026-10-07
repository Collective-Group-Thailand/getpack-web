import type { Meta, StoryObj } from "@storybook/react-vite";

import { contrastRatio, oklchToHex } from "../tokens/color";
import { ART, PALETTES, PRINT, STATUS, STEPS } from "../tokens/primitives";
import { CUSTOMER_CTA_RADIUS, DURATION, EASING, FONT_SIZE, RADIUS, SHADOW } from "../tokens/scale";
import { SEMANTIC_KEYS, THEME_NAMES, THEMES, type SemanticKey, type ThemeName } from "../tokens/semantic";

/**
 * A live token reference, generated from the same TypeScript the CSS is generated from — so it
 * cannot drift from what ships, and the ratios shown are the ratios the gate asserts.
 */
const meta = {
  title: "Docs/Tokens",
  parameters: {
    docs: {
      description: {
        component:
          "Three tiers: primitive → semantic → component (ADR-0003). Components name only the " +
          "semantic tier. Every ratio below is computed from the tokens themselves, by the same " +
          "code `pnpm test` uses as a gate.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ colour, name, ratioAgainst }: { colour: SemanticKey; name: string; ratioAgainst?: SemanticKey }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-10 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: `var(--color-${colour})` }}
      />
      <span className="min-w-0">
        <code className="block text-xs">{name}</code>
        {ratioAgainst ? <span className="block text-xs text-muted">vs {ratioAgainst}</span> : null}
      </span>
    </div>
  );
}

/** What each art-direction colour is for (design-system.md §Art direction). */
const ART_USE: Record<keyof (typeof ART)["light"], string> = {
  "paper-50": "page background",
  "paper-100": "section band (bg-subtle)",
  surface: "cards, image plates",
  "kraft-200": "decorative fills, dieline art",
  "kraft-400": "illustration accents — never text",
  border: "hairline borders",
  "ink-900": "primary text",
  "ink-600": "secondary text",
  "primary-600": "actions, links, active nav",
  "primary-700": "hover / pressed",
  "primary-50": "tints, selected states",
  "accent-500": "promotions only",
};

export const ArtDirection: Story = {
  name: "Art direction (D-180)",
  parameters: {
    docs: {
      description: {
        story:
          "The proposed Packio palette, verbatim from design-system.md §Art direction; replaced " +
          "wholesale when a brand kit arrives (tokens only). Dark primary-700 is shown as " +
          "proposed — it fails AA, so dark hover uses a lighter step (see PROGRESS).",
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 md:grid-cols-2">
        {(["light", "dark"] as const).map((theme) => (
          <div key={theme}>
            <p className="mb-2 text-sm font-medium">{theme}</p>
            <ul className="grid gap-2">
              {Object.entries(ART[theme]).map(([name, colour]) => (
                <li key={name} className="flex items-center gap-3">
                  <span
                    className="border-border size-9 shrink-0 rounded-control border"
                    style={{ backgroundColor: oklchToHex(colour) }}
                  />
                  <span className="min-w-0 text-sm">
                    <code className="block text-xs">
                      --c-{name} · {oklchToHex(colour).toUpperCase()}
                    </code>
                    <span className="text-muted block text-xs">{ART_USE[name as keyof typeof ART_USE]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">status (light) — status only, always with icon and words</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS).map(([name, colour]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="size-6 rounded-control" style={{ backgroundColor: oklchToHex(colour) }} />
              <code className="text-xs">
                {name} {oklchToHex(colour).toUpperCase()}
              </code>
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-2xl">
        <p className="mb-2 text-sm font-medium">usage rules</p>
        <ul className="text-muted list-disc ps-5 text-sm">
          <li>
            <strong className="text-fg">Teal is for actions only</strong> — buttons, links, active navigation, focus,
            selection. Not decoration, not a status. (Review; a linter cannot see intent.)
          </li>
          <li>
            <strong className="text-fg">Amber is for promotions only</strong> — <code>{'<Badge tone="accent">'}</code>{" "}
            for a real campaign (D-181). Warnings use the burnt-orange <code>warning</code>. ESLint rejects{" "}
            <code>*-accent</code> utilities outside <code>src/ui</code>.
          </li>
          <li>
            <strong className="text-fg">Kraft is never text</strong> — surfaces, illustration, dielines. ESLint rejects{" "}
            <code>text-kraft*</code> everywhere.
          </li>
          <li>Every semantic pair passes WCAG 2.2 AA in light, dark and high contrast — the gate in pnpm test.</li>
        </ul>
      </div>
    </div>
  ),
};

export const Palette: Story = {
  name: "Primitive palette",
  render: () => (
    <div className="flex flex-col gap-4">
      {Object.entries(PALETTES).map(([name, palette]) => (
        <div key={name}>
          <p className="mb-1 text-sm font-medium">
            {name}
            {name === "brand" ? (
              <span className="ms-2 text-xs text-muted">D-180 teal-green, until the brand kit — docs/ui/brand.md</span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-1">
            {STEPS.map((step) => (
              <div key={step} className="w-18">
                <div
                  className="h-10 rounded-sm border border-border"
                  style={{ backgroundColor: oklchToHex(palette[step]) }}
                  title={oklchToHex(palette[step])}
                />
                <p className="mt-0.5 text-center font-mono text-[10px] text-muted">{step}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div>
        <p className="mb-1 text-sm font-medium">print marks (never themed)</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(PRINT).map(([name, colour]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="h-1 w-8 rounded-full" style={{ backgroundColor: oklchToHex(colour) }} />
              <code className="text-xs">{name}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

export const Semantic: Story = {
  name: "Semantic tier",
  render: () => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SEMANTIC_KEYS.map((key) => (
        <Swatch key={key} colour={key} name={`--color-${key}`} />
      ))}
    </div>
  ),
};

const CHECKED_PAIRS: [SemanticKey, SemanticKey, number][] = [
  ["fg", "bg", 4.5],
  ["muted", "bg", 4.5],
  ["subtle", "bg", 3],
  ["primary", "bg", 4.5],
  ["primary-fg", "primary", 4.5],
  ["danger-fg", "danger", 4.5],
  ["primary-fg", "primary-hover", 4.5],
  ["accent-fg", "accent", 4.5],
  ["warning-fg", "warning", 4.5],
  ["success-subtle-fg", "success-subtle", 4.5],
  ["focus-ring", "bg", 3],
  ["border-strong", "bg", 3],
];

export const Contrast: Story = {
  name: "Contrast, measured",
  parameters: {
    docs: {
      description: {
        story:
          "Computed from the OKLCH tokens with browser-style gamut mapping. The full set of pairs × 3 " +
          "themes is asserted in `pnpm test` (`pnpm contrast` prints it) — this table is the readable view.",
      },
    },
  },
  render: () => (
    <table className="w-full max-w-2xl text-sm">
      <thead>
        <tr className="border-b border-border text-start">
          <th className="py-2 text-start font-medium">pair</th>
          <th className="py-2 text-start font-medium">min</th>
          {THEME_NAMES.map((theme) => (
            <th key={theme} className="py-2 text-start font-medium">
              {theme}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CHECKED_PAIRS.map(([fg, bg, min]) => (
          <tr key={`${fg}-${bg}`} className="border-b border-border">
            <td className="py-1.5">
              <code className="text-xs">
                {fg} on {bg}
              </code>
            </td>
            <td className="py-1.5 tabular-nums">{min}:1</td>
            {THEME_NAMES.map((theme: ThemeName) => {
              const ratio = contrastRatio(THEMES[theme][fg], THEMES[theme][bg]);
              return (
                <td key={theme} className="py-1.5 tabular-nums">
                  {ratio.toFixed(2)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {Object.keys(FONT_SIZE).map((size) => (
        <div key={size} className="flex items-baseline gap-4">
          <code className="w-16 shrink-0 text-xs text-muted">{size}</code>
          <p style={{ fontSize: `var(--text-${size})` }}>
            กล่องบรรจุภัณฑ์ Packio — 1,234.56 ฿
          </p>
        </div>
      ))}
      <h1 className="text-display mt-4 font-bold">กล่องที่ผลิตได้จริง — h1 clamp(2rem, 5vw, 3.25rem)</h1>
      <p className="font-display text-3xl">Anuphan สำหรับหัวเรื่อง — <em>ป้ายชื่อกล่อง</em></p>
      <p className="tabular-nums">Noto Sans Thai · ตัวเลขตาราง 1,234.56 ฿ · 11,111 ชิ้น</p>
      <p className="font-mono">PK-2569-00042 · JetBrains Mono</p>
    </div>
  ),
};

export const Shape: Story = {
  name: "Radius, elevation, motion",
  parameters: {
    docs: {
      description: {
        story:
          "D-180: 12 px controls, 16 px cards and media, and a pill primary CTA on the storefront " +
          `only (\`--radius-cta\` becomes ${CUSTOMER_CTA_RADIUS} under \`[data-zone="customer"]\`). ` +
          "Two elevation levels. Hovers 150–200 ms ease-out, sheets 250 ms; reduced motion is honoured.",
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        {Object.keys(RADIUS).map((radius) => (
          <div key={radius} className="text-center">
            <div
              className="size-16 border border-border bg-surface-subtle"
              style={{ borderRadius: `var(--radius-${radius})` }}
            />
            <code className="text-xs text-muted">{radius}</code>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-6">
        {Object.keys(SHADOW).map((shadow) => (
          <div key={shadow} className="text-center">
            <div className="size-16 rounded-card bg-surface" style={{ boxShadow: `var(--shadow-${shadow})` }} />
            <code className="text-xs text-muted">{shadow}</code>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(DURATION).map(([name, value]) => (
          <code key={name} className="text-xs text-muted">
            {name} {value}
          </code>
        ))}
        <code className="text-xs text-muted">standard {EASING.standard}</code>
      </div>
    </div>
  ),
};
