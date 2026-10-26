import { cn } from "../lib/cn";

export type KbdProps = React.HTMLAttributes<HTMLElement>;

/** A keyboard key in help text and shortcut lists (the designer's shortcut panel, ⌘K hints). */
export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "border-border inline-flex h-5 min-w-5 items-center justify-center rounded-sm border",
        "bg-surface-subtle text-muted px-1 text-xs tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/**
 * What is printed on the key.
 *
 * Keycaps are not copy — "Ctrl" is "Ctrl" in Thai, and translating it would tell someone to
 * press a key their keyboard does not have — so they live here rather than in `src/i18n`.
 * Naming them also gives the ⌘-versus-Ctrl split one home: `mod` is the modifier the platform
 * actually uses, which the command palette in the admin shell needs for its ⌘K hint.
 *
 * The values are read at module scope on the server too, where there is no `navigator`, so
 * `mod` falls back to `Ctrl` and the client corrects it — see `useModKey`.
 */
export const KEYCAP = {
  ctrl: "Ctrl",
  cmd: "\u2318",
  shift: "\u21e7",
  alt: "Alt",
  enter: "\u21b5",
  esc: "Esc",
  del: "Delete",
  question: "?",
  slash: "/",
  k: "K",
  z: "Z",
  d: "D",
} as const;

/**
 * `true` when this browser is on an Apple platform, where the command palette is ⌘K rather
 * than Ctrl+K. `false` during server rendering, so the markup is stable and the client
 * corrects it after hydration rather than mismatching.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  // `userAgentData.platform` where it exists; `platform` is deprecated but is still the only
  // thing Safari offers.
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform ?? "");
}
