"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import React from "react";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { useSlotChild } from "../lib/useSlotChild";
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
  /**
   * Render as the child element — a `Link`, usually — while keeping the button's looks, the
   * same escape hatch `Button` has. An icon-only *link* (cart, account, search in the
   * storefront header) is a link, and rendering it as a `<button>` would break
   * middle-click, "open in new tab" and the browser's own visited styling.
   */
  asChild?: boolean;
  /**
   * Only meaningful with `asChild`: the element to render as. The base props deliberately
   * `Omit` children — an icon button's content is its `name`, not arbitrary markup — and this
   * narrows the exception to the one case that needs it.
   */
  children?: React.ReactNode;
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
  asChild = false,
  type,
  children,
  ...props
}: IconButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  const slotChild = useSlotChild(children);
  const icon = <Icon name={loading ? "spinner" : name} size={20} className={cn(loading && "animate-spin")} />;

  return (
    <Component
      type={asChild ? undefined : (type ?? "button")}
      // The name comes from aria-label, and the title gives sighted users the same words.
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size: null }), iconButtonVariants({ size }), className)}
      {...props}
    >
      {/*
        With `asChild`, Slot needs a single child to merge onto — the caller's element — so
        the icon is placed *inside* it rather than beside it.
      */}
      {asChild && React.isValidElement(slotChild)
        ? React.cloneElement(slotChild as React.ReactElement<{ children?: React.ReactNode }>, {}, icon)
        : icon}
    </Component>
  );
}
