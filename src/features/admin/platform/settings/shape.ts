/**
 * How a setting's value is edited (G5): the shape of the value decides the editor, the key's own
 * words decide the unit. Nothing here invents a value — a shape the editor can't hold safely
 * (lists of records, deep nesting, an unset JSON value) goes to the raw JSON editor instead.
 */

import type { Setting, SettingValue, ValueType } from "../setting-value";

export type Unit =
  | "days"
  | "businessDays"
  | "hours"
  | "businessHours"
  | "minutes"
  | "seconds"
  | "months"
  | "years"
  | "pct"
  | "baht"
  | "usd"
  | "mm"
  | "perHour";

/** The unit a key or field name states in its own words (`…_business_days`, `lockMinutes`). */
export function unitOf(name: string): Unit | null {
  const n = name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  // A day of the month is a date, not a span of months; "per day" and "per minute" are rates, not spans.
  if (/day_of_(next_)?month$/.test(n)) return null;
  if (/(^|_)per_(day|minute|month|session|cart|company)$/.test(n)) return null;
  // A band named by its span ("up_to_30_days", "over_90_days") holds a factor, not a number of days.
  if (/(^|_)\d+_(days?|hours?|months?)$/.test(n)) return null;
  const rules: [RegExp, Unit][] = [
    [/business_days?(_|$)/, "businessDays"],
    [/business_hours?(_|$)/, "businessHours"],
    [/(^|_)per_(ip_|phone_|device_|customer_)?(per_)?hour$/, "perHour"],
    [/(^|_)days?(_overdue|_before(_due)?)?$/, "days"],
    [/(^|_)hours?$/, "hours"],
    [/(^|_)minutes?(_to_cart)?$/, "minutes"],
    [/(^|_)seconds?$/, "seconds"],
    [/(^|_)months?(_per_earning)?$/, "months"],
    [/(^|_)years?$/, "years"],
    [/(^|_)pct(_of_.*|_of_order)?$/, "pct"],
    [/(^|_)(baht|amount)$/, "baht"],
    [/(^|_)usd$/, "usd"],
    [/(^|_)mm$/, "mm"],
  ];
  for (const [re, unit] of rules) if (re.test(n)) return unit;
  return null;
}

/** The section of the settings page a key belongs to, by its first segment. */
export const AREAS = {
  sales: [
    "pricing",
    "quotes",
    "discounts",
    "promotions",
    "campaigns",
    "samples",
    "calloff",
    "reorder",
    "configurations",
    "b2b",
    "agents",
  ],
  loyalty: ["loyalty", "referral"],
  storefront: ["storefront", "catalog", "studio", "styles", "design", "artwork", "dielines", "advisory"],
  operations: ["orders", "production", "partners", "trust", "qc", "fulfilment", "tooling", "rfq", "claims", "shipping"],
  money: ["payments", "payouts", "receivables", "banking"],
  accounting: ["tax", "e_tax", "close", "fixed_assets", "documents", "audit"],
  entity: ["entity"],
  service: ["support", "conversations", "notifications", "privacy", "calendar"],
  platform: ["auth", "api", "approvals", "assistant", "ops", "analytics"],
} as const satisfies Record<string, readonly string[]>;

export type Area = keyof typeof AREAS | "other";
export const AREA_ORDER: Area[] = [...(Object.keys(AREAS) as (keyof typeof AREAS)[]), "other"];

export function areaOf(key: string): Area {
  const head = key.split(".")[0] ?? key;
  for (const area of Object.keys(AREAS) as (keyof typeof AREAS)[])
    if ((AREAS[area] as readonly string[]).includes(head)) return area;
  return "other";
}

/** Choices of the `enum` settings — the API's typed values (`setting-keys.ts`); the API sends no list (gap). */
export const ENUMS: Record<string, readonly string[]> = {
  "e_tax.subject_date_format": ["DDMMBBBB", "DDMMYYYY", "YYYYMMDD"],
  "tax.rounding_mode": ["line", "document"],
  "fixed_assets.depreciation_start": ["acquisition_month", "next_month"],
  "payouts.balance_trigger": ["after_pod_and_claim_window", "after_pod", "immediate"],
};

/** Text fields inside a JSON setting whose values are one of a fixed set. */
export const LEAF_ENUMS: Record<string, readonly string[]> = {
  "tax.nature_by_product_type": ["sale_of_goods", "hire_of_work"],
};

/** Choice words that read the same in any setting's value (a status, a severity, a time of day). */
export const COMMON_CHOICES: readonly string[] = [
  "daily",
  "live",
  "soon",
  "in_development",
  "warn",
  "block",
  "info",
  "morning",
  "midday",
  "afternoon",
];

/** True when a stored value says this word as one of its choices — not a code that happens to share a name. */
export function isChoice(settingKey: string, value: string): boolean {
  return (
    COMMON_CHOICES.includes(value) ||
    (ENUMS[settingKey]?.includes(value) ?? false) ||
    (LEAF_ENUMS[settingKey]?.includes(value) ?? false)
  );
}

