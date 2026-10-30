/**
 * The homepage Studio hero (D-310) and the public config (D-309), as getpack-api v0.43.1 publishes
 * them: the presets read against the mock catalogue's configurators, and a preview priced by the
 * mock's own `store.quotes.calculate` (`inputsOf` / `stepOf`) on the body `/configure` builds for
 * the same choices — every part of a multi-part box — so the mock adds no price of its own. The
 * mock catalogue has no 350 gsm kraft, so `kraft350` is offered by no shape here.
 */

import { http, HttpResponse } from "msw";

import { buildCalculateBody } from "@/features/customer/configurator/build";
import { initialState } from "@/features/customer/configurator/state";
import { seedFromDesign } from "@/features/customer/configurator/url-state";
import type { Schemas } from "@/lib/api/types";

import { bangkokIso, problem } from "../support";
import { catalogProducts } from "./catalog";
import { configuratorOf, inputsOf, stepOf, toStoreConfiguratorDto } from "./quotes";

type Shape = Schemas["HeroShape"];
type Material = Schemas["HeroMaterial"];
type Print = Schemas["HeroPrint"];

/** The mock's `catalog.hero_presets`: shape → product, board / print → option codes. */
const PRESETS = {
  shapes: [
    { id: "mailer", productSlug: "mailer-box" },
    { id: "lid", productSlug: "telescope-box" },
    { id: "tuck", productSlug: "tuck-end-box" },
  ] as { id: Shape; productSlug: string }[],
  boards: { kraft350: ["kraft-350"], art350: ["art-card-350"], corrE: ["E"] } as Record<Material, string[]>,
  prints: { none: [], one: ["black"], full: ["cmyk"] } as Record<Print, string[]>,
  qtys: [300, 500, 1000, 2000],
};
const LABELS = {
  materials: {
    kraft350: ["คราฟท์ 350g", "Kraft 350g"],
    art350: ["อาร์ตการ์ด 350g", "Art card 350g"],
    corrE: ["ลูกฟูก E", "E-flute"],
  },
  prints: { none: ["ไม่พิมพ์", "No print"], one: ["1 สี", "1 colour"], full: ["เต็มสี", "Full colour"] },
} as const;

const cm = (mm: number) => String(mm / 10);

function configuratorOfSlug(slug: string) {
  const product = catalogProducts().find((row) => row.slug === slug);
  const configurator = product ? configuratorOf(product) : null;
  return configurator ? toStoreConfiguratorDto(configurator) : null;
}

type Configurator = NonNullable<ReturnType<typeof configuratorOfSlug>>;
interface Offer {
  shape: Schemas["HeroShapeDto"];
  configurator: Configurator;
  sizes: Schemas["HeroSizeDto"][];
  materials: { id: Material; materialId: string }[];
  prints: { id: Print; inkIds: string[] }[];
}

/** Per shape, only what its product prices instantly — as getpack-api drops the rest on read. */
function offers(): Offer[] {
  return PRESETS.shapes.flatMap(({ id, productSlug }): Offer[] => {
    const configurator = configuratorOfSlug(productSlug);
    const pattern = configurator?.patterns[0];
    if (!configurator?.instant || !pattern || configurator.standardSizes.length === 0) return [];
    const options = (kind: string) => configurator.optionGroups.find((group) => group.kind === kind)?.options ?? [];
    const materials = (Object.keys(PRESETS.boards) as Material[]).flatMap((material) => {
      const option = options("material").find((o) => PRESETS.boards[material].includes(o.code));
      return option ? [{ id: material, materialId: option.id }] : [];
    });
    const prints = (Object.keys(PRESETS.prints) as Print[]).flatMap((print) => {
      const inkIds = options("ink_colour")
        .filter((o) => PRESETS.prints[print].includes(o.code))
        .map((o) => o.id);
      return print === "none" || inkIds.length > 0 ? [{ id: print, inkIds }] : [];
    });
    const { min, max } = configurator.quantity;
    const qtys = PRESETS.qtys.filter((q) => (min === null || q >= min) && (max === null || q <= max));
    if (materials.length === 0 || qtys.length === 0) return [];
    const sizes = configurator.standardSizes.slice(0, 3).map((size, index) => ({
      id: `${id}:s${index}`,
      shapeId: id,
      code: `s${index}`,
      labelTh: `${cm(size.lengthMm)} × ${cm(size.widthMm)} × ${cm(size.heightMm)} ซม.`,
      lengthMm: size.lengthMm,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
    }));
    return [
      {
        configurator,
        sizes,
        materials,
        prints,
        shape: {
          id,
          labelTh: pattern.name,
          productSlug: configurator.slug,
          catalogProductId: configurator.catalogProductId,
          productTypeCode: configurator.productTypeCode,
          calculator: configurator.calculator,
          patternId: pattern.id,
          dielineKey: pattern.dielineKey ?? null,
          styleCode: pattern.styleCode ?? null,
          qtys,
        },
      },
    ];
  });
}

