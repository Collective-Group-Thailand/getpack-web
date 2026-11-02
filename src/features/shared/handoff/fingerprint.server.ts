import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

/**
 * The device fingerprint a storefront → getpack Agent hand-off is bound to (D-467, `CreateHandoffDto.fingerprint`).
 *
 * The storefront's server sends it when it asks for the code and the agent zone's server sends it again when it
 * redeems: both derive it from the same request header — the browser's user agent — with a fixed salt, so no
 * cookie has to cross subdomains and nothing identifying is stored (the API keeps only a hash of this hash). It does
 * not authenticate anyone; the single-use, 60-second code does. It only makes a code copied to another browser
 * worthless — a wrong fingerprint burns the code.
 */
const SALT = "getpack.handoff.v1";

export function fingerprintFor(userAgent: string | null): string {
  return createHash("sha256")
    .update(`${SALT}\n${userAgent ?? ""}`)
    .digest("hex");
}

export async function requestFingerprint(): Promise<string> {
  return fingerprintFor((await headers()).get("user-agent"));
}
