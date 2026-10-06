"use client";

import { lazy, Suspense, useState } from "react";
import { useTranslations } from "next-intl";

import { ASSISTANT_BUILT_IN } from "@/features/customer/assistant/flag";
import { IconButton } from "@/ui/components/IconButton";

import { LocaleTrigger } from "./LocaleTrigger";
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
 * menu's code, and a click (or Enter / Space) mounts it open with focus on its trigger — so the
 * swap is invisible to a mouse, a keyboard and a screen reader alike.
 *
 * The open state lives here, not in the menu, so the click that loads a menu is the one that
 * opens it.
 */

const loadLocaleLink = () => import("./LocaleLink").then((module) => ({ default: module.LocaleLink }));
const loadThemeToggle = () => import("@/ui/theme/ThemeToggle").then((module) => ({ default: module.ThemeToggle }));
const LocaleLink = lazy(loadLocaleLink);
const ThemeToggle = lazy(loadThemeToggle);

/**
 * Pointing at or focusing the button only *fetches* the menu's code; the menu itself mounts on
 * the click, already open. Mounting it earlier — mid-click — let Radix read the rest of that
 * click as a press outside the menu and close it again.
 */
function useIntent(preload: () => Promise<unknown>) {
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const handlers = {
    onPointerEnter: () => void preload(),
    onFocus: () => void preload(),
    onClick: () => {
      setLoaded(true);
      setOpen(true);
    },
  };
  return { loaded, open, setOpen, handlers };
}

function Placeholder({ icon, label, handlers }: { icon: IconName; label: string; handlers: object }) {
  return <IconButton name={icon} variant="ghost" size="sm" label={label} aria-haspopup="menu" {...handlers} />;
}

export function DeferredLocaleMenu() {
  const t = useTranslations("common.locale");
  const { loaded, open, setOpen, handlers } = useIntent(loadLocaleLink);
  const placeholder = <LocaleTrigger label={t("label")} {...handlers} />;
  if (!loaded) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <LocaleLink open={open} onOpenChange={setOpen} autoFocus />
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
  const { loaded, open, setOpen, handlers } = useIntent(loadThemeToggle);
  const placeholder = <Placeholder icon={CHOICE_ICON[choice]} label={label} handlers={handlers} />;
  if (!loaded) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <ThemeToggle label={label} choiceLabels={choiceLabels} open={open} onOpenChange={setOpen} autoFocus />
    </Suspense>
  );
}

/**
 * Packio Assistant's button (U5.5), in this module so the header gains no client boundary of its
 * own. Without `NEXT_PUBLIC_ASSISTANT=1` the constant is false at build time and the launcher, its
 * import and its copy are dropped from the bundle (D-218: off at launch).
 */
const AssistantLauncher = ASSISTANT_BUILT_IN
  ? lazy(() =>
      import("@/features/customer/assistant/AssistantLauncher").then((module) => ({
        default: module.AssistantLauncher,
      })),
    )
  : null;

export function DeferredAssistant({ signedIn }: { signedIn: boolean }) {
  if (!AssistantLauncher) return null;
  return (
    <Suspense fallback={null}>
      <AssistantLauncher signedIn={signedIn} signInHref="/sign-in" />
    </Suspense>
  );
}
