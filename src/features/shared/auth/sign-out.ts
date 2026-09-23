"use server";

import { redirect } from "next/navigation";

import type { Zone } from "@/lib/zones";

import { endSession } from "./session-actions";

/** Where each zone sends someone after signing out. */
const AFTER_SIGN_OUT = {
  customer: "/",
  admin: "/login",
  partner: "/login",
} as const satisfies Record<Zone, string>;

/**
 * Sign out of this zone.
 *
 * The cookies are host-only, so this ends the session on this host and no other: signing out
 * of the admin host does not touch a customer session in the same browser, which is exactly
 * what the zone split is for (ADR-0004).
 */
export async function signOut(zone: Zone): Promise<never> {
  await endSession();
  redirect(AFTER_SIGN_OUT[zone]);
}
