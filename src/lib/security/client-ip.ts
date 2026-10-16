/**
 * The visitor's IP address, for the API's per-IP throttles (getpack-api B6.3, `SECURITY.md` §7 #1).
 *
 * Every browser call reaches getpack-api from this app — through the BFF, a Server Component or a
 * Server Action — so without help the API's general, OTP, sign-in and coupon-code throttles see
 * one address, ours, and would throttle every visitor together. This app therefore tells the API
 * who the visitor is, in `X-Forwarded-For`, and getpack-api's `TRUST_PROXY` counts this app as
 * one more hop.
 *
 * What is *not* done is passing the browser's `X-Forwarded-For` along. Anyone can send that
 * header, so a forwarded chain would let a visitor pick the address they are throttled as. The
 * only entries that can be trusted are the ones our own load balancers appended, from the right;
 * `TRUSTED_PROXY_HOPS` says how many there are, and the entry that many places from the right is
 * the address that connected to the outermost of them — the visitor. Exactly that one address is
 * sent on. With no trusted hop (local development, the default) nothing is known and nothing is
 * sent: the API then sees this app, which is the truth.
 */

export const FORWARDED_FOR_HEADER = "x-forwarded-for";

/** IPv4 or IPv6 (optionally with a zone id), the forms a load balancer writes. */
const IP_ADDRESS = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]*:[0-9a-f:.]*(?:%[\w.-]+)?)$/i;

export function isIpAddress(value: string): boolean {
  if (value.length > 64 || !IP_ADDRESS.test(value)) return false;
  if (value.includes(":")) return true;
  return value.split(".").every((part) => Number(part) <= 255);
}

/**
 * The visitor's address from the request's `X-Forwarded-For`, trusting the `trustedHops`
 * right-most entries; `null` when that cannot be known.
 */
export function clientIp(headers: Headers, trustedHops: number): string | null {
  if (!Number.isInteger(trustedHops) || trustedHops < 1) return null;

  const chain = (headers.get(FORWARDED_FOR_HEADER) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  // Fewer entries than trusted proxies means the request did not come through all of them;
  // guessing would hand the choice back to whoever sent the header.
  const address = chain[chain.length - trustedHops];
  return address && isIpAddress(address) ? address : null;
}
