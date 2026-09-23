import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

const calloutVariants = cva("flex gap-3 rounded-lg border p-3 text-sm", {
  variants: {
    tone: {
      neutral: "border-border bg-surface-subtle text-fg",
      primary: "border-primary/25 bg-primary-subtle text-primary-subtle-fg",
      success: "border-success/25 bg-success-subtle text-success-subtle-fg",
      warning: "border-warning/40 bg-warning-subtle text-warning-subtle-fg",
      danger: "border-danger/25 bg-danger-subtle text-danger-subtle-fg",
      info: "border-info/25 bg-info-subtle text-info-subtle-fg",
    },
  },
  defaultVariants: { tone: "neutral" },
});

/** Each tone's default icon, so a tone is never carried by colour alone. */
const TONE_ICON: Record<NonNullable<VariantProps<typeof calloutVariants>["tone"]>, IconName> = {
  neutral: "info",
  primary: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export interface CalloutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof calloutVariants> {
  title?: React.ReactNode;
  icon?: IconName;
  /**
   * Announce the callout when it appears — for a validation summary or a result the user
   * did not scroll to. Off by default: a static note on the page is not news.
   */
  live?: boolean;
}

/** An inline note: explanation, warning, or the result of something the user just did. */
export function Callout({ className, tone, title, icon, live = false, children, ...props }: CalloutProps) {
  return (
    <div
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      className={cn(calloutVariants({ tone }), className)}
      {...props}
    >
      <Icon name={icon ?? TONE_ICON[tone ?? "neutral"]} size={18} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
      </div>
    </div>
  );
}
