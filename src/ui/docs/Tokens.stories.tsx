import type { Meta, StoryObj } from "@storybook/react-vite";

import { contrastRatio, oklchToHex } from "../tokens/color";
import { PALETTES, PRINT, STEPS } from "../tokens/primitives";
import { DURATION, FONT_SIZE, RADIUS, SHADOW } from "../tokens/scale";
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

export const Palette: Story = {
  name: "Primitive palette",
  render: () => (
    <div className="flex flex-col gap-4">
      {Object.entries(PALETTES).map(([name, palette]) => (
        <div key={name}>
          <p className="mb-1 text-sm font-medium">
            {name}
            {name === "brand" ? <span className="ms-2 text-xs text-muted">placeholder — docs/ui/brand.md</span> : null}
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
          "Computed from the OKLCH tokens with browser-style gamut mapping. The full set of 31 " +
          "pairs × 3 themes is asserted in `pnpm test` — this table is the readable view of it.",
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
      <p className="mt-4 font-display text-3xl">Anuphan สำหรับหัวเรื่อง — ป้ายชื่อกล่อง</p>
      <p className="font-mono">PK-2569-00042 · JetBrains Mono</p>
    </div>
  ),
};

export const Shape: Story = {
  name: "Radius, elevation, motion",
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
      <div className="flex flex-wrap gap-4">
        {Object.keys(SHADOW).map((shadow) => (
          <div key={shadow} className="text-center">
            <div className="size-16 rounded-lg bg-surface" style={{ boxShadow: `var(--shadow-${shadow})` }} />
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
      </div>
    </div>
  ),
};
