"use client";

import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { useSlotChild } from "../lib/useSlotChild";

/**
 * The one button (design-system.md §3). Variants are component-tier tokens expressed as
 * CVA classes over semantic colours — never a raw palette step, so every variant follows
 * the theme and is covered by the contrast gate.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap",
    "transition-[color,background-color,border-color] duration-fast ease-standard",
    // Target size ≥ 24 px (WCAG 2.5.8); the partner zone raises this to 48 px with size="xl".
    "min-h-6",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        // Design language v3: a 10 px control in every zone — no pill, no shadow, no hover lift.
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        // An ink outline on the page's own colour.
        secondary: "border border-fg bg-transparent text-fg hover:bg-fg/5",
        /*
         * Ghost inherits its colour instead of forcing `text-fg`, and tints its hover from
         * that same colour. On a normal surface it inherits the body colour; on an inverted
         * one — the designer's dark chrome — it inherits `neutral-fg` and stays legible.
         * Forcing `text-fg` there gave 1.89:1, which only a real browser could measure.
         */
        ghost: "text-inherit hover:bg-current/10",
        /*
         * Red is for destructive actions only, and never the loudest thing on the page (UX audit
         * baseline: "สีแดงใช้เฉพาะ destructive และเป็น outline/ghost เสมอ") — an outline, so the
         * screen's primary action stays the one that stands out.
         */
        destructive: "border border-danger/45 bg-surface text-danger-subtle-fg hover:bg-danger-subtle",
        /** Only the confirm button inside an AlertDialog, where the destructive step is the point. */
        "destructive-solid": "bg-danger text-danger-fg hover:bg-danger-hover",
        link: "text-primary underline underline-offset-4 hover:text-primary-hover",
        /**
         * A quiet filled control for a secondary action inside a card (the products hub's
         * "เพิ่มในใบขอราคา"); pressed (`aria-pressed`) it takes the brand tint.
         */
        soft: "bg-bg-subtle text-fg hover:bg-border aria-pressed:bg-primary-subtle aria-pressed:text-primary-subtle-fg",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        /** In a card: 40 px. */
        md: "h-10 px-4 text-[0.9375rem]",
        /** The navbar and a table's actions: 44 px. */
        nav: "h-11 px-5 text-[0.9375rem]",
        /** A hero or a form's submit: 52 px. Labels are 15–15.5 px semibold. */
        lg: "h-13 px-6 text-[0.96875rem]",
        /** Shop-floor: 48 px+ targets and 18 px text (design-system.md §5). */
        xl: "h-14 px-8 text-lg",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render as the child element (a `Link`, say) while keeping the button's looks. */
  asChild?: boolean;
  /**
   * Shows a spinner and marks the button busy. The label stays in place — swapping it for
   * a spinner alone loses the accessible name and makes the button jump.
   */
  loading?: boolean;
  /** Decorative icon before/after the label; the label still carries the meaning. */
  iconStart?: IconName;
  iconEnd?: IconName;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  iconStart,
  iconEnd,
  children,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  const slotChild = useSlotChild(children);
  const iconBefore = loading ? (
    <Icon name="spinner" className="animate-spin" />
  ) : iconStart ? (
    <Icon name={iconStart} />
  ) : null;
  const iconAfter = iconEnd ? <Icon name={iconEnd} /> : null;

  return (
    <Component
      // A button inside a form defaults to `submit`, which is rarely what a toolbar wants.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      // A hook for a zone's density rules (the factory app eases shop-floor sizes at a desk).
      data-size={size ?? "md"}
      {...props}
    >
      {iconBefore}
      {/*
        Slottable tells Radix which child is the one to merge into, so `asChild` still works
        when the button also renders icons — without it, Slot sees three children and throws
        ("Slot failed to slot onto its children"), which is only visible in a real render.
      */}
      {asChild ? <Slot.Slottable>{slotChild}</Slot.Slottable> : children}
      {iconAfter}
    </Component>
  );
}
