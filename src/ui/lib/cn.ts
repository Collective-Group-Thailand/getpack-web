import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and lets the *last* conflicting Tailwind utility win, so a caller can
 * override a component's default without `!important` or specificity games (ADR-0002).
 *
 *   cn("px-4 py-2", condition && "px-6")   →  "py-2 px-6"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
