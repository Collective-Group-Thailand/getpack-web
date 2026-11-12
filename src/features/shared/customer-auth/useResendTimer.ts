"use client";

import { useEffect, useState } from "react";

/**
 * Seconds left before "send a new code" is offered again.
 *
 * Takes a deadline rather than a duration, so nothing has to copy a prop into state and
 * re-sync it — the countdown is derived from the clock, and the only state is the clock
 * itself. The cooldown is the API's `resendAfterSeconds`, turned into a deadline at the
 * moment the challenge arrives: the policy is the backend's, and the API is what actually
 * refuses an early resend. This is only the number someone watches.
 */
export function useResendTimer(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null || deadline <= now) return;
    const id = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(id);
  }, [deadline, now]);

  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
