import "server-only";

import { getActor } from "@/lib/auth/actor";

/**
 * The signed-in customer inside LIFF, or `null`. LIFF pages never redirect to `/sign-in` on
 * their own: they show `LiffSignIn`, which signs in with LINE where it can (D-151).
 */
export async function liffCustomer() {
  return getActor("customer");
}
