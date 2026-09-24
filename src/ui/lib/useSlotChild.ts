"use client";

import { use, type ReactNode } from "react";

const REACT_LAZY = Symbol.for("react.lazy");

interface LazyReference {
  $$typeof: symbol;
  _payload: PromiseLike<ReactNode>;
}

function isLazyReference(node: unknown): node is LazyReference {
  if (typeof node !== "object" || node === null) return false;
  const candidate = node as Partial<LazyReference>;
  return (
    candidate.$$typeof === REACT_LAZY &&
    typeof candidate._payload === "object" &&
    candidate._payload !== null &&
    "then" in candidate._payload
  );
}

/**
 * Resolves the child an `asChild` component is about to slot onto.
 *
 * When a server component passes `<Link>` to a client `Button asChild`, the child does not
 * arrive as an element: RSC hands over a lazy reference, sometimes a lazy that resolves to
 * another lazy. Radix `Slot` unwraps one level only, so the `Slottable` saw a non-element
 * and threw ("Slot failed to slot onto its `Slottable`"), which took down every storefront
 * page with the header. `use` reads the already-streamed chunk synchronously, and suspends
 * in the rare case it is still in flight.
 */
export function useSlotChild(children: ReactNode): ReactNode {
  let node: unknown = children;
  while (isLazyReference(node)) node = use(node._payload);
  return node as ReactNode;
}
