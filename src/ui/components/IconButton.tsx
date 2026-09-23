"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { buttonVariants } from "./Button";

const iconButtonVariants = cva("", {
  variants: {
    size: {
      // 24 px is the WCAG 2.5.8 floor; sm is only for dense admin toolbars.
      sm: "size-8",
      md: "size-10",
      lg: "size-12",
      xl: "size-14",
    },
  },
  defaultVariants: { size: "md" },
});

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">, VariantProps<typeof iconButtonVariants> {
  name: IconName;
  /**
   * Required, not optional: an icon-only button with no name is invisible to a screen
   * reader, so the type system asks for one (design-system.md §6).
   */
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
}

/** An icon-only button that cannot be built without an accessible name. */
export function IconButton({
  name,
  label,
  variant = "ghost",
  size,
  className,
  loading = false,
  disabled,
  type,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      // The name comes from aria-label, and the title gives sighted users the same words.
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size: null }), iconButtonVariants({ size }), className)}
      {...props}
    >
      <Icon name={loading ? "spinner" : name} size={20} className={cn(loading && "animate-spin")} />
    </button>
  );
}
