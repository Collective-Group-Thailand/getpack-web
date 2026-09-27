"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * After a mutation, re-render the Server Components of this screen with what the API now says.
 *
 * Partner screens render their data on the server (RSC by default, the 180 KB budget) and keep
 * client code to the controls; a successful write refreshes the route instead of patching a
 * client cache, so the screen always shows the server's state — the rule B4 sets for the
 * shop floor ("server wins").
 */
export function useRefresh(): [refresh: () => void, pending: boolean] {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  return [refresh, pending];
}

/** A date input's value as the start of that day in Bangkok, the form the contract takes. */
export const bangkokDay = (value: string) => `${value}T00:00:00+07:00`;

/** Today in Bangkok as `YYYY-MM-DD`, for a date input's `min`. */
export const bangkokToday = (offsetDays = 0) =>
  new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
