import "server-only";

import { headers } from "next/headers";

import { getActor, type ActorByZone } from "@/lib/auth/actor";
import { PATH_HEADER, type Zone } from "@/lib/zones";

import { safeReturnTo } from "./return-to";

/** Where the browser is, in its own spelling — `/orders`, not the internal `/admin/orders`. */
export async function currentPath(): Promise<string> {
  return (await headers()).get(PATH_HEADER) ?? "/";
}

/**
 * The sign-in URL to send an unauthenticated visitor to, carrying where they were going.
 *
 * The path is run through `safeReturnTo` even though it came from our own proxy header:
 * defence in depth costs one function call, and the value ends up in a query string that is
 * then read back by the login action.
 */
export async function signInUrl(loginPath = "/login"): Promise<string> {
  const from = safeReturnTo(await currentPath());
  return from === "/" ? loginPath : `${loginPath}?returnTo=${encodeURIComponent(from)}`;
}

/**
 * The signed-in actor for a zone whose screens all require one.
 *
 * Returns `null` when there is no session; the caller redirects. It is deliberately not the
 * redirect itself, so a layout can decide where its own sign-in lives, and so this stays
 * usable from a page that wants to render something else instead.
 *
 * This hides UI — it is not authorisation. The API is the enforcement point (ADR-0005), and
 * a token that this app thinks is fine is still rejected on a surface it has no audience for.
 */
export async function requireActor<Z extends Zone>(zone: Z): Promise<ActorByZone[Z] | null> {
  return getActor(zone);
}
