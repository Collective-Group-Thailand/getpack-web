"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

/**
 * Mount once per zone, inside the root layout, so every tooltip shares one delay timer and
 * opening a second one is instant.
 */
export function TooltipProvider({ children, delayDuration = 300 }: TooltipPrimitive.TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration}>{children}</TooltipPrimitive.Provider>;
}

export interface TooltipProps extends Omit<TooltipPrimitive.TooltipProps, "children"> {
  /** The trigger. It must be focusable, or keyboard users never see the tooltip. */
  children: React.ReactNode;
  content: React.ReactNode;
  side?: TooltipPrimitive.TooltipContentProps["side"];
  align?: TooltipPrimitive.TooltipContentProps["align"];
}

/**
 * Supplementary help only. A tooltip is never the only place a piece of information lives:
 * it is unavailable on touch, and WCAG 1.4.13 wants the content dismissible and hoverable —
 * both of which Radix handles, provided the trigger is a real focusable element.
 */
export function Tooltip({ children, content, side = "top", align = "center", ...props }: TooltipProps) {
  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-modal bg-neutral text-neutral-fg shadow-overlay max-w-64 rounded-md px-2 py-1 text-xs",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
