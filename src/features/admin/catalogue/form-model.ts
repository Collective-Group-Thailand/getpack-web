/**
 * A table's form, derived from its declaration: the zod schema the sheet validates with, the
 * empty values, a row turned into form values, and form values turned back into the body the
 * contract takes. Pure functions, so they are testable without rendering.
 *
 * Conventions the contract sets (api-conventions §3): optional text is `null` when empty, never
 * `""`; a JSON field is an object; a date-time is ISO with the Bangkok offset; an update sends
 * only what the update DTO accepts.
 */

import { z } from "zod";

import type { CatalogueRow } from "./api";
import { kindOf, type TableDef } from "./tables";

export type FormValues = Record<string, unknown>;

/** What a select sends for "none" on a nullable reference or enum (Radix Select cannot hold ""). */
export const NONE = "__none";

/** Optional numbers the DTOs do not allow to be `null`: left out when empty. */
const NON_NULL_NUMBERS = new Set(["sort", "minOrderQty"]);

/** `2026-10-01T00:00:00+07:00` → `2026-10-01T00:00`, the `datetime-local` form. */
export function toLocalInput(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(Date.parse(value) + 7 * 3_600_000);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

export function buildSchema(def: TableDef) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of def.fields) {
    const required = def.required.includes(field);
    const kind = kindOf(def, field).kind;
    switch (kind) {
      case "number":
        shape[field] = required ? z.number({ message: "required" }) : z.number().nullable().optional();
        break;
      case "switch":
        shape[field] = z.boolean().optional();
        break;
      case "json":
        shape[field] = z
          .string()
          .optional()
          .refine(
            (text) => {
              if (!text?.trim()) return !required;
              try {
                const parsed: unknown = JSON.parse(text);
                return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
              } catch {
                return false;
              }
            },
            { message: "json" },
          );
        break;
      default:
        shape[field] = required ? z.string().trim().min(1, "required") : z.string().nullable().optional();
    }
  }
  return z.object(shape);
}

export function emptyValues(def: TableDef): FormValues {
  return Object.fromEntries(
    def.fields.map((field) => {
      const kind = kindOf(def, field).kind;
      if (field === "status" && def.status) return [field, def.status === "ContentStatus" ? "draft" : "active"];
      if (kind === "switch") return [field, false];
      if (kind === "number") return [field, field === "sort" ? 0 : null];
      if (kind === "json") return [field, ""];
      return [field, ""];
    }),
  );
}

export function toValues(def: TableDef, row: CatalogueRow): FormValues {
  return Object.fromEntries(
    def.fields.map((field) => {
      const value = row[field];
      switch (kindOf(def, field).kind) {
        case "json":
          return [field, value && typeof value === "object" ? JSON.stringify(value, null, 2) : ""];
        case "datetime":
          return [field, toLocalInput(value)];
        case "switch":
          return [field, Boolean(value)];
        case "number":
          return [field, typeof value === "number" ? value : null];
        default:
          return [field, value === null || value === undefined ? "" : String(value)];
      }
    }),
  );
}

export function toBody(def: TableDef, values: FormValues, mode: "create" | "update"): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (mode === "update" && def.createOnly.includes(field)) continue;
    const value = values[field];
    switch (kindOf(def, field).kind) {
      case "json": {
        const text = typeof value === "string" ? value.trim() : "";
        body[field] = text ? (JSON.parse(text) as unknown) : field === "rfqSpecSchema" ? null : {};
        break;
      }
      case "datetime":
        body[field] = typeof value === "string" && value ? `${value}:00+07:00` : null;
        break;
      case "switch":
        body[field] = Boolean(value);
        break;
      case "number":
        body[field] = typeof value === "number" && !Number.isNaN(value) ? value : null;
        if (body[field] === null && NON_NULL_NUMBERS.has(field)) delete body[field];
        break;
      case "enum":
        // An enum is either chosen or left out; the DTOs never take `null` for one.
        if (value === NONE) body[field] = null;
        else if (typeof value === "string" && value) body[field] = value;
        break;
      default: {
        const text = typeof value === "string" ? value.trim() : value;
        body[field] = text === "" || text === undefined || text === NONE ? null : text;
      }
    }
    // A required field is never sent as null; the schema has already refused it empty.
    if (body[field] === null && def.required.includes(field)) delete body[field];
  }
  return body;
}
