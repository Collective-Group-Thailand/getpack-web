import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no layout engine, and Radix's popper-based primitives (Select, Slider, Popover,
 * DropdownMenu) measure and capture pointers. Without these four shims they throw on mount,
 * which would mean not testing them at all — the opposite of what design-system.md §3 asks
 * for. Everything that genuinely needs real geometry is asserted in Playwright instead.
 */

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!globalThis.DOMRect) {
  globalThis.DOMRect = class DOMRect {
    constructor(
      readonly x = 0,
      readonly y = 0,
      readonly width = 0,
      readonly height = 0,
    ) {}
    readonly top = 0;
    readonly left = 0;
    readonly right = 0;
    readonly bottom = 0;
    toJSON() {
      return this;
    }
    static fromRect(other?: DOMRectInit) {
      return new DOMRect(other?.x, other?.y, other?.width, other?.height);
    }
  } as unknown as typeof DOMRect;
}

// Not every suite runs in jsdom: `src/proxy.test.ts` uses the node environment, because a
// proxy handler has no document and Next's Request/Response want Node's own globals.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
    return false;
  };
  Element.prototype.setPointerCapture ??= function setPointerCapture() {};
  Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
}
