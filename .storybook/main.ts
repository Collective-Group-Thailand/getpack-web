import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/react-vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Storybook is the design system's documentation and visual workbench (design-system.md §9).
 * The a11y *gate* runs in Vitest and Playwright, not here — see src/ui/test/axe.ts for why —
 * but addon-a11y keeps axe one panel away while a component is being built.
 */
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../src/ui/**/*.stories.@(ts|tsx)",
    "../src/ui/docs/**/*.mdx",
    // The designer's panels in fixed states, for the editor's visual baseline (F4 Part E).
    "../src/features/designer/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  // `next/font` cannot run under Vite, so the same five woff2 files are declared by hand in
  // .storybook/fonts.css and served from here.
  staticDirs: [{ from: "../src/ui/fonts/files", to: "/fonts" }],
  typescript: { reactDocgen: "react-docgen-typescript" },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    // Tailwind through its own Vite plugin. postcss.config.mjs stays in the string form
    // Turbopack requires, and an inline (empty) config here stops Vite discovering that file.
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
    css: { ...viteConfig.css, postcss: { plugins: [] } },
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        // Mirrors the tsconfig paths; Storybook does not read them.
        "@/ui": join(root, "src/ui"),
        "@/domain": join(root, "src/domain"),
        "@/i18n": join(root, "src/i18n"),
        "@/lib": join(root, "src/lib"),
        "@": join(root, "src"),
      },
    },
  }),
};

export default config;
