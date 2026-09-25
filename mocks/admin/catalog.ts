/**
 * The catalogue endpoints packio-api B2.1 **published** that the F2 desks read before 2.5 builds
 * their own screens: product types (with each RFQ category's spec schema) — typed by `Schemas`,
 * as the contract's stand-in.
 *
 * The 14 types are the backend's own seed (`prisma/seed/data/catalog.ts`, D-100), copied into
 * `./fixtures/product-types.json`. The backend seeds every type as `rfq` until its calculator
 * ships (schema-design A-16); this mock shows the seven calculator types as `instant`, the state
 * the CS desk of 2.2 already assumes.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { matchesQuery, mockId, paginate, problem, sortBy } from "../support";
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

export const PRODUCT_TYPES: ProductType[] = productTypeSeeds.map((seed, index) => ({
  id: mockId("typ", index + 1),
  code: seed.code,
  categoryId: mockId("cty", index + 1),
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

export const catalogHandlers = [
  http.get("*/v1/admin/catalog/product-types", ({ request }) => {
    if (!can(staffPersonaOf(request), "catalog.read")) return problem(403, "auth.forbidden", "ไม่มีสิทธิ์ดูแคตตาล็อก");
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const status = url.searchParams.get("status");
    const rows = PRODUCT_TYPES.filter((type) => !status || type.status === status).filter((type) =>
      matchesQuery(q, type.code, type.nameTh, type.nameEn),
    );
    return HttpResponse.json(
      paginate(
        sortBy(
          rows,
          url.searchParams.get("sort") ?? "sort",
          (url.searchParams.get("order") as "asc" | "desc") ?? "asc",
        ),
        {
          page: Number(url.searchParams.get("page") ?? 1),
          perPage: Number(url.searchParams.get("perPage") ?? 25),
        },
      ),
    );
  }),
  http.get("*/v1/admin/catalog/product-types/:id", ({ request, params }) => {
    if (!can(staffPersonaOf(request), "catalog.read")) return problem(403, "auth.forbidden", "ไม่มีสิทธิ์ดูแคตตาล็อก");
    const type = PRODUCT_TYPES.find((candidate) => candidate.id === params.id);
    return type ? HttpResponse.json(type) : problem(404, "catalog.not_found", "ไม่พบประเภทสินค้านี้");
  }),
];
