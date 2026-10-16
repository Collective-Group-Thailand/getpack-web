/**
 * Payment schedule templates (D-020) as an editable form: instalments that add up to 100 %, and
 * the selection rule packio-api understands (`orderValue`, `customerTypes`, `productTypeCodes`,
 * `creditApproved` — `schedule-math.ts`). An order-value bound is an amount or a setting's value
 * (`{ setting: "payments.schedule_split_threshold" }`), written here as `setting:<key>`.
 */

import type { Schemas } from "@/lib/api/types";

export type Instalment = Schemas["TemplateInstalmentDto"];
export type DueTrigger = Schemas["DueTrigger"];
export type RequiredBefore = Schemas["RequiredBefore"];
export type CustomerType = Schemas["CustomerType"];

export const DUE_TRIGGERS = [
  "at_checkout",
  "before_production",
  "before_shipping",
  "on_delivery",
  "days_after_delivery",
] as const satisfies readonly DueTrigger[];
export const REQUIRED_BEFORE = ["none", "production", "shipping"] as const satisfies readonly RequiredBefore[];
export const CUSTOMER_TYPES = ["individual", "juristic", "government"] as const satisfies readonly CustomerType[];

export interface EditableInstalment {
  key: string;
  labelTh: string;
  labelEn: string;
  pct: string;
  dueTrigger: DueTrigger;
  dueOffsetDays: string;
  requiredBefore: RequiredBefore;
}

export interface EditableRule {
  gte: string;
  lt: string;
  customerTypes: CustomerType[];
  productTypeCodes: string[];
  creditApproved: "any" | "yes" | "no";
}

let counter = 0;
const key = () => `inst-${(counter++).toString(36)}`;

export const emptyInstalment = (): EditableInstalment => ({
  key: key(),
  labelTh: "",
  labelEn: "",
  pct: "",
  dueTrigger: "at_checkout",
  dueOffsetDays: "",
  requiredBefore: "production",
});

export const toEditableInstalment = (instalment: Instalment): EditableInstalment => ({
  key: key(),
  labelTh: instalment.labelTh,
  labelEn: instalment.labelEn,
  pct: instalment.pct,
  dueTrigger: instalment.dueTrigger,
  dueOffsetDays:
    instalment.dueOffsetDays === null || instalment.dueOffsetDays === undefined ? "" : String(instalment.dueOffsetDays),
  requiredBefore: instalment.requiredBefore,
});

type Bound = string | { setting: string } | undefined;

const boundText = (bound: Bound) =>
  bound === undefined ? "" : typeof bound === "string" ? bound : `setting:${bound.setting}`;

const boundValue = (text: string): Bound => {
  const value = text.trim();
  if (!value) return undefined;
  return value.startsWith("setting:") ? { setting: value.slice("setting:".length).trim() } : value;
};

export function toEditableRule(rule: Record<string, unknown> | null): EditableRule {
  const r = (rule ?? {}) as {
    orderValue?: { gte?: Bound; lt?: Bound };
    customerTypes?: CustomerType[];
    productTypeCodes?: string[];
    creditApproved?: boolean;
  };
  return {
    gte: boundText(r.orderValue?.gte),
    lt: boundText(r.orderValue?.lt),
    customerTypes: r.customerTypes ?? [],
    productTypeCodes: r.productTypeCodes ?? [],
    creditApproved: r.creditApproved === undefined ? "any" : r.creditApproved ? "yes" : "no",
  };
}

export function toApiRule(rule: EditableRule): Record<string, unknown> {
  const gte = boundValue(rule.gte);
  const lt = boundValue(rule.lt);
  return {
    ...(gte !== undefined || lt !== undefined
      ? { orderValue: { ...(gte !== undefined ? { gte } : {}), ...(lt !== undefined ? { lt } : {}) } }
      : {}),
    ...(rule.customerTypes.length ? { customerTypes: rule.customerTypes } : {}),
    ...(rule.productTypeCodes.length ? { productTypeCodes: rule.productTypeCodes } : {}),
    ...(rule.creditApproved === "any" ? {} : { creditApproved: rule.creditApproved === "yes" }),
  };
}

const PCT = /^\d{1,3}(\.\d{1,4})?$/;
const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const SETTING = /^setting:[a-z][a-z0-9_.]+$/;

export type ScheduleProblem = "label" | "pct" | "total" | "offset" | "bound" | "none";

/** What stops the version being sent; `total` carries the sum in basis points ÷ 100. */
export function checkSchedule(
  instalments: readonly EditableInstalment[],
  rule: EditableRule,
): { problems: ScheduleProblem[]; total: number } {
  const problems = new Set<ScheduleProblem>();
  if (instalments.length === 0) problems.add("none");
  let cents = 0;
  for (const instalment of instalments) {
    if (!instalment.labelTh.trim() || !instalment.labelEn.trim()) problems.add("label");
    if (!PCT.test(instalment.pct.trim())) problems.add("pct");
    else cents += Math.round(Number(instalment.pct) * 10_000);
    if (instalment.dueTrigger === "days_after_delivery" && !/^\d{1,3}$/.test(instalment.dueOffsetDays.trim())) {
      problems.add("offset");
    }
  }
  if (cents !== 1_000_000) problems.add("total");
  for (const bound of [rule.gte, rule.lt]) {
    const value = bound.trim();
    if (value && !AMOUNT.test(value) && !SETTING.test(value)) problems.add("bound");
  }
  return { problems: [...problems], total: cents / 10_000 };
}

export function toApiInstalments(instalments: readonly EditableInstalment[]): Instalment[] {
  return instalments.map((instalment) => ({
    labelTh: instalment.labelTh.trim(),
    labelEn: instalment.labelEn.trim(),
    pct: instalment.pct.trim(),
    dueTrigger: instalment.dueTrigger,
    dueOffsetDays: instalment.dueTrigger === "days_after_delivery" ? Number(instalment.dueOffsetDays) : null,
    requiredBefore: instalment.requiredBefore,
  }));
}
