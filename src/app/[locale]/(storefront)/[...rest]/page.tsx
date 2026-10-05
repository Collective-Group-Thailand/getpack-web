import { notFound } from "next/navigation";

/**
 * Every unmatched storefront path, answered with the zone's own not-found — inside the shell, with
 * home, search and help (U5.1 §3) — instead of Next's bare 404, which no root layout could render
 * (this app has no `src/app/layout.tsx`). A static segment always wins over a catch-all.
 */
export default function StorefrontNotFoundCatchAll(): never {
  notFound();
}
