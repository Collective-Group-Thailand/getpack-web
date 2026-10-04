"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";

import { toast } from "@/ui/components/Toast";

/**
 * The signed-in customer's saved styles (`store.styleFavourites.*`, D-246), read once in the
 * browser — the library page is cached for everyone, so it cannot carry them. A guest has none
 * and is sent to sign in. A small store shared by every card rather than a query: the library's
 * first load stays inside the marketing budget (U3.5 §4); the API client loads with the first read.
 */

const api = async () => (await import("@/lib/api/browser")).browserApi();

let saved = new Set<string>();
let busy: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (next: Set<string>, nextBusy: string | null = busy) => {
  saved = next;
  busy = nextBusy;
  emit();
};

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const { data } = await (await api()).GET("/v1/store/style-favourites");
    set(new Set((data ?? []).map((f) => f.style.code)));
  } catch {
    loaded = false;
  }
}

type Snapshot = { saved: Set<string>; busy: string | null };
let snapshot: Snapshot = { saved, busy };
const read = () => (snapshot.saved === saved && snapshot.busy === busy ? snapshot : (snapshot = { saved, busy }));
const EMPTY: Snapshot = { saved: new Set(), busy: null };

export function useStyleFavourites(signedIn: boolean) {
  const t = useTranslations("styles.favourites");
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn]);

  const toggle = async (code: string) => {
    const before = saved;
    const on = !before.has(code);
    const next = new Set(before);
    if (on) next.add(code);
    else next.delete(code);
    set(next, code);
    try {
      const client = await api();
      const params = { params: { path: { code } } };
      const { error } = on
        ? await client.PUT("/v1/store/style-favourites/{code}", params)
        : await client.DELETE("/v1/store/style-favourites/{code}", params);
      if (error) throw error;
      set(saved, null);
      toast.success(on ? t("added") : t("removed"));
    } catch {
      set(before, null);
    }
  };

  return {
    has: (code: string) => state.saved.has(code),
    toggle: (code: string) => void toggle(code),
    pending: (code: string) => state.busy === code,
  };
}
