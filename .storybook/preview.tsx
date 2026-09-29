import type { Decorator, Preview } from "@storybook/react-vite";

import { TooltipProvider } from "../src/ui/components/Tooltip";
import { ThemeProvider } from "../src/ui/theme/ThemeProvider";
import { THEMES, type Zone } from "../src/ui/theme/themes";

import "./preview.css";

/**
 * Stamps `data-theme` and `data-zone` the way a zone's root layout does, so every story can be
 * viewed in all three themes and as each zone from the toolbar. `hc` is included because the
 * partner PWA ships it and it is the theme most likely to be forgotten; the zone matters
 * because the storefront's primary CTA is a pill and the admin's is not (D-180).
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as (typeof THEMES)[number];
  const zone = (context.globals.zone as Zone | undefined) || "customer";
  const root = document.documentElement;

  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  root.dataset.zone = zone;

  return (
    <ThemeProvider initialChoice={theme ?? "system"} zone={zone}>
      <TooltipProvider>
        <div className="bg-bg text-fg p-6">
          <Story />
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: { theme: "light", zone: "customer" },
  globalTypes: {
    theme: {
      description: "Token theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "hc", title: "High contrast" },
          { value: "", title: "Follow the OS" },
        ],
        dynamicTitle: true,
      },
    },
    zone: {
      description: "Zone the story renders in",
      toolbar: {
        title: "Zone",
        icon: "globe",
        items: [
          { value: "customer", title: "Customer (storefront)" },
          { value: "admin", title: "Admin" },
          { value: "partner", title: "Partner" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: {
      // Advisory here; the gate that fails CI is in Vitest and Playwright.
      test: "todo",
    },
    docs: { toc: true },
    options: {
      storySort: {
        order: ["Docs", ["Principles", "Tokens", "Voice & tone"], "Foundations", "Forms", "Overlays", "Navigation"],
      },
    },
  },
};

export default preview;