/** A value too broad for the field column — a list of records, or a structure inside a structure: read full width. */
export function wideValue(value: unknown, depth = 0): boolean {
  if (Array.isArray(value)) return value.some((item) => typeof item === "object" && item !== null);
  if (typeof value === "object" && value !== null)
    return Object.values(value).some((child) =>
      Array.isArray(child)
        ? wideValue(child, depth + 1)
        : typeof child === "object" && child !== null
          ? depth >= 1 || wideValue(child, depth + 1)
          : false,
    );
  return false;
}

export type Leaf =
  | { kind: "integer" }
  | { kind: "number" }
  | { kind: "decimal"; money?: boolean }
  | { kind: "boolean" }
  | { kind: "time" }
  | { kind: "date" }
  | { kind: "text"; long: boolean }
  | { kind: "enum"; options: readonly string[] };

const DECIMAL = /^-?\d+(\.\d+)?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The leaf editor for a scalar inside a JSON value: its JS type is kept exactly (a number stays a number). */
export function leafOf(value: unknown, settingKey: string): Leaf | null {
  if (typeof value === "boolean") return { kind: "boolean" };
  if (typeof value === "number") return Number.isInteger(value) ? { kind: "integer" } : { kind: "number" };
  if (typeof value === "string") {
    const options = LEAF_ENUMS[settingKey];
    if (options?.includes(value)) return { kind: "enum", options };
    if (DECIMAL.test(value)) return { kind: "decimal" };
    if (TIME.test(value)) return { kind: "time" };
    return { kind: "text", long: value.length > 80 || value.includes("\n") };
  }
  return null;
}

/** The leaf editor of a whole scalar setting, from its declared type. */
export function topLeaf(setting: Pick<Setting, "key" | "valueType">, value: unknown): Leaf | null {
  switch (setting.valueType as ValueType) {
    case "integer":
      return { kind: "integer" };
    case "decimal":
    case "percent":
      return { kind: "decimal" };
    case "money":
      return { kind: "decimal", money: true };
    case "boolean":
      return { kind: "boolean" };
    case "date":
      return { kind: "date" };
    case "enum": {
      const options = ENUMS[setting.key];
      return options ? { kind: "enum", options } : { kind: "text", long: false };
    }
    case "string":
    case "duration":
      return { kind: "text", long: typeof value === "string" && (value.length > 80 || value.includes("\n")) };
    default:
      return null;
  }
}

const isScalar = (v: unknown) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";
const isScalarList = (v: unknown): v is (string | number)[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number") && v.length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * True when the typed editor can hold this value: a scalar, a list of numbers or texts, or an
 * object (two levels at most) of those. An empty object or list says nothing of its items' shape,
 * so it isn't one.
 */
export function editableShape(value: unknown, depth = 0): boolean {
  if (isScalar(value)) return true;
  if (isScalarList(value)) return new Set(value.map((x) => typeof x)).size === 1;
  if (isRecord(value)) {
    const entries = Object.values(value);
    return depth < 2 && entries.length > 0 && entries.every((v) => editableShape(v, depth + 1));
  }
  return false;
}

/** How a setting is edited: a typed field, a structure of typed fields, or (unknown shape) raw JSON. */
export function editorOf(setting: Pick<Setting, "key" | "valueType">, value: SettingValue | null | undefined) {
  if (setting.valueType === "time_of_day_window") return "window" as const;
  if (setting.valueType === "json")
    return value !== null && value !== undefined && editableShape(value) ? "shape" : "json";
  return topLeaf(setting, value) ? "leaf" : "json";
}

/** A copy of `root` with the value at `path` replaced. */
export function setAt(root: unknown, path: readonly (string | number)[], next: unknown): unknown {
  if (path.length === 0) return next;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setAt(copy[head as number], rest, next);
    return copy;
  }
  const record = isRecord(root) ? root : {};
  return { ...record, [head as string]: setAt(record[head as string], rest, next) };
}

/** Text in an input → the leaf's value, or `undefined` when it isn't one. */
export function parseLeaf(text: string, leaf: Leaf): unknown {
  const t = text.trim();
  switch (leaf.kind) {
    case "integer":
      return /^-?\d+$/.test(t) ? Number(t) : undefined;
    case "number":
      return DECIMAL.test(t) ? Number(t) : undefined;
    case "decimal":
      if (leaf.money) {
        if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return undefined;
        const [whole, fraction = ""] = t.split(".");
        return `${whole}.${fraction.padEnd(2, "0")}`;
      }
      return DECIMAL.test(t) ? t : undefined;
    case "time":
      return TIME.test(t) ? t : undefined;
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
    case "text":
      return t === "" ? undefined : text;
    default:
      return t;
  }
}

export const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Strips decision references and document pointers from the API's English description (shown only as a fallback). */
export function plainDescription(text: string): string {
  return (
    text
      .replace(/\b(D|ADR)-\d+\b\s*(\/\s*)?/g, "")
      // Pointers into the design documents ("accounting-design.md §2", "design §2 ⚖").
      .replace(/[\w-]*design(\.md)?\s*§\s*[\d.]+\s*(⚖\s*)?/g, "")
      .replace(/\(\s*(;|⚖)\s*/g, "(")
      .replace(/\(\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}
