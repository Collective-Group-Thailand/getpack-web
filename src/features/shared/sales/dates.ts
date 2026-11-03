/**
 * Calendar arithmetic for the pipeline, in Asia/Bangkok (UTC+7, no daylight saving): the follow-up picker's quick
 * choices and the protection countdown. Dates only — the web never does money arithmetic (CLAUDE.md); the API owns
 * every business date it stores (it re-arms reminders and holds them out of the quiet hours itself, D-468 §1).
 */
const OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Bangkok calendar day of an instant, `YYYY-MM-DD`. */
export function bangkokDay(at: number | string | Date): string {
  const ms = typeof at === "number" ? at : new Date(at).getTime();
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
}

/** `HH:mm` on the Bangkok day `days` after `now`'s, as an ISO instant with the +07:00 offset the API speaks. */
export function bangkokAt(now: number, days: number, time = "10:00"): string {
  const day = bangkokDay(now + days * DAY_MS);
  return `${day}T${time}:00+07:00`;
}

export type QuickFollowUp = "tomorrow" | "threeDays" | "week";

/** The picker's quick choices: พรุ่งนี้ 10:00 · 3 วัน · 1 สัปดาห์ (each at 10:00 Bangkok). */
export function quickFollowUp(choice: QuickFollowUp, now: number = Date.now()): string {
  const days = choice === "tomorrow" ? 1 : choice === "threeDays" ? 3 : 7;
  return bangkokAt(now, days, "10:00");
}

/** Whole Bangkok calendar days from today until `until` (0 = today, negative = past). */
export function daysUntil(until: string, now: number = Date.now()): number {
  const from = Date.parse(`${bangkokDay(now)}T00:00:00Z`);
  const to = Date.parse(`${bangkokDay(until)}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

/** A `datetime-local` value (Bangkok wall time) from an API instant, and back. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00+07:00`;
}

/** Whether a follow-up is due by the end of today in Bangkok (overdue included) — the list's "ต้องติดตามวันนี้". */
export function isDueToday(iso: string | null | undefined, now: number = Date.now()): boolean {
  if (!iso) return false;
  return bangkokDay(iso) <= bangkokDay(now);
}

/** The Bangkok wall-clock time of an instant, `HH:mm`. */
export function bangkokTime(iso: string): string {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** Whether an instant has passed. */
export function isPast(iso: string | null | undefined, now: number = Date.now()): boolean {
  return Boolean(iso) && Date.parse(iso!) < now;
}
