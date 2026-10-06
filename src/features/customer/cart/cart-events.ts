"use client";

import { useEffect, useState } from "react";

/**
 * "Something just went into the cart" (round 2, B7): adding gave no sign at all — no badge, the
 * button unchanged — and the toast alone was easy to miss at the top while the eye was on the price
 * panel. Every add announces itself here; the header's cart redraws its count and the button that
 * added says "ไปที่ตะกร้า" for a few seconds.
 */
const EVENT = "pk:cart-added";

/** How long the add button keeps pointing at the cart. */
export const JUST_ADDED_MS = 8000;

export function announceCartAdd(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onCartAdd(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** True for a few seconds after anything is added to the cart. */
export function useJustAdded(): boolean {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(
    () =>
      onCartAdd(() => {
        const at = Date.now();
        setNow(at);
        setUntil(at + JUST_ADDED_MS);
      }),
    [],
  );
  useEffect(() => {
    if (until <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), until - now);
    return () => clearTimeout(timer);
  }, [until, now]);
  return until > now;
}
