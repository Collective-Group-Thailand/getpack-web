/**
 * The dashboard's period. The published analytics take explicit `from` / `to` dates
 * (Asia/Bangkok, `to` inclusive) and no preset, so the screen turns its preset into the two dates
 * itself — the triage hands that to the frontend (`admin.analytics`). Calendar days only: which
 * figures fall in them is the API's.
 */

export type Range = "7d" | "30d" | "90d" | "custom";
export interface Period {
  from: string;
  to: string;
}

const LENGTH: Record<Exclude<Range, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Today's calendar date in Asia/Bangkok, `YYYY-MM-DD`. */
export function bangkokToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

/** A calendar date `n` days from `day` (both `YYYY-MM-DD`). */
export function addDays(day: string, n: number): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, date + n)).toISOString().slice(0, 10);
}

function length({ from, to }: Period): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * A preset ends yesterday: the rollups are nightly, so today has no figures yet. `null` for a
 * custom period until both dates are chosen, the right way round.
 */
export function periodOf(range: Range, custom: Partial<Period>, now: Date = new Date()): Period | null {
  if (range === "custom") {
    const { from, to } = custom;
    return from && to && from <= to ? { from, to } : null;
  }
  const to = addDays(bangkokToday(now), -1);
  return { from: addDays(to, -(LENGTH[range] - 1)), to };
}

/** The period of equal length just before, for the "previous period" figures. */
export function previousPeriod(period: Period): Period {
  return { from: addDays(period.from, -length(period)), to: addDays(period.from, -1) };
}
