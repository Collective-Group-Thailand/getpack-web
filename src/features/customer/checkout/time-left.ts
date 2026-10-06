/**
 * A QR's time left in words a customer reads at a glance (round 2, B12): "23 ชม. 59 นาที" while
 * there are hours, "14:05 นาที" in the last hour — never "1439:14".
 */
export type TimeLeft =
  | { kind: "hours"; hours: number; minutes: number }
  | { kind: "minutes"; minutes: number; seconds: string };

export function timeLeft(ms: number): TimeLeft {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return { kind: "hours", hours, minutes };
  return { kind: "minutes", minutes, seconds: String(total % 60).padStart(2, "0") };
}

/** How much of the QR's life is left, 0–1, for the ring beside the time (`leftMs` from the countdown). */
export function lifeLeft(createdAt: string, expiresAt: string, leftMs: number): number {
  const span = Date.parse(expiresAt) - Date.parse(createdAt);
  if (!(span > 0)) return 0;
  return Math.min(1, Math.max(0, leftMs / span));
}
