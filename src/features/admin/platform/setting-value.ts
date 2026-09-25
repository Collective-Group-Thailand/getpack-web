/**
 * An effective-dated setting's value, by its declared `valueType` (ADR-0005, `SettingValueType`).
 *
 * The API types every value; the UI's job is to show it the way the business reads it and to
 * turn what someone typed back into exactly the JSON the API validates — money and percentages
 * as decimal strings, integers as numbers, windows and JSON as objects. Nothing here rounds or
 * computes: a value is parsed, checked for shape, and sent.
 */

import type { BoundFormat } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";

export type Setting = Schemas["SettingDto"];
export type SettingDetail = Schemas["SettingDetailDto"];
export type ValueType = Schemas["SettingValueType"];
export type SettingValue = Schemas["SettingValueVersionDto"]["value"];

const DECIMAL = /^-?\d+(\.\d+)?$/;
const MONEY = /^-?\d+(\.\d{1,2})?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The first segment of a key — `pricing.margin_floor_pct` → `pricing` — for grouping. */
export function settingGroup(key: string): string {
  return key.split(".")[0] ?? key;
}

/** A value as text, for a table cell or a confirmation sentence. `null` means masked or unset. */
export function describeValue(
  value: SettingValue | null | undefined,
  type: ValueType,
  format: BoundFormat,
): string | null {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "money":
      return typeof value === "string" ? format.thb(value) : String(value);
    case "percent":
      return typeof value === "string" || typeof value === "number" ? format.percent(String(value)) : String(value);
    case "integer":
      return typeof value === "number" ? format.number(value) : String(value);
    case "boolean":
      return value ? "✓" : "✗";
    case "time_of_day_window": {
      const window = value as { from?: string; to?: string };
      return `${window.from ?? "?"}–${window.to ?? "?"}`;
    }
    case "json":
      return JSON.stringify(value);
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

/** What the editor holds while someone types: always text, converted on submit. */
export function toDraft(value: SettingValue | null | undefined, type: ValueType): string {
  if (value === null || value === undefined) return type === "boolean" ? "false" : "";
  if (type === "json" || type === "time_of_day_window") return JSON.stringify(value, null, 2);
  return String(value);
}

export type ParseResult = { ok: true; value: SettingValue } | { ok: false; error: "required" | "format" | "json" };

/**
 * Text → the value the API expects for this type. The API validates again (422 with a field
 * error); this exists so an obviously malformed value is caught before a confirmation dialog
 * restates it to someone.
 */
export function parseDraft(draft: string, type: ValueType): ParseResult {
  const text = draft.trim();
  if (type !== "boolean" && text === "") return { ok: false, error: "required" };
  switch (type) {
    case "integer":
      return /^-?\d+$/.test(text) ? { ok: true, value: Number(text) } : { ok: false, error: "format" };
    case "decimal":
    case "percent":
      return DECIMAL.test(text) ? { ok: true, value: text } : { ok: false, error: "format" };
    case "money":
      // Normalised to two decimals as text — "20000" becomes "20000.00", never via a float.
      if (!MONEY.test(text)) return { ok: false, error: "format" };
      {
        const [whole, fraction = ""] = text.split(".");
        return { ok: true, value: `${whole}.${fraction.padEnd(2, "0")}` };
      }
    case "boolean":
      return { ok: true, value: text === "true" };
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? { ok: true, value: text } : { ok: false, error: "format" };
    case "time_of_day_window":
    case "json": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, error: "json" };
      }
      if (type === "time_of_day_window") {
        const window = parsed as { from?: unknown; to?: unknown };
        if (
          typeof window !== "object" ||
          window === null ||
          !TIME.test(String(window.from)) ||
          !TIME.test(String(window.to))
        ) {
          return { ok: false, error: "format" };
        }
      }
      return { ok: true, value: parsed as SettingValue };
    }
    default:
      return { ok: true, value: text };
  }
}
