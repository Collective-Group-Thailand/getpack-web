"use client";

import { useTranslations } from "next-intl";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

import { useTheme } from "../theme/ThemeProvider";

/**
 * Toasts (design-system.md §4): for the current page only, and for reversible things — an
 * undoable action gets its undo here. Anything the user must act on belongs in the page, not
 * in a message that disappears.
 *
 * `sonner` already renders into an `aria-live` region and pauses its timer on focus or hover,
 * which is what WCAG 2.2.1 needs.
 */
/** Every toast leaves after five seconds unless the reader is on it (WCAG 2.2.1). */
export const TOAST_DURATION_MS = 5000;

export function Toaster() {
  const { choice } = useTheme();
  const t = useTranslations("common.actions");

  return (
    <SonnerToaster
      // `system` lets sonner follow prefers-color-scheme, matching the tokens' own fallback.
      theme={choice === "hc" ? "light" : choice}
      position="top-center"
      // Long enough to read a Thai sentence and reach an undo button.
      duration={TOAST_DURATION_MS}
      // sonner holds a toast while the pointer rests on it, and on a floor tablet the finger that
      // pressed the action is often still there when the toast appears over the page's top
      // button — it looked stuck (round 2, B14). The close button lets it go at once.
      closeButton
      gap={8}
      toastOptions={{
        closeButtonAriaLabel: t("close"),
        classNames: {
          toast: "!rounded-card !border !border-border !bg-surface-raised !text-fg !shadow-overlay !font-sans",
          description: "!text-muted",
          actionButton: "!bg-primary !text-primary-fg !rounded-control",
          cancelButton: "!bg-surface-subtle !text-fg !rounded-control",
          closeButton: "!bg-surface-raised !border-border !text-muted",
          error: "!border-danger/30",
          success: "!border-success/30",
          warning: "!border-warning/40",
        },
      }}
    />
  );
}

/**
 * The toast API. Re-exported rather than used directly so the whole product can gain a
 * behaviour (an error code, a Sentry breadcrumb) in one place later.
 */
export const toast = sonnerToast;
