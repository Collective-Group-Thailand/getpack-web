"use client";

import { useState } from "react";

export type Brand = "google" | "apple" | "line";

/**
 * A sign-in provider's mark, from the provider's own asset at `public/brands/<brand>.svg` —
 * the files each provider publishes for its sign-in button, placed there as they are (Google
 * Identity branding guidelines, Apple's Sign in with Apple HIG, LINE Login button guidelines).
 * Packio draws none of them. Until the file is there the button is text only: a missing mark
 * must never show as a broken image.
 */
export function BrandMark({ brand, className }: { brand: Brand; className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG mark, never optimised or resized
    <img
      src={`/brands/${brand}.svg`}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
      className={className}
      onError={() => setMissing(true)}
    />
  );
}
