import { notFound } from "next/navigation";

/**
 * Every unmatched path in the admin zone, answered with this zone's own 404.
 *
 * Without it, an unmatched path has no route to attach to and Next cannot tell which of the
 * three root layouts should render the miss — this app has no `src/app/layout.tsx` by
 * design. A static segment always wins over a catch-all, so real screens are unaffected.
 *
 * It sits inside `(console)` so the session guard runs first: an unknown path asks a
 * signed-out visitor to sign in rather than telling them which paths do not exist.
 */
export default function AdminNotFoundCatchAll(): never {
  notFound();
}
