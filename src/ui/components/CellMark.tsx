import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export type CellMarkTone = "neutral" | "primary" | "warning" | "info";

export interface CellMarkProps {
  /** The shape that tells the marks apart in greyscale (a planner's ระบบ · คำนวณ · กรอกเอง · แก้ทับ). */
  icon: IconName;
  /** What the mark means, in words. Always read by a screen reader; printed with `variant="chip"`. */
  label: string;
  tone?: CellMarkTone;
  /**
   * `glyph`: a 16 px tile for a dense grid cell — the words go to assistive technology and the legend above the grid.
   * `chip`: the tile with its words, for a legend, a tooltip or a card.
   */
  variant?: "glyph" | "chip";
  className?: string;
}

const TILE: Record<CellMarkTone, string> = {
  neutral: "border-border-strong text-muted",
  primary: "border-primary/50 bg-primary-subtle text-primary-subtle-fg",
  info: "border-info/50 bg-info-subtle text-info-subtle-fg",
  warning: "border-warning/60 bg-warning-subtle text-warning-subtle-fg",
};

/**
 * A small source mark for a figure — where a number comes from, by shape and words, never by colour alone
 * (design-system.md §2). The tile is a 4 px-radius square with a hairline border so it reads as a mark, not a button;
 * the tone only reinforces the shape. Decorative to pointer users, labelled for everyone else.
 */
export function CellMark({ icon, label, tone = "neutral", variant = "glyph", className }: CellMarkProps) {
  const tile = (
    <span
      aria-hidden
      className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-sm border", TILE[tone])}
    >
      <Icon name={icon} size={11} />
    </span>
  );
  if (variant === "chip")
    return (
      <span className={cn("text-muted inline-flex items-center gap-1.5 text-xs leading-none", className)}>
        {tile}
        <span>{label}</span>
      </span>
    );
  return (
    <span className={cn("inline-flex", className)} role="img" aria-label={label}>
      {tile}
    </span>
  );
}
