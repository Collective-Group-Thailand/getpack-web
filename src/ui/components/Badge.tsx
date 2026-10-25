import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

/**
 * Tones map 1:1 onto the semantic tone tokens, and each has a gated text/background pair in
 * both `subtle` and `solid` appearances (`scripts/check-contrast.ts`).
 *
 * `accent` (amber) is for promotions only (D-180): a campaign badge from the promotions
 * engine, never a status, and never a manufactured "only N left" (D-181). Warnings are
 * `warning`.
 */
export const badgeVariants = cva("inline-flex items-center gap-1 rounded-control font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "",
      primary: "",
      accent: "",
      success: "",
      warning: "",
      danger: "",
      info: "",
      instant: "",
    },
    appearance: { subtle: "", solid: "" },
    size: {
      sm: "h-5 px-2 text-xs",
      md: "h-6 px-2.5 text-sm",
    },
  },
  compoundVariants: [
    { tone: "neutral", appearance: "subtle", class: "bg-neutral-subtle text-neutral-subtle-fg" },
    { tone: "primary", appearance: "subtle", class: "bg-primary-subtle text-primary-subtle-fg" },
    { tone: "accent", appearance: "subtle", class: "bg-accent-subtle text-accent-subtle-fg" },
    { tone: "success", appearance: "subtle", class: "bg-success-subtle text-success-subtle-fg" },
    { tone: "warning", appearance: "subtle", class: "bg-warning-subtle text-warning-subtle-fg" },
    { tone: "danger", appearance: "subtle", class: "bg-danger-subtle text-danger-subtle-fg" },
    { tone: "info", appearance: "subtle", class: "bg-info-subtle text-info-subtle-fg" },
    { tone: "instant", appearance: "subtle", class: "bg-instant-subtle text-instant-subtle-fg" },
    { tone: "neutral", appearance: "solid", class: "bg-neutral text-neutral-fg" },
    { tone: "primary", appearance: "solid", class: "bg-primary text-primary-fg" },
    { tone: "accent", appearance: "solid", class: "bg-accent text-accent-fg" },
    { tone: "success", appearance: "solid", class: "bg-success text-success-fg" },
    { tone: "warning", appearance: "solid", class: "bg-warning text-warning-fg" },
    { tone: "danger", appearance: "solid", class: "bg-danger text-danger-fg" },
    { tone: "info", appearance: "solid", class: "bg-info text-info-fg" },
    { tone: "instant", appearance: "solid", class: "bg-instant text-instant-fg" },
  ],
  defaultVariants: { tone: "neutral", appearance: "subtle", size: "md" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /**
   * Icon beside the label. design-system.md §2: never rely on colour alone — a tone always
   * ships with an icon *and* words, so the badge still reads in greyscale.
   */
  icon?: IconName;
}

export function Badge({ className, tone, appearance, size, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, appearance, size }), className)} {...props}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}
