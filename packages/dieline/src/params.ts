import type { Issue, Localized, ParamSchema, ParamValue, ParamValues } from "./types";

/** Reads a number parameter; a missing or non-numeric value falls back. */
export function num(v: ParamValues, key: string, fallback: number): number {
  const raw = v[key];
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

export function str(v: ParamValues, key: string, fallback: string): string {
  const raw = v[key];
  return typeof raw === "string" && raw !== "" ? raw : fallback;
}

export function bool(v: ParamValues, key: string, fallback: boolean): boolean {
  const raw = v[key];
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

/** Whether a parameter applies given the others (its `when` condition). */
export function isActive(p: ParamSchema, v: ParamValues): boolean {
  if (!p.when) return true;
  return p.when.in.includes(v[p.when.key] as ParamValue);
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export const issue = (
  code: string,
  message: Localized,
  param?: string,
  severity: Issue["severity"] = "error",
): Issue => ({
  code,
  severity,
  param,
  message,
});

/**
 * Checks values against a schema: numbers present and within min/max, enums one of their
 * options. Styles add their own geometric rules on top.
 */
export function schemaIssues(params: ParamSchema[], v: ParamValues): Issue[] {
  const out: Issue[] = [];
  for (const p of params) {
    if (!isActive(p, v)) continue;
    const raw = v[p.key];
    if (p.kind === "enum") {
      if (raw === undefined) continue;
      if (!p.options?.some((o) => o.value === raw)) {
        out.push(
          issue(
            "param.invalid_option",
            {
              th: `ค่า "${String(raw)}" ใช้กับ${p.label.th}ไม่ได้`,
              en: `"${String(raw)}" is not a valid ${p.label.en.toLowerCase()}`,
            },
            p.key,
          ),
        );
      }
      continue;
    }
    if (p.kind === "boolean") continue;
    if (raw === undefined) continue;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      out.push(
        issue("param.not_a_number", { th: `${p.label.th}ต้องเป็นตัวเลข`, en: `${p.label.en} must be a number` }, p.key),
      );
      continue;
    }
    const unit =
      p.kind === "angle" ? { th: "°", en: "°" } : p.kind === "length" ? { th: " มม.", en: " mm" } : { th: "", en: "" };
    if (p.min !== undefined && value < p.min) {
      out.push(
        issue(
          "size.out_of_range",
          {
            th: `${p.label.th}ต้องไม่น้อยกว่า ${fmt(p.min)}${unit.th}`,
            en: `${p.label.en} must be at least ${fmt(p.min)}${unit.en}`,
          },
          p.key,
        ),
      );
    }
    if (p.max !== undefined && value > p.max) {
      out.push(
        issue(
          "size.out_of_range",
          {
            th: `${p.label.th}ต้องไม่เกิน ${fmt(p.max)}${unit.th}`,
            en: `${p.label.en} must be at most ${fmt(p.max)}${unit.en}`,
          },
          p.key,
        ),
      );
    }
  }
  return out;
}

/** Defaults under the given values: what `build` actually uses. */
export function withDefaults(defaults: ParamValues, v: ParamValues): ParamValues {
  const out: ParamValues = { ...defaults };
  for (const [k, value] of Object.entries(v)) if (value !== undefined && value !== null && value !== "") out[k] = value;
  return out;
}

export { fmt as formatMm };
