"use client";

import { lazy, Suspense, useState } from "react";
import { useTranslations } from "next-intl";

import { IconButton } from "@/ui/components/IconButton";
import type { IconName } from "@/ui/icons";
import { useTheme } from "@/ui/theme/ThemeProvider";
import type { ThemeChoice } from "@/ui/theme/themes";

/**
 * The header's two menus — language and theme — loaded on intent instead of with the page.
 *
 * Both are Radix DropdownMenus, and a menu, its positioning engine and their dependencies were
 * the largest share of the storefront's initial JavaScript over its 150 KB budget
 * (docs/performance-budgets.md, PROGRESS F1.3). Until someone reaches for one, the header shows
 * a plain button with the same icon and name; pointing at it or focusing it fetches the real
 * menu, a click opens it as it arrives, and a focused placeholder hands focus to the real
 * trigger — so the swap is invisible to a mouse, a keyboard and a screen reader alike.
 */

type Intent = "idle" | "warm" | "open";

const LocaleLink = lazy(() => import("./LocaleLink").then((module) => ({ default: module.LocaleLink })));
const ThemeToggle = lazy(() => import("@/ui/theme/ThemeToggle").then((module) => ({ default: module.ThemeToggle })));

function useIntent() {
  const [intent, setIntent] = useState<Intent>("idle");
  const [focused, setFocused] = useState(false);
  const handlers = {
    onPointerEnter: () => setIntent((current) => (current === "idle" ? "warm" : current)),
    onFocus: () => {
      setFocused(true);
      setIntent((current) => (current === "idle" ? "warm" : current));
    },
    onClick: () => setIntent("open"),
  };
  return { intent, focused, handlers };
}

function Placeholder({ icon, label, handlers }: { icon: IconName; label: string; handlers: object }) {
  return <IconButton name={icon} variant="ghost" size="sm" label={label} aria-haspopup="menu" {...handlers} />;
}

export function DeferredLocaleMenu() {
  const t = useTranslations("common.locale");
  const { intent, focused, handlers } = useIntent();
  const placeholder = <Placeholder icon="language" label={t("label")} handlers={handlers} />;
  if (intent === "idle") return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <LocaleLink defaultOpen={intent === "open"} autoFocus={focused} />
    </Suspense>
  );
}

const CHOICE_ICON: Record<ThemeChoice, IconName> = {
  system: "theme-system",
  light: "theme-light",
  dark: "theme-dark",
  hc: "theme-contrast",
};

export function DeferredThemeMenu({
  label,
  choiceLabels,
}: {
  label: string;
  choiceLabels: Record<ThemeChoice, string>;
}) {
  const { choice } = useTheme();
  const { intent, focused, handlers } = useIntent();
  const placeholder = <Placeholder icon={CHOICE_ICON[choice]} label={label} handlers={handlers} />;
  if (intent === "idle") return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <ThemeToggle label={label} choiceLabels={choiceLabels} defaultOpen={intent === "open"} autoFocus={focused} />
    </Suspense>
  );
}
