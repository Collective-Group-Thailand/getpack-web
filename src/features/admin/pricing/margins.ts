/**
 * Packio's sell-margin lines (D-063) as an editable table, checked the way packio-api's
 * constraints check them (`ck_sell_margin_lines__*`, `ex_sell_margin_lines__no_overlap`): runs are
 * inclusive bands, buy prices half-open bands, exactly one of a percentage (below 100) or an
 * amount, and no two lines of the same colour count and difficulty level may cover one point.
 */

import type { Schemas } from "@/lib/api/types";

export type MarginLine = Schemas["SellMarginLineDto"];

export interface EditableMarginLine {
  key: string;
  qtyMin: string;
  qtyMax: string;
  priceMin: string;
  priceMax: string;
  colourCount: string;
  difficultyLevelId: string;
  /** `pct` or `amount`: which value the line gives. */
  valueKind: "pct" | "amount";
  value: string;
  minAmount: string;
}

export type MarginLineProblem =
  "qty" | "qtyOrder" | "price" | "priceOrder" | "colourCount" | "value" | "pct" | "minAmount" | "overlap";

let counter = 0;
export const marginLineKey = () => `line-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const emptyMarginLine = (): EditableMarginLine => ({
  key: marginLineKey(),
  qtyMin: "",
  qtyMax: "",
  priceMin: "",
  priceMax: "",
  colourCount: "",
  difficultyLevelId: "",
  valueKind: "pct",
  value: "",
  minAmount: "",
});

const text = (value: string | number | null) => (value === null ? "" : String(value));

export function toEditable(line: MarginLine): EditableMarginLine {
  return {
    key: marginLineKey(),
    qtyMin: text(line.qtyMin),
    qtyMax: text(line.qtyMax),
    priceMin: text(line.priceMin),
    priceMax: text(line.priceMax),
    colourCount: text(line.colourCount),
    difficultyLevelId: line.difficultyLevelId ?? "",
    valueKind: line.valuePct !== null ? "pct" : "amount",
    value: text(line.valuePct ?? line.valueAmount),
    minAmount: text(line.minAmount),
  };
}

const INT = /^\d+$/;
const AMOUNT = /^\d{1,12}(\.\d{1,6})?$/;
const PCT = /^\d{1,2}(\.\d{1,4})?$/;

/** Each line's problems, by key; empty when the table can be sent. */
export function checkMarginLines(lines: readonly EditableMarginLine[]): Map<string, MarginLineProblem[]> {
  const problems = new Map<string, MarginLineProblem[]>();
  const add = (key: string, problem: MarginLineProblem) => {
    const list = problems.get(key) ?? [];
    if (!list.includes(problem)) list.push(problem);
    problems.set(key, list);
  };
  for (const line of lines) {
    const [qMin, qMax, pMin, pMax] = [line.qtyMin, line.qtyMax, line.priceMin, line.priceMax].map((v) => v.trim());
    if ((qMin && !INT.test(qMin)) || (qMax && !INT.test(qMax))) add(line.key, "qty");
    else if (qMax && Number(qMax) < Number(qMin || 0)) add(line.key, "qtyOrder");
    if ((pMin && !AMOUNT.test(pMin)) || (pMax && !AMOUNT.test(pMax))) add(line.key, "price");
    else if (pMax && Number(pMax) <= Number(pMin || 0)) add(line.key, "priceOrder");
    if (line.colourCount.trim() && !INT.test(line.colourCount.trim())) add(line.key, "colourCount");
    const value = line.value.trim();
    if (!value) add(line.key, "value");
    else if (line.valueKind === "pct" ? !PCT.test(value) : !AMOUNT.test(value)) {
      add(line.key, line.valueKind === "pct" ? "pct" : "value");
    }
    if (line.minAmount.trim() && !AMOUNT.test(line.minAmount.trim())) add(line.key, "minAmount");
  }
  // Two lines of one colour count and level must not share a point of run × buy price.
  const valid = lines.filter((line) => !problems.has(line.key));
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i]!;
      const b = valid[j]!;
      if (a.colourCount.trim() !== b.colourCount.trim() || a.difficultyLevelId !== b.difficultyLevelId) continue;
      if (runsOverlap(a, b) && pricesOverlap(a, b)) {
        add(a.key, "overlap");
        add(b.key, "overlap");
      }
    }
  }
  return problems;
}

const bound = (value: string, open: number) => (value.trim() ? Number(value) : open);

/** Inclusive runs; an empty end is open. */
function runsOverlap(a: EditableMarginLine, b: EditableMarginLine) {
  return (
    bound(a.qtyMin, -Infinity) <= bound(b.qtyMax, Infinity) && bound(b.qtyMin, -Infinity) <= bound(a.qtyMax, Infinity)
  );
}

/** Half-open buy-price bands [from, to). */
function pricesOverlap(a: EditableMarginLine, b: EditableMarginLine) {
  return (
    bound(a.priceMin, -Infinity) < bound(b.priceMax, Infinity) &&
    bound(b.priceMin, -Infinity) < bound(a.priceMax, Infinity)
  );
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);
const intOrNull = (value: string) => (value.trim() ? Number(value.trim()) : null);

/** The lines as packio-api takes them. Call only when `checkMarginLines` found nothing. */
export function toApiLines(lines: readonly EditableMarginLine[]): MarginLine[] {
  return lines.map((line) => ({
    qtyMin: intOrNull(line.qtyMin),
    qtyMax: intOrNull(line.qtyMax),
    priceMin: orNull(line.priceMin),
    priceMax: orNull(line.priceMax),
    colourCount: intOrNull(line.colourCount),
    difficultyLevelId: line.difficultyLevelId || null,
    valuePct: line.valueKind === "pct" ? line.value.trim() : null,
    valueAmount: line.valueKind === "amount" ? line.value.trim() : null,
    minAmount: orNull(line.minAmount),
  }));
}
