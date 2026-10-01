/**
 * The D-100 product types every mock refers to (orders, quotations, RFQs), typed by `Schemas`;
 * `./catalogue.ts` serves them with the rest of the published catalogue.
 *
 * The 14 types are the backend's own seed (`prisma/seed/data/catalog.ts`, D-100), copied into
 * `./fixtures/product-types.json`. The backend seeds every type as `rfq` until its calculator
 * ships (schema-design A-16); this mock shows the seven calculator types as `instant`, the state
 * the CS desk of 2.2 already assumes.
 */

import type { Schemas } from "@/lib/api/types";

import { mockId } from "../support";
import productTypeSeeds from "./fixtures/product-types.json";

type ProductType = Schemas["ProductTypeDto"];

const UPDATED = "2026-09-25T10:00:00+07:00";

/** A category's RFQ form, as the backend stores it (`product_types.rfq_spec_schema`, B2.5). */
function specSchema(code: string): Record<string, unknown> | null {
  const fields: Record<string, [string, string][]> = {
    rigid_box: [
      ["boardThickness", "ความหนาจั่วปัง"],
      ["wrapPaper", "กระดาษหุ้ม"],
      ["closure", "รูปแบบการปิด"],
      ["insert", "ถาดรองด้านใน"],
    ],
    paper_bag: [
      ["paper", "กระดาษ"],
      ["handle", "หูหิ้ว"],
      ["gusset", "ความกว้างข้าง"],
    ],
    food_packaging: [
      ["material", "วัสดุ"],
      ["foodContact", "สัมผัสอาหารโดยตรง"],
      ["coating", "การเคลือบกันซึม"],
    ],
    tube: [
      ["diameter", "เส้นผ่านศูนย์กลาง"],
      ["lid", "ฝา"],
    ],
    custom_tape: [
      ["tapeWidth", "หน้ากว้างเทป"],
      ["rollLength", "ความยาวต่อม้วน"],
      ["colours", "จำนวนสี"],
    ],
    pop_display: [
      ["displayType", "รูปแบบชั้นวาง"],
      ["shelves", "จำนวนชั้น"],
      ["loadKg", "น้ำหนักรับได้"],
    ],
    other: [["description", "รายละเอียด"]],
  };
  const list = fields[code];
  if (!list) return null;
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: Object.fromEntries(list.map(([key, title]) => [key, { type: "string", title }])),
  };
}

/** The contract's own examples point at these two ids (patterns, print types, catalogue products). */
const EXAMPLE_IDS: Record<string, { id: string; categoryId: string }> = {
  folding_carton: { id: "0192f3a0-7c1e-7d2a-9b1f-00000000c002", categoryId: "0192f3a0-7c1e-7d2a-9b1f-00000000c001" },
};

export const PRODUCT_TYPES: ProductType[] = productTypeSeeds.map((seed, index) => ({
  id: EXAMPLE_IDS[seed.code]?.id ?? mockId("typ", index + 1),
  code: seed.code,
  categoryId: EXAMPLE_IDS[seed.code]?.categoryId ?? mockId("cty", index + 1),
  nameTh: seed.nameTh,
  nameEn: seed.nameEn,
  quoteMode: seed.calculatorKey ? "instant" : "rfq",
  calculatorKey: seed.calculatorKey as ProductType["calculatorKey"],
  isFoodContactDefault: "isFoodContactDefault" in seed ? Boolean(seed.isFoodContactDefault) : false,
  rfqSpecSchema: specSchema(seed.code),
  sort: (index + 1) * 10,
  status: "active",
  updatedAt: UPDATED,
}));

/** The `{ code, name }` reference other mocks put on their rows. */
export function productTypeRef(code: string): { code: string; name: string } {
  const type = PRODUCT_TYPES.find((candidate) => candidate.code === code);
  if (!type) throw new Error(`unknown product type ${code}`);
  return { code: type.code, name: type.nameTh };
}

/** The product type a CS calculator prices. */
export function productTypeOfCalculator(calculator: string): { code: string; name: string } {
  const type = PRODUCT_TYPES.find((candidate) => candidate.calculatorKey === calculator);
  return type ? { code: type.code, name: type.nameTh } : { code: calculator, name: calculator };
}

/**
 * The display summary (`LineSummaryDto`) of a line the rows know only by its product type: no
 * catalogue product and no recorded spec lines. Every mock line sells by the piece (the commerce
 * rows' product lines say ชิ้น).
 */
export function lineSummaryOf(code: string): Schemas["LineSummaryDto"] {
  const type = PRODUCT_TYPES.find((candidate) => candidate.code === code);
  return {
    product: null,
    productTypeCode: code,
    productTypeNameTh: type?.nameTh ?? code,
    productTypeNameEn: type?.nameEn ?? code,
    unit: "piece",
    specs: [],
  };
}
