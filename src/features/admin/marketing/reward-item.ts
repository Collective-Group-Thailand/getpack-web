/**
 * Loyalty P3 (D-498): the reward catalogue editor's draft and how it becomes `admin.rewardCatalog.create` / `update`'s
 * body. Numbers stay as typed text until the save; the API validates again (422 `cap_floor`, `kind_mismatch`,
 * `unknown_addon`; 409 `rewards.code_taken`, `rewards.item_active`). The web checks only what a form must (filled,
 * ranges, the code's shape) and never works out the cash-off floor — it is the API's rule, shown as a hint.
 */

import type { BenefitV2, RewardCatalogInput, RewardCatalogItem } from "@/lib/api/requests/admin-loyalty-p3";
import type { LoyaltyTierP3, RewardKind } from "@/lib/api/requests/store-loyalty-p3";

import { bangkokDayOf, bangkokMidnight } from "./time";

export const REWARD_KINDS_ORDER: readonly RewardKind[] = [
  "cash_off",
  "free_shipping",
  "free_sample",
  "free_rush",
  "free_addon",
  "revision_round",
];
export const REWARD_TIERS: readonly LoyaltyTierP3[] = ["silver", "gold", "platinum"];

export interface RewardDraft {
  code: string;
  kind: RewardKind;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
  descriptionEn: string;
  costPoints: string;
  /** `cash_off`: the discount. */
  amount: string;
  /** `free_shipping` (optional), `free_sample`, `free_addon`. */
  maxAmount: string;
  addonCode: string;
  daysSaved: string;
  rounds: string;
  minOrderValue: string;
  productTypeCodes: string[];
  perUserEveryMonths: string;
  tierRequired: LoyaltyTierP3 | "";
  validityDays: string;
  activeFrom: string;
  activeTo: string;
  sortOrder: string;
}

export const blankRewardDraft = (): RewardDraft => ({
  code: "",
  kind: "cash_off",
  nameTh: "",
  nameEn: "",
  descriptionTh: "",
  descriptionEn: "",
  costPoints: "",
  amount: "",
  maxAmount: "",
  addonCode: "",
  daysSaved: "2",
  rounds: "1",
  minOrderValue: "",
  productTypeCodes: [],
  perUserEveryMonths: "",
  tierRequired: "",
  validityDays: "90",
  activeFrom: "",
  activeTo: "",
  sortOrder: "100",
});

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export function rewardDraftOf(item: RewardCatalogItem): RewardDraft {
  const value = item.value;
  return {
    code: item.code,
    kind: item.kind,
    nameTh: item.name.th,
    nameEn: item.name.en,
    descriptionTh: item.description?.th ?? "",
    descriptionEn: item.description?.en ?? "",
    costPoints: text(item.costPoints),
    amount: value.type === "fixed" ? value.amount : "",
    maxAmount: "maxAmount" in value ? text(value.maxAmount) : "",
    addonCode: value.type === "free_addon" ? value.addonCode : "",
    daysSaved: value.type === "free_rush" ? text(value.daysSaved) : "2",
    rounds: value.type === "revision_round" ? text(value.rounds) : "1",
    minOrderValue: text(item.constraints.minOrderValue),
    productTypeCodes: item.constraints.productTypeCodes ?? [],
    perUserEveryMonths: text(item.constraints.perUserEveryMonths),
    tierRequired: item.tierRequired ?? "",
    validityDays: text(item.validityDays),
    activeFrom: bangkokDayOf(item.activeFrom),
    activeTo: bangkokDayOf(item.activeTo),
    sortOrder: text(item.sortOrder),
  };
}

const filled = (value: string) => value.trim() !== "";
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const money = (value: string) => (filled(value) && MONEY.test(value.trim()) ? Number(value).toFixed(2) : null);
const int = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);
const between = (value: string, min: number, max: number) => {
  const number = int(value);
  return number !== null && number >= min && number <= max;
};

export type RewardDraftProblem =
  | "code"
  | "nameTh"
  | "nameEn"
  | "costPoints"
  | "amount"
  | "maxAmount"
  | "addonCode"
  | "daysSaved"
  | "rounds"
  | "minOrderValue"
  | "perUserEveryMonths"
  | "validityDays"
  | "window"
  | "sortOrder";

