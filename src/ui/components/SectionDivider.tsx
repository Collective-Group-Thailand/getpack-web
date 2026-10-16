import { cn } from "../lib/cn";

export interface SectionDividerProps {
  /**
   * Which band the wave belongs to. `into` sits at the bottom of a page-coloured section and
   * rises into the paper band below it; `out-of` sits at the top of a page-coloured section
   * and falls out of the paper band above it.
   */
  direction?: "into" | "out-of";
  className?: string;
}

/**
 * A flat wave between a page-coloured section and a paper band (`bg-subtle`), the one
 * decorative edge the art direction allows (D-180).
 *
 * Rules, per design-system.md §Art direction:
 * - at most one per two sections, and never with text over it;
 * - one flat fill in the band colour — no gradient, no shadow, no stroke;
 * - always `aria-hidden`: it carries no meaning, so a screen reader must not announce it.
 *
 * The shape is drawn for getpack. Its height scales with the width, so it never crowds a phone.
 */
export function SectionDivider({ direction = "into", className }: SectionDividerProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 48"
      preserveAspectRatio="none"
      className={cn(
        "fill-bg-subtle pointer-events-none block h-[clamp(1rem,3.3vw,3rem)] w-full",
        direction === "out-of" && "-scale-y-100",
        className,
      )}
    >
      <path d="M0 30C160 12 320 6 480 14s320 30 480 28 320-26 480-30v36H0Z" />
    </svg>
  );
}
