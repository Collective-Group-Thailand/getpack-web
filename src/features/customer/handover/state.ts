import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";

/** What the carrier's driver sees through a handover link (`store.handover.resolve`, D-462). */
export type Handover = Schemas["DriverHandoverDto"];

/**
 * The driver page's screens. Every one but `ready` is a centred card with the next step; the ones reached from a
 * loaded trip keep it, so "back" returns to the recipient without opening the link again (each open is audited).
 */
export type HandoverScreen =
  | { kind: "loading" }
  | { kind: "ready"; handover: Handover }
  | { kind: "picked-up"; handover: Handover }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "not-ready"; handover: Handover | null }
  | { kind: "wrong-carton"; handover: Handover | null }
  | { kind: "error"; handover: Handover | null };

/** A trip as the API answered it: picked up once the pickup is recorded, otherwise ready to confirm. */
export function screenOfHandover(handover: Handover): HandoverScreen {
  return handover.pickupConfirmedAt ? { kind: "picked-up", handover } : { kind: "ready", handover };
}

/**
 * A refused open or confirmation, by the API's answer (`store.handover.*`):
 * 404 unknown or revoked (and 422 for a token of the wrong shape, which says the same) → not found;
 * 410 `handover.expired`; 409 `handover.not_ready` (the shipping gate is closed — the API does not say why);
 * 422 `handover.scan_mismatch` (a scanned carton is not this trip's); anything else, the network included, → error.
 */
export function screenOfError(error: unknown, handover: Handover | null = null): HandoverScreen {
  if (!isApiError(error)) return { kind: "error", handover };
  if (error.status === 410 || error.code === "handover.expired") return { kind: "expired" };
  if (error.code === "handover.scan_mismatch") return { kind: "wrong-carton", handover };
  if (error.status === 409 || error.code === "handover.not_ready") return { kind: "not-ready", handover };
  if (error.status === 404 || error.status === 422) return { kind: "not-found" };
  return { kind: "error", handover };
}

/** The shape getpack-api accepts for a carton's tracking token (`ConfirmHandoverPickupDto.scannedTokens`). */
const TRACKING_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/**
 * The tracking token a carton QR carries: the QR encodes the public tracking URL `<storefront>/track/<token>`
 * (D-462). A bare token is accepted too; anything else (another QR, a label code) is not a carton of getpack's.
 */
export function trackingTokenOf(raw: string): string | null {
  const value = raw.trim();
  if (TRACKING_TOKEN.test(value)) return value;
  let path: string;
  try {
    path = new URL(value).pathname;
  } catch {
    return null;
  }
  const token = /^(?:\/(?:th|en))?\/track\/([^/]+)\/?$/.exec(path)?.[1];
  return token && TRACKING_TOKEN.test(token) ? token : null;
}

/** The phone number as a `tel:` link (spaces and dashes dropped; a leading `+` kept). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * A Thai number as people read it: `+66810001234` → `081-000-1234`, `+6621234567` → `02-123-4567`, `+6653123456` → `053-123-456`. Anything else
 * is shown as sent.
 */
export function displayPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  const local = digits.startsWith("+66") ? `0${digits.slice(3)}` : digits;
  if (/^0[689]\d{8}$/.test(local)) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  if (/^02\d{7}$/.test(local)) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  if (/^0\d{8}$/.test(local)) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  return phone;
}
