"use client";

import { isStyleId } from "@getpack/dieline";

/**
 * The style library in the studio (U4.2): a published variant can be a wave recipe that only
 * `@getpack/dieline/library` draws (U3.4). It is loaded on demand — the studio's first load keeps the
 * core styles only — and registered once, so `getStyle` and saved designs find its styles.
 */
export async function loadLibrary() {
  const library = await import("@getpack/dieline/library");
  library.registerLibrary();
  return library;
}

/** A saved style id the main entry does not know needs the library before the design can open. */
export const needsLibrary = (styleId: unknown) => typeof styleId === "string" && !isStyleId(styleId);
