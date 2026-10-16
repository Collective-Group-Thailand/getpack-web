/** Dates of effective-dated versions (ADR-0005), picked as Bangkok days. */

export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/** A date picked in Bangkok as the instant that day starts there. */
export const startOfDay = (day: string) => `${day}T00:00:00+07:00`;

/**
 * When a picked day takes effect: its start in Bangkok, or — for today, whose start has passed and
 * would be refused as back-dated (ADR-0005) — a minute from now.
 */
export const effectiveInstant = (day: string) =>
  day === today() ? new Date(Date.now() + 60_000).toISOString() : startOfDay(day);
