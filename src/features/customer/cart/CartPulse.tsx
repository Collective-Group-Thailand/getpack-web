"use client";

import { useEffect, useState } from "react";

const EVENT = "packio:cart-added";

/** Tell the header something went into the cart (U5.7 §1), wherever it was added from. */
export function announceCartAdd(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/**
 * The header's cart icon acknowledges an add with one pop on the motion tokens (U5.7 §1); under
 * reduced motion the pop is skipped and the toast alone confirms it. The icon's name is unchanged,
 * and the toast says the same thing in words.
 */
export function CartPulse({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const onAdd = () => setCount((value) => value + 1);
    window.addEventListener(EVENT, onAdd);
    return () => window.removeEventListener(EVENT, onAdd);
  }, []);
  return (
    <span key={count} className={count > 0 ? "pk-pop inline-flex" : "inline-flex"}>
      {children}
    </span>
  );
}
