/**
 * The resolved UI font stack (Anuphan) for text the canvas draws itself, such as a barcode's
 * digits. Konva paints on a `<canvas>`, which cannot read `var(--font-sans)`, so the stack is
 * read from the computed custom property; the `next/font` family names inside it are only
 * known at runtime. Falls back to the generic family on the server and in tests.
 */
export function uiFontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  const stack = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
  return stack || "sans-serif";
}
