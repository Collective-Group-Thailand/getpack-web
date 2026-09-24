"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { CONSENT_COOKIE, CONSENT_COOKIE_MAX_AGE, parseConsent, serialiseConsent, type ConsentState } from "./consent";

function readCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * `null` means "not asked yet" and is what shows the banner. A cookie saying everything is
 * denied is an *answer*, and the banner must not come back for it.
 */
const readSnapshot = () => readCookie() ?? "";
const readServerSnapshot = () => "";

export function useConsent() {
  // A string snapshot, not an object: `useSyncExternalStore` compares with `Object.is`, and
  // returning a fresh object each call is an infinite render loop.
  const raw = useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot);
  const [, force] = useState(0);

  const consent = parseConsent(raw);

  const save = useCallback((next: ConsentState) => {
    document.cookie = `${CONSENT_COOKIE}=${serialiseConsent(next)}; path=/; max-age=${CONSENT_COOKIE_MAX_AGE}; samesite=lax${
      window.location.protocol === "https:" ? "; secure" : ""
    }`;
    notify();
    force((n) => n + 1);
  }, []);

  return { consent, asked: consent !== null, save };
}
