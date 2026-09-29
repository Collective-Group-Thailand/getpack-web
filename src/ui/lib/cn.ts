import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { FONT_SIZE, RADIUS, SHADOW } from "../tokens/scale";

/**
 * tailwind-merge only knows t-shirt sizes out of the box. Our semantic scale names
 * (`rounded-control`, `shadow-overlay`, `text-display`) would otherwise be misread: the
 * worst case is `text-display` taken for a text *colour* and silently dropped next to
 * `text-fg`. Registering the keys straight from the tokens keeps the two in step.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: Object.keys(RADIUS),
      shadow: Object.keys(SHADOW),
      text: Object.keys(FONT_SIZE),
    },
  },
});

/**
 * Joins class names and lets the *last* conflicting Tailwind utility win, so a caller can
 * override a component's default without `!important` or specificity games (ADR-0002).
 *
 *   cn("px-4 py-2", condition && "px-6")   →  "py-2 px-6"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