function presets(): Schemas["HeroPresetsDto"] {
  const all = offers();
  const first = all[0];
  const print = first?.prints.find((p) => p.id === "one") ?? first?.prints[0];
  return {
    shapes: all.map((offer) => offer.shape),
    sizes: all.flatMap((offer) => offer.sizes),
    materials: (Object.keys(LABELS.materials) as Material[]).flatMap((id) => {
      const options = all.flatMap((offer) =>
        offer.materials.filter((m) => m.id === id).map((m) => ({ shapeId: offer.shape.id, materialId: m.materialId })),
      );
      return options.length
        ? [{ id, labelTh: LABELS.materials[id][0], labelEn: LABELS.materials[id][1], options }]
        : [];
    }),
    prints: (Object.keys(LABELS.prints) as Print[]).flatMap((id) => {
      const options = all.flatMap((offer) =>
        offer.prints.filter((p) => p.id === id).map((p) => ({ shapeId: offer.shape.id, inkIds: p.inkIds })),
      );
      return options.length ? [{ id, labelTh: LABELS.prints[id][0], labelEn: LABELS.prints[id][1], options }] : [];
    }),
    qtys: [...new Set(all.flatMap((offer) => offer.shape.qtys))].sort((a, b) => a - b),
    default:
      first && print
        ? {
            shape: first.shape.id,
            sizeId: first.sizes[0]!.id,
            lengthMm: first.sizes[0]!.lengthMm,
            widthMm: first.sizes[0]!.widthMm,
            heightMm: first.sizes[0]!.heightMm,
            material: first.materials[0]!.id,
            print: print.id,
            qty: first.shape.qtys[0]!,
          }
        : null,
  };
}

function preview(body: Schemas["HeroPreviewRequestDto"]): Schemas["HeroPreviewDto"] | Response {
  const offer = offers().find((entry) => entry.shape.id === body.shape);
  const material = offer?.materials.find((m) => m.id === body.material);
  const print = offer?.prints.find((p) => p.id === body.print);
  if (!offer || !material || !print || !offer.shape.qtys.includes(body.qty))
    return problem(409, "quotes.preview_unavailable", "ตัวเลือกนี้ยังไม่เปิดให้คำนวณราคาจากหน้าแรก");
  const configurator = offer.configurator;
  const state = initialState(
    configurator,
    seedFromDesign(configurator, {
      pattern: offer.shape.patternId,
      material: material.materialId,
      l: String(body.lengthMm),
      w: String(body.widthMm),
      d: String(body.heightMm),
      qty: String(body.qty),
      from: "home",
      ink: print.inkIds.length ? print.inkIds.join(",") : "none",
    }),
  );
  const calculation = buildCalculateBody(configurator, { ...state, quantities: [body.qty], quantity: body.qty });
  const inputs = inputsOf(calculation.productTypeCode, calculation.configuration as unknown as Record<string, unknown>);
  if (inputs instanceof Response) return inputs;
  const step = stepOf(inputs, body.qty, undefined);
  if (!step.instant || !step.unitPrice || !step.productAmount)
    return problem(409, "pricing.not_instant", "ขนาดนี้ยังคิดราคาทันทีไม่ได้");
  const lead = step.leadTimeDays ?? 0;
  return {
    unitPrice: step.unitPrice,
    total: step.productAmount,
    currency: "THB",
    vatIncluded: true,
    leadTimeBusinessDays: { min: lead, max: lead + 2 },
    priceLockUntil: bangkokIso(configurator.quoteValidityDays * 24 * 60),
    presetId:
      offer.sizes.find(
        (size) => size.lengthMm === body.lengthMm && size.widthMm === body.widthMm && size.heightMm === body.heightMm,
      )?.id ?? null,
    calculation: calculation as unknown as Record<string, unknown>,
  };
}

