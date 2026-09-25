import { describe, expect, it } from "vitest";

import { loadAllMessages } from "@/i18n/messages";

import { buildSchema, emptyValues, NONE, toBody, toValues } from "./form-model";
import { ENUMS, kindOf, TABLES, tableByKey } from "./tables";

type Tree = Record<string, unknown>;
const read = (tree: Tree, path: string) =>
  path
    .split(".")
    .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Tree)[key] : undefined), tree);

describe("the catalogue table registry", () => {
  it("labels every table, field and enum value it renders, in both locales", async () => {
    // The labels are looked up by template key (`fields.${field}`), which the keys-used gate
    // can only check by prefix — so this checks the registry against the messages directly.
    for (const locale of ["th", "en"] as const) {
      const messages = ((await loadAllMessages(locale)) as Tree).catalogue as Tree;
      const missing: string[] = [];
      for (const def of TABLES) {
        for (const key of ["title", "description"]) {
          if (typeof read(messages, `tables.${def.key}.${key}`) !== "string") missing.push(`tables.${def.key}.${key}`);
        }
        for (const field of new Set([...def.columns, ...def.fields, ...def.filters])) {
          if (typeof read(messages, `fields.${field}`) !== "string") missing.push(`fields.${field}`);
          const kind = kindOf(def, field);
          if (kind.kind === "enum") {
            for (const value of ENUMS[kind.enum]) {
              if (typeof read(messages, `enums.${kind.enum}.${value}`) !== "string")
                missing.push(`enums.${kind.enum}.${value}`);
            }
          }
          if (kind.kind === "ref" && !tableByKey(kind.table)) missing.push(`ref ${def.key}.${field} → ${kind.table}`);
        }
      }
      expect(missing, locale).toEqual([]);
    }
  });

  it("has unique keys and only requires fields it has", () => {
    expect(new Set(TABLES.map((def) => def.key)).size).toBe(TABLES.length);
    for (const def of TABLES) {
      for (const field of def.required) expect(def.fields, def.key).toContain(field);
    }
  });
});

describe("the form model", () => {
  const materials = tableByKey("materials")!;
  const banners = tableByKey("banners")!;
  const types = tableByKey("product-types")!;

  it("sends null for cleared optional text and refs, never an empty string", () => {
    const body = toBody(
      materials,
      {
        ...emptyValues(materials),
        code: "art-300",
        kind: "paper",
        nameTh: "อาร์ต",
        nameEn: "Art",
        familyId: NONE,
        paperGroup: "",
      },
      "create",
    );
    expect(body).toMatchObject({ code: "art-300", kind: "paper", familyId: null, paperGroup: null, gsm: null });
    expect(body.status).toBe("active");
  });

  it("round-trips a date-time through Bangkok wall-clock time", () => {
    const values = toValues(banners, { id: "b", validFrom: "2026-10-01T00:00:00+07:00" } as never);
    expect(values.validFrom).toBe("2026-10-01T00:00");
    expect(toBody(banners, values, "update").validFrom).toBe("2026-10-01T00:00:00+07:00");
  });

  it("leaves create-only fields out of an update", () => {
    const values = { ...emptyValues(types), code: "tube", nameTh: "ท่อ", nameEn: "Tube", categoryId: "c" };
    expect(toBody(types, values, "create")).toHaveProperty("code", "tube");
    expect(toBody(types, values, "update")).not.toHaveProperty("code");
  });

  it("parses a JSON field and refuses one that is not an object", () => {
    const schema = buildSchema(types);
    const base = { ...emptyValues(types), code: "x", nameTh: "x", nameEn: "x", categoryId: "c" };
    expect(schema.safeParse({ ...base, rfqSpecSchema: '{"type":"object"}' }).success).toBe(true);
    expect(schema.safeParse({ ...base, rfqSpecSchema: "[1,2]" }).success).toBe(false);
    expect(toBody(types, { ...base, rfqSpecSchema: '{"type":"object"}' }, "create").rfqSpecSchema).toEqual({
      type: "object",
    });
  });
});
