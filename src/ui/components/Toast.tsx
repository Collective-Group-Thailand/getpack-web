"use client";

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
export function Toaster() {
  const { choice } = useTheme();

  return (
    <SonnerToaster
      // `system` lets sonner follow prefers-color-scheme, matching the tokens' own fallback.
      theme={choice === "hc" ? "light" : choice}
      position="top-center"
      // Long enough to read a Thai sentence and reach an undo button.
      duration={5000}
      gap={8}
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-surface-raised !text-fg !shadow-lg !font-sans",
          description: "!text-muted",
          actionButton: "!bg-primary !text-primary-fg !rounded-md",
          cancelButton: "!bg-surface-subtle !text-fg !rounded-md",
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
