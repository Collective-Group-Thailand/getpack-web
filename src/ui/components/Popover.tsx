"use client";

import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

export interface PopoverProps {
  /** The trigger; must be a focusable element. */
  trigger: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: PopoverPrimitive.PopoverContentProps["side"];
  align?: PopoverPrimitive.PopoverContentProps["align"];
  className?: string;
  /** Accessible name, for a popover whose content has no heading of its own. */
  "aria-label"?: string;
}

/**
 * Non-modal rich content beside a trigger: the contextual "?" help popovers
 * (design-system.md §4, consistent help placement — WCAG 3.2.6).
 *
 * Unlike Tooltip this may hold interactive content, and unlike Dialog it does not trap
 * focus — Tab moves through the popover and on out of it.
 */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  side = "bottom",
  align = "start",
  className,
  ...props
}: PopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          aria-label={props["aria-label"]}
          className={cn(
            "z-modal border-border w-(--radix-popover-content-available-width) max-w-80 rounded-lg border",
            "bg-surface-raised p-3 text-sm shadow-lg",
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
