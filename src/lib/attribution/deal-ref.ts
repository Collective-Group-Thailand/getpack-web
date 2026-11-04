/**
 * Loyalty P1.5: an agent's deal share link (`/deals/{slug}?ref=AGT12345`, PLAN §3.5.3). The proxy keeps the code in
 * a first-party cookie for 30 days and the deal reads forward it to the API (`?ref=`), which records the attribution
 * (`promotion_ref_attributions`) — the browser decides nothing. httpOnly: only the server reads it.
 *
 * Agent codes have the shape the agent programme issues (`/a/{code}`, D-417): 6–12 letters and digits.
 */

export const DEAL_REF_COOKIE = "pk_deal_ref";
export const DEAL_REF_MAX_AGE = 30 * 24 * 60 * 60;

/** The code, upper-cased, or null when it is not an agent code. */
export function cleanDealRef(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z0-9]{6,12}$/.test(code) ? code : null;
}

export function dealRefCookie(ref: string, secure: boolean) {
  return {
    name: DEAL_REF_COOKIE,
    value: ref,
    maxAge: DEAL_REF_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure,
    httpOnly: true,
  };
}
