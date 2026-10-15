"use client";

import { useSyncExternalStore } from "react";

import type { Schemas } from "@/lib/api/types";

import type { saveQuote } from "../configurator/pricing";

/**
 * A guest's cart, kept in this browser until they sign in (UX audit Flow 1, bug #3).
 *
 * packio-api's cart is a customer's (`store.cart.*`), and so is the saved quotation a cart line
 * points at (D-051). A guest can still price a box, though, and the storefront promises they can
 * do it without an account — so the configurator keeps what they chose here, the cart shows it,
 * and checkout asks them to sign in, after which `useGuestCartMerge` saves each line as a quotation
 * at today's price and adds it to their account's cart.
 *
 * What is kept is the configuration (the body `store.quotes.save` takes) and the price the API
 * showed for it, which is displayed as "the price when you added it" and never computed on. No
 * token, no personal data. The browser may refuse storage (a private window): the guest cart is
 * then empty and the configurator falls back to asking them to sign in.
 */

/** `store.quotes.save`'s body, as the configurator builds it. */
export type GuestCartBody = Parameters<typeof saveQuote>[0];

export interface GuestCartLine {
  id: string;
  /** The configurator's product slug, for "แก้ไข" and the line's link. */
  slug: string;
  productName: string;
  quantity: number;
  unit: string;
  /** The API's gross amount for the quantity when the line was added — shown, never computed on. */
  grossAmount: string | null;
  /** Short spec lines ("กล่องฝาชน · 200 × 140 × 60 มม.", "KA125 ลอน B"). */
  specs: string[];
  designOption: Schemas["DesignOption"];
  body: GuestCartBody;
  addedAt: string;
}

const KEY = "pk_guest_cart_v1";
const EVENT = "pk:guest-cart";
const EMPTY: readonly GuestCartLine[] = Object.freeze([]);

let cache: { raw: string | null; lines: readonly GuestCartLine[] } = { raw: null, lines: EMPTY };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readGuestCart(): readonly GuestCartLine[] {
  const store = storage();
  if (!store) return EMPTY;
  let raw: string | null = null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.lines;
  let lines: readonly GuestCartLine[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) lines = parsed.filter(isLine);
  } catch {
    lines = EMPTY;
  }
  cache = { raw, lines };
  return lines;
}

function write(lines: readonly GuestCartLine[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    if (lines.length === 0) store.removeItem(KEY);
    else store.setItem(KEY, JSON.stringify(lines));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENT));
  return true;
}

/** Adds a line; false when this browser keeps nothing (the caller then asks to sign in instead). */
export function addGuestLine(line: Omit<GuestCartLine, "id" | "addedAt">): boolean {
  const next: GuestCartLine = { ...line, id: crypto.randomUUID(), addedAt: new Date().toISOString() };
  return write([...readGuestCart(), next]);
}

export function removeGuestLine(id: string): void {
  write(readGuestCart().filter((line) => line.id !== id));
}

export function clearGuestCart(): void {
  write(EMPTY);
}

const TRIED_KEY = "pk_guest_cart_tried_v1";

/**
 * Lines the account's cart refused on an earlier visit (no instant price any more, a product
 * withdrawn). They stay in this browser for the guest to see, but the merge does not try them —
 * and announce the failure — on every visit (owner walkthrough 2026-10-14: the empty cart kept
 * saying "could not move 1 line").
 */
export function readTriedLines(): ReadonlySet<string> {
  const store = storage();
  if (!store) return new Set();
  try {
    const parsed: unknown = JSON.parse(store.getItem(TRIED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function markTriedLines(ids: readonly string[]): void {
  const store = storage();
  if (!store) return;
  try {
    const kept = readGuestCart().map((line) => line.id);
    const next = [...new Set([...readTriedLines(), ...ids])].filter((id) => kept.includes(id));
    if (next.length === 0) store.removeItem(TRIED_KEY);
    else store.setItem(TRIED_KEY, JSON.stringify(next));
  } catch {
    // Storage refused: the line is tried again next visit, which is the old behaviour.
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The guest cart's lines; empty on the server and until hydration. */
export function useGuestCart(): readonly GuestCartLine[] {
  return useSyncExternalStore(subscribe, readGuestCart, () => EMPTY);
}

function isLine(value: unknown): value is GuestCartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Partial<GuestCartLine>;
  return (
    typeof line.id === "string" &&
    typeof line.slug === "string" &&
    typeof line.productName === "string" &&
    typeof line.quantity === "number" &&
    typeof line.body === "object" &&
    line.body !== null &&
    Array.isArray(line.specs)
  );
}
