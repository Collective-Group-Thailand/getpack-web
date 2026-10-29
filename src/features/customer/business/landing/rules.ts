import { compareDecimal } from "@/features/customer/catalog/ordering";

/**
 * The landing's client-side rules (business pack Phase 1 items 3–5). Pure, no fetching. Amounts from the API are
 * decimal strings: they are only compared here, never added up (CLAUDE.md: the API computes money).
 */

/**
 * Whether an order of `amount` (the API's decimal string) needs approval above `threshold` (whole baht the visitor
 * set; 0 = every order) — compared as written, digit by digit (`compareDecimal`), never turned into a number.
 */
export function overThreshold(amount: string, threshold: number): boolean {
  if (threshold <= 0) return true;
  return compareDecimal(amount, String(Math.trunc(threshold))) > 0;
}

/** The visitor's ROI inputs. */
export interface RoiInput {
  quotesPerMonth: number;
  hoursPerQuote: number;
  approvalsPerMonth: number;
  hourlyCost: number;
}

/** Minutes the system saves per approval — the assumption the page states under the result. */
export const MINUTES_SAVED_PER_APPROVAL = 15;

/**
 * Hours and baht the purchasing team gets back per year from the visitor's own numbers: quotations not chased
 * (quotes × hours each) plus approvals in the system (× 15 minutes), × 12 months; baht = hours × hourly cost.
 * Rounded to whole hours and baht — an estimate, shown with its formula.
 */
export function roi(input: RoiInput): { quoteHours: number; approvalHours: number; hours: number; baht: number } {
  const quoteHours = Math.round(input.quotesPerMonth * input.hoursPerQuote * 12);
  const approvalHours = Math.round(((input.approvalsPerMonth * MINUTES_SAVED_PER_APPROVAL) / 60) * 12);
  const hours = quoteHours + approvalHours;
  return { quoteHours, approvalHours, hours, baht: Math.round(hours * input.hourlyCost) };
}

/** A monthly budget's state: under 80 % fine, from 80 % a warning, over 100 % the next order needs approval. */
export function budgetState(budget: number, spent: number): { pct: number; state: "ok" | "warn" | "over" } {
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  return { pct, state: pct > 100 ? "over" : pct >= 80 ? "warn" : "ok" };
}

/** The required documents ticked (the first three; statements are optional), for the checklist's progress. */
export const REQUIRED_DOCS = ["certificate", "vat", "id"] as const;
export const ALL_DOCS = [...REQUIRED_DOCS, "statements"] as const;
export type DocKey = (typeof ALL_DOCS)[number];

export function docsReady(checked: readonly string[]): number {
  return REQUIRED_DOCS.filter((key) => checked.includes(key)).length;
}

/** Reads the checklist saved on this device; anything unexpected reads as nothing ticked. */
export function readDocs(raw: string | null): DocKey[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? ALL_DOCS.filter((key) => parsed.includes(key)) : [];
  } catch {
    return [];
  }
}