/** What the form refuses before asking the API: empty required fields and values out of range. */
export function rewardDraftProblems(draft: RewardDraft): RewardDraftProblem[] {
  const problems: RewardDraftProblem[] = [];
  if (!/^[a-z0-9_]{3,40}$/.test(draft.code)) problems.push("code");
  if (!draft.nameTh.trim()) problems.push("nameTh");
  if (!draft.nameEn.trim()) problems.push("nameEn");
  if (!between(draft.costPoints, 1, 100_000)) problems.push("costPoints");
  if (draft.kind === "cash_off" && (money(draft.amount) === null || Number(draft.amount) <= 0)) problems.push("amount");
  if (filled(draft.maxAmount) && money(draft.maxAmount) === null) problems.push("maxAmount");
  if (draft.kind === "free_sample" && money(draft.maxAmount) === null) problems.push("maxAmount");
  if (draft.kind === "free_addon" && !/^[a-z0-9_]{2,40}$/.test(draft.addonCode)) problems.push("addonCode");
  if (draft.kind === "free_rush" && !between(draft.daysSaved, 1, 5)) problems.push("daysSaved");
  if (draft.kind === "revision_round" && !between(draft.rounds, 1, 3)) problems.push("rounds");
  // A cash-off item needs a minimum order (the API checks the D-133 floor).
  if (
    draft.kind === "cash_off"
      ? money(draft.minOrderValue) === null
      : filled(draft.minOrderValue) && money(draft.minOrderValue) === null
  )
    problems.push("minOrderValue");
  if (filled(draft.perUserEveryMonths) && !between(draft.perUserEveryMonths, 1, 24))
    problems.push("perUserEveryMonths");
  if (!between(draft.validityDays, 7, 365)) problems.push("validityDays");
  if (draft.activeFrom && draft.activeTo && draft.activeTo <= draft.activeFrom) problems.push("window");
  if (!between(draft.sortOrder, 0, 9999)) problems.push("sortOrder");
  return problems;
}

/** The benefit v2 of the item's kind (`cash_off` → `fixed`). */
export function rewardValueOf(draft: RewardDraft): BenefitV2 {
  const cap = money(draft.maxAmount);
  switch (draft.kind) {
    case "cash_off":
      return { type: "fixed", amount: money(draft.amount) ?? "0.00" };
    case "free_shipping":
      return { type: "free_shipping", ...(cap ? { maxAmount: cap } : {}) };
    case "free_sample":
      return { type: "free_sample", ...(cap ? { maxAmount: cap } : {}) };
    case "free_rush":
      return { type: "free_rush", daysSaved: int(draft.daysSaved) ?? 1 };
    case "free_addon":
      return { type: "free_addon", addonCode: draft.addonCode.trim(), ...(cap ? { maxAmount: cap } : {}) };
    case "revision_round":
      return { type: "revision_round", rounds: int(draft.rounds) ?? 1 };
  }
}

export function rewardInputOf(draft: RewardDraft): RewardCatalogInput {
  const description =
    draft.descriptionTh.trim() || draft.descriptionEn.trim()
      ? { th: draft.descriptionTh.trim(), en: draft.descriptionEn.trim() }
      : null;
  return {
    code: draft.code.trim(),
    kind: draft.kind,
    name: { th: draft.nameTh.trim(), en: draft.nameEn.trim() },
    description,
    costPoints: int(draft.costPoints) ?? 0,
    value: rewardValueOf(draft),
    constraints: {
      minOrderValue: money(draft.minOrderValue),
      productTypeCodes: draft.productTypeCodes.length ? [...draft.productTypeCodes] : null,
      perUserEveryMonths: int(draft.perUserEveryMonths),
    },
    tierRequired: draft.tierRequired || null,
    validityDays: int(draft.validityDays) ?? 90,
    activeFrom: draft.activeFrom ? bangkokMidnight(draft.activeFrom) : null,
    activeTo: draft.activeTo ? bangkokMidnight(draft.activeTo, true) : null,
    sortOrder: int(draft.sortOrder) ?? 0,
  };
}

/** The API's field path (`value.addonCode`, `constraints.minOrderValue`) as the form field it lands on. */
export function draftFieldOfPath(path: string): RewardDraftProblem | null {
  const map: Record<string, RewardDraftProblem> = {
    code: "code",
    "name.th": "nameTh",
    "name.en": "nameEn",
    costPoints: "costPoints",
    "value.amount": "amount",
    "value.maxAmount": "maxAmount",
    "value.addonCode": "addonCode",
    "value.daysSaved": "daysSaved",
    "value.rounds": "rounds",
    "constraints.minOrderValue": "minOrderValue",
    "constraints.perUserEveryMonths": "perUserEveryMonths",
    validityDays: "validityDays",
    activeTo: "window",
    sortOrder: "sortOrder",
  };
  return map[path] ?? null;
}

/** Which lifecycle actions an item in this status offers (activate | pause | archive), in the order shown. */
export function rewardActionsOf(status: RewardCatalogItem["status"]): ("activate" | "pause" | "archive")[] {
  switch (status) {
    case "draft":
      return ["activate", "archive"];
    case "active":
      return ["pause", "archive"];
    case "paused":
      return ["activate", "archive"];
    case "archived":
      return [];
  }
}
