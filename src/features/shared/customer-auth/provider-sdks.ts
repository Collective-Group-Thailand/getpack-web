"use client";

import { clientEnv } from "@/lib/env";

/**
 * The third-party sign-in SDKs, loaded on click (F1.2: "the SDKs load on click in F3"). None of
 * this is in a page's initial JavaScript: each function imports its SDK when a customer chooses
 * that provider, which is the only moment it is needed.
 *
 * Both return a provider token for the API to verify (`POST /v1/auth/customer/firebase`, `…/line`);
 * this app never decides who someone is from a provider's answer on its own.
 */

export type FirebaseProvider = "google" | "apple";

/** A cancelled popup is the customer changing their mind, not a failure to report. */
export class ProviderCancelled extends Error {}

export async function firebaseIdToken(provider: FirebaseProvider): Promise<string> {
  const [{ initializeApp, getApps }, auth] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  const firebaseAuth = auth.getAuth(app);
  const authProvider = provider === "google" ? new auth.GoogleAuthProvider() : new auth.OAuthProvider("apple.com");
  try {
    const credential = await auth.signInWithPopup(firebaseAuth, authProvider);
    const token = await credential.user.getIdToken();
    // The Firebase session is only a step to the API's: it is not kept in this browser.
    await auth.signOut(firebaseAuth);
    return token;
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") throw new ProviderCancelled();
    throw error;
  }
}

export interface LineIdentity {
  idToken?: string;
  liffAccessToken?: string;
  /** Opened inside the LINE app (LIFF, D-151): consent is recorded with `source: line_liff`. */
  inClient: boolean;
}

async function liff() {
  const { default: sdk } = await import("@line/liff");
  await sdk.init({ liffId: clientEnv.NEXT_PUBLIC_LIFF_ID! });
  return sdk;
}

/**
 * LINE Login through the LIFF SDK, on the web and inside LINE alike.
 *
 * Returns the identity straight away when LINE already has a session (inside the LINE app, or
 * back from the login redirect); otherwise sends the browser to LINE and returns `null` — the
 * page is navigating away, and `/sign-in?provider=line` picks the flow up on the way back.
 */
export async function lineIdentity(returnUrl: string): Promise<LineIdentity | null> {
  const sdk = await liff();
  if (!sdk.isLoggedIn()) {
    sdk.login({ redirectUri: returnUrl });
    return null;
  }
  const inClient = sdk.isInClient();
  return {
    idToken: sdk.getIDToken() ?? undefined,
    liffAccessToken: inClient ? (sdk.getAccessToken() ?? undefined) : undefined,
    inClient,
  };
}
