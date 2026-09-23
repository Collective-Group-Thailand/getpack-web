"use client";

import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";

export type VisuallyHiddenProps = React.ComponentProps<typeof VisuallyHiddenPrimitive.Root>;

/**
 * Text for screen readers only — still focusable and still in the accessibility tree,
 * unlike `hidden` or `display: none`.
 */
export function VisuallyHidden(props: VisuallyHiddenProps) {
  return <VisuallyHiddenPrimitive.Root {...props} />;
}
