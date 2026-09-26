"use client";

import { DropdownMenu } from "../components/DropdownMenu";
import { IconButton } from "../components/IconButton";
import type { IconName } from "../icons";
import { useTheme } from "./ThemeProvider";
import type { ThemeChoice } from "./themes";

const CHOICE_ICON: Record<ThemeChoice, IconName> = {
  system: "theme-system",
  light: "theme-light",
  dark: "theme-dark",
  hc: "theme-contrast",
};

export interface ThemeToggleProps {
  /** Accessible name for the trigger, from `src/i18n`. */
  label: string;
  /** One label per choice this zone offers, from `src/i18n`. */
  choiceLabels: Record<ThemeChoice, string>;
  /** Controlled open state — for a menu loaded lazily by the click that should open it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Focus the trigger on mount — for a menu swapped in under a focused placeholder. */
  autoFocus?: boolean;
}

/**
 * The theme picker (ADR-0003). Writes the `pk_theme` cookie and flips `data-theme`, so the
 * next server render agrees with what the user is already looking at.
 *
 * Which choices appear depends on the zone: only the partner PWA offers high contrast.
 */
export function ThemeToggle({ label, choiceLabels, open, onOpenChange, autoFocus }: ThemeToggleProps) {
  const { choice, choices, setChoice } = useTheme();

  return (
    <DropdownMenu
      label={label}
      open={open}
      onOpenChange={onOpenChange}
      trigger={<IconButton name={CHOICE_ICON[choice]} label={label} size="sm" autoFocus={autoFocus} />}
      items={choices.map((option) => ({
        id: option,
        label: choiceLabels[option],
        icon: CHOICE_ICON[option],
        selected: option === choice,
        onSelect: () => setChoice(option),
      }))}
    />
  );
}