// CONTRACT-SKEW (D-460): `tolerances` is not in the vendored contract yet (see PublicConfig).
const publicConfig = (): Schemas["PublicConfigDto"] & { tolerances: Record<string, string | null> } => ({
  minOrderQty: { custom: 300, readyStock: 1 },
  priceLockDays: 15,
  claimWindowDays: 7,
  proofSlaBusinessDays: null,
  // D-447 decided daily 09:00–18:00 (the reference seed's first version of storefront.support_hours).
  supportHours: { days: "daily", open: "09:00", close: "18:00", tz: "Asia/Bangkok" },
  supportReplyMinutes: null,
  templateCount: 105,
  contact: { phone: "020000000", lineOaId: "@getpack-mock", email: "support@example.invalid" },
  // D-458 (C10): what the business and getpack Factory pages label — the reference seed's statuses.
  roadmap: {
    business: [
      { key: "team", status: "live" },
      { key: "reorder", status: "live" },
      { key: "approval", status: "live" },
      { key: "credit", status: "live" },
      { key: "invoices", status: "live" },
      { key: "branches", status: "live" },
      { key: "brand_lock", status: "soon" },
      { key: "stock_alert", status: "soon" },
      { key: "production_evidence", status: "soon" },
      { key: "etax_export", status: "soon" },
      { key: "api", status: "soon" },
      { key: "company_catalogue", status: "soon" },
      { key: "budgets", status: "soon" },
    ],
    erpModules: [
      { key: "getpack_jobs", status: "live" },
      { key: "roles", status: "live" },
      { key: "stock", status: "in_development" },
      { key: "purchasing", status: "in_development" },
      { key: "planning", status: "in_development" },
      { key: "shop_floor", status: "in_development" },
      { key: "sales", status: "in_development" },
      { key: "accounting", status: "in_development" },
      { key: "documents", status: "in_development" },
      { key: "maintenance", status: "in_development" },
      { key: "suppliers", status: "in_development" },
    ],
  },
  // D-460 (C12): the reference seed's defaults (fulfilment.tolerance_default_pct, dimensional_tolerance_mm,
  // colour_tolerance_delta_e) as the API states them.
  tolerances: {
    quantityPct: "5.00",
    sizeMmMin: "1.00",
    sizeMmMax: "3.00",
    colourDeltaE: "3",
    colourDeltaEFlexo: "5",
  },
  paymentMethods: ["bank_transfer_slip", "scb_qr", "card_2c2p"],
  issuer: {
    legalNameTh: "บริษัท ทดสอบระบบ จำกัด (ข้อมูลจำลอง)",
    legalNameEn: "Mock Test Co., Ltd. (mock data)",
    taxId: "0000000000000",
    branchCode: "00000",
    addressTh: "ที่อยู่จำลอง ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพมหานคร 10000 (ข้อมูลจำลอง)",
  },
});

export const heroHandlers = [
  // The mock catalogue's made-to-order floor is 100; 300 here is the figure the Main board review
  // names, as an admin catalogue would state it.
  http.get("*/v1/store/public-config", () => HttpResponse.json(publicConfig())),
  http.get("*/v1/store/catalog/hero-presets", () => HttpResponse.json(presets())),
  http.post("*/v1/store/quotes/actions/preview", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Schemas["HeroPreviewRequestDto"] | null;
    if (!body?.shape) return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง");
    const result = preview(body);
    return result instanceof Response ? result : HttpResponse.json(result);
  }),
];
