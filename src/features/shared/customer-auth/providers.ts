import { clientEnv } from "@/lib/env";

/**
 * Which third-party sign-in options this deployment can actually offer.
 *
 * Firebase (Google, Apple) and LINE need credentials that are configured per environment. A
 * button that looks available and then fails is worse than one that is plainly not offered,
 * so the sheet asks here first. F3 completes LIFF (00-master-plan.md §7); the exchange
 * endpoints, the CSP origins and this check are in place so that is wiring, not rework.
 */
export function firebaseConfigured(): boolean {
  return Boolean(clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY && clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
}

export function lineConfigured(): boolean {
  return Boolean(clientEnv.NEXT_PUBLIC_LIFF_ID);
}
