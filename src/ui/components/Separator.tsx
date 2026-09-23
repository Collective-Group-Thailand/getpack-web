"use client";

import { Separator as SeparatorPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

export type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root>;

/**
 * A rule between groups. Decorative by default (Radix then hides it from the a11y tree);
 * pass `decorative={false}` when the line is the only thing marking a section boundary.
 */
export function Separator({ className, orientation = "horizontal", decorative = true, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      decorative={decorative}
      className={cn("bg-border shrink-0", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  );
}
