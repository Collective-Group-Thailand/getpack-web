/**
 * The browser's device id for the free dieline download without sign-in (D-471).
 *
 * getpack-api counts a browser's downloads without sign-in by the SHA-256 of a random id
 * (`store.dielines.downloadFree`, `deviceId`): the first is free and needs no account, from the
 * second it asks for a free sign-in. The id lives here, in a first-party httpOnly cookie that no
 * script can read or choose — the BFF reads it (or makes one) and writes it into the request body
 * on its way to the API, replacing whatever the browser sent. It is not a token: it opens nothing,
 * it only counts. PDPA: pseudonymous, never logged; the API keeps only its hash.
 */

import type { SessionCookieWrite } from "@/lib/auth/session";
import type { Zone } from "@/lib/zones";

export const DEVICE_COOKIE = "gp_device";
/** A year: long enough that a returning visitor is the same browser, short of "forever". */
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The upstream paths whose body carries the device id — the customer zone's free dieline download only. */
const DEVICE_ID_PATHS: Partial<Record<Zone, readonly string[]>> = {
  customer: ["/v1/store/dielines/downloads/free"],
};

export function needsDeviceId(zone: Zone, upstreamPath: string, method: string): boolean {
  return method === "POST" && (DEVICE_ID_PATHS[zone] ?? []).includes(upstreamPath);
}

/** The cookie's id when it is a well-formed one; otherwise a new one (and the cookie to set). */
export function deviceIdOf(
  cookie: string | undefined,
  secure: boolean,
): { id: string; write: SessionCookieWrite | null } {
  if (cookie && UUID.test(cookie)) return { id: cookie.toLowerCase(), write: null };
  const id = crypto.randomUUID();
  return {
    id,
    write: {
      name: DEVICE_COOKIE,
      value: id,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    },
  };
}

/**
 * The JSON body with `deviceId` set to the cookie's id. A body that is not a JSON object is passed
 * on untouched, so the API answers it with its own validation problem.
 */
export function withDeviceId(body: ArrayBuffer | undefined, deviceId: string): ArrayBuffer | undefined {
  if (!body) return body;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return body;
    const encoded = new TextEncoder().encode(JSON.stringify({ ...parsed, deviceId }));
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  } catch {
    return body;
  }
}
