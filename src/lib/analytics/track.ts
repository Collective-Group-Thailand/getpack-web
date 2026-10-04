"use client";

import { CSRF_HEADER } from "@/lib/api/client";
import { browserBffUrl } from "@/lib/zones";

import { CONSENT_COOKIE, parseConsent } from "./consent";
import type { AnalyticsProperties, FunnelEvent } from "./events";
import { toIngestEvent, type Visitor } from "./ingest";

/**
 * Sends a funnel event to Packio's own API through the storefront BFF, as packio-api's
 * `store.analytics.ingest` takes it: a batch of one `AnalyticsEventDto` (see `./ingest.ts`).
 *
 * Customer zone only: D-102's funnel is about customers, and staff clicking around the back
 * office would be noise in every conversion rate. The zone is fixed here rather than taken as
 * an argument so there is no call site that can get it wrong.
 *
 * Fire-and-forget, `keepalive`, never throws. `order_placed` fires as the page is navigating
 * away, which is exactly when an ordinary fetch is cancelled — and a funnel that loses its
 * last step measures the wrong thing.
 */
export function track(name: FunnelEvent, properties: AnalyticsProperties = {}): void {
  if (typeof window === "undefined") return;
  // The app's own funnel step, whatever packio-api ingests of it: the UX journeys (U5.0,
  // `docs/ux/funnels.md`, `e2e/journeys/`) count these names, several of which the API derives
  // on its side instead of receiving.
  window.dispatchEvent(new CustomEvent(FUNNEL_STEP_EVENT, { detail: name }));

  const event = toIngestEvent(name, properties, visitor(), new Date(), crypto.randomUUID());
  if (!event) return;
  const url = browserBffUrl("customer", "/analytics/events");
  const body = JSON.stringify({ events: [event] });

  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch(url, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
  }).catch(() => {
    // Measurement must never surface as an error to the person being measured.
  });
}

/** The DOM event `track()` raises with the app's own step name, before mapping it for the API. */
export const FUNNEL_STEP_EVENT = "packio:funnel-step";

const VISITOR_COOKIE = "pk_vid";
const SESSION_KEY = "pk_sid";
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

/** Ids for this page when nothing may be kept: packio-api discards them without consent anyway. */
let ephemeral: Visitor | null = null;

/**
 * The visitor and session the API counts by. Kept — a first-party cookie for a year, the session
 * in `sessionStorage` — only with analytics consent (D-144); otherwise ids that live and die with
 * this page, so nothing identifies a visitor who did not agree to be counted as one.
 */
function visitor(): Visitor {
  const consent = parseConsent(readCookie(CONSENT_COOKIE));
  if (!consent?.analytics) return (ephemeral ??= { anonymousId: newId(), sessionId: newId() });
  try {
    let anonymousId = readCookie(VISITOR_COOKIE);
    if (!anonymousId || !/^[A-Za-z0-9_-]{8,64}$/.test(anonymousId)) {
      anonymousId = newId();
      document.cookie = `${VISITOR_COOKIE}=${anonymousId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = newId();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return { anonymousId, sessionId };
  } catch {
    return (ephemeral ??= { anonymousId: newId(), sessionId: newId() });
  }
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
