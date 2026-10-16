import type { Schemas } from "@/lib/api/types";

/**
 * A rate line as the editor holds it, for either card (D-013): the customer card's `priceAmount`
 * and the factory payout card's `payoutAmount` are both `amount` here. Weights are typed in kg and
 * sent in grams; bands are half-open (`min` inclusive, `max` exclusive, an empty `max` is open).
 */
export interface EditableLine {
  key: string;
  zoneId: string;
  postcode: string;
  weightMinKg: string;
  weightMaxKg: string;
  volumeMinCm3: string;
  volumeMaxCm3: string;
  amount: string;
  perExtraKg: string;
}

export type CustomerRate = Schemas["CustomerRateDto"];
export type FactoryRate = Schemas["FactoryRateDto"];
export type VersionStatus = Schemas["ConfigVersionStatus"];

/** A plain decimal amount in THB — what the API accepts as a money string. */
export const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
export const POSTCODE = /^\d{5}$/;

let seq = 0;
export const lineKey = () => `line-${++seq}`;

const kg = (grams: number | null) => (grams === null ? "" : String(grams / 1000));
const int = (value: number | null) => (value === null ? "" : String(value));

export function editable(
  rate: Pick<
    CustomerRate,
    "zoneId" | "postcode" | "weightMinG" | "weightMaxG" | "volumeMinCm3" | "volumeMaxCm3" | "perExtraKg"
  >,
  amount: string,
): EditableLine {
  return {
    key: lineKey(),
    zoneId: rate.zoneId,
    postcode: rate.postcode ?? "",
    weightMinKg: kg(rate.weightMinG),
    weightMaxKg: kg(rate.weightMaxG),
    volumeMinCm3: int(rate.volumeMinCm3),
    volumeMaxCm3: int(rate.volumeMaxCm3),
    amount,
    perExtraKg: rate.perExtraKg ?? "",
  };
}

export const emptyLine = (zoneId = ""): EditableLine => ({
  key: lineKey(),
  zoneId,
  postcode: "",
  weightMinKg: "0",
  weightMaxKg: "",
  volumeMinCm3: "",
  volumeMaxCm3: "",
  amount: "",
  perExtraKg: "",
});

/** Why a line cannot be sent; the key of `shipping.editor.errors.*`. */
export type LineProblem =
  "zone" | "postcode" | "weight" | "weightOrder" | "volume" | "volumeOrder" | "amount" | "perExtraKg" | "overlap";

const grams = (text: string) => Math.round(Number(text) * 1000);
const isNumber = (text: string) => text.trim() !== "" && Number.isFinite(Number(text)) && Number(text) >= 0;

export interface RateInput {
  zoneId: string;
  postcode: string | null;
  weightMinG: number;
  weightMaxG: number | null;
  volumeMinCm3: number | null;
  volumeMaxCm3: number | null;
  amount: string;
  perExtraKg: string | null;
}

export function toInput(line: EditableLine): RateInput {
  return {
    zoneId: line.zoneId,
    postcode: line.postcode.trim() || null,
    weightMinG: grams(line.weightMinKg),
    weightMaxG: line.weightMaxKg.trim() ? grams(line.weightMaxKg) : null,
    volumeMinCm3: line.volumeMinCm3.trim() ? Math.trunc(Number(line.volumeMinCm3)) : null,
    volumeMaxCm3: line.volumeMaxCm3.trim() ? Math.trunc(Number(line.volumeMaxCm3)) : null,
    amount: line.amount.trim(),
    perExtraKg: line.perExtraKg.trim() || null,
  };
}

/** `[min, max)` with `null` as unbounded. */
const overlaps = (aMin: number, aMax: number | null, bMin: number, bMax: number | null) =>
  (bMax === null || aMin < bMax) && (aMax === null || bMin < aMax);

/**
 * The checks getpack-api makes, made first so a long card is fixed in place: every field readable,
 * each band's max above its min, and no two lines of the same zone (and postcode) whose weight and
 * volume bands both overlap.
 */
export function problemsOf(lines: readonly EditableLine[]): Map<string, LineProblem[]> {
  const problems = new Map<string, LineProblem[]>();
  const add = (key: string, problem: LineProblem) => problems.set(key, [...(problems.get(key) ?? []), problem]);
  for (const line of lines) {
    if (!line.zoneId) add(line.key, "zone");
    if (line.postcode.trim() && !POSTCODE.test(line.postcode.trim())) add(line.key, "postcode");
    if (!isNumber(line.weightMinKg) || (line.weightMaxKg.trim() && !isNumber(line.weightMaxKg)))
      add(line.key, "weight");
    else if (line.weightMaxKg.trim() && grams(line.weightMaxKg) <= grams(line.weightMinKg))
      add(line.key, "weightOrder");
    const vMin = line.volumeMinCm3.trim();
    const vMax = line.volumeMaxCm3.trim();
    if ((vMin && !isNumber(vMin)) || (vMax && !isNumber(vMax))) add(line.key, "volume");
    else if (vMin && vMax && Number(vMax) <= Number(vMin)) add(line.key, "volumeOrder");
    if (!MONEY.test(line.amount.trim())) add(line.key, "amount");
    if (line.perExtraKg.trim() && !MONEY.test(line.perExtraKg.trim())) add(line.key, "perExtraKg");
  }
  const clean = lines
    .filter((line) => !problems.has(line.key))
    .map((line) => ({ key: line.key, input: toInput(line) }));
  for (let i = 0; i < clean.length; i++) {
    for (let j = i + 1; j < clean.length; j++) {
      const a = clean[i]!.input;
      const b = clean[j]!.input;
      if (a.zoneId !== b.zoneId || a.postcode !== b.postcode) continue;
      const weight = overlaps(a.weightMinG, a.weightMaxG, b.weightMinG, b.weightMaxG);
      const volume = overlaps(a.volumeMinCm3 ?? 0, a.volumeMaxCm3, b.volumeMinCm3 ?? 0, b.volumeMaxCm3);
      if (weight && volume) {
        add(clean[i]!.key, "overlap");
        add(clean[j]!.key, "overlap");
      }
    }
  }
  return problems;
}

/** Lines in reading order: by zone, postcode override after the zone, then weight band. */
export function sortRates<T extends { zoneCode: string; postcode: string | null; weightMinG: number }>(
  rates: readonly T[],
) {
  return [...rates].sort(
    (a, b) =>
      a.zoneCode.localeCompare(b.zoneCode) ||
      (a.postcode ?? "").localeCompare(b.postcode ?? "") ||
      a.weightMinG - b.weightMinG,
  );
}

/** Today in Bangkok, `YYYY-MM-DD`. */
export { effectiveInstant, startOfDay, today } from "../console/dates";

export const STATUS_TONE: Record<VersionStatus, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral",
  proposed: "warning",
  pending_acceptance: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
};
