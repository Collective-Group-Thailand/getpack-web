/**
 * The configurator and instant quote, mocked (F3 3.2):
 *
 *   published  `POST /v1/store/quotes/actions/calculate` (B2.3) — for all seven instant types,
 *              folding in its own `FoldingConfigurationDto`, the others in the generic shape of
 *              CONTRACT-REQUEST store.quote-configurations
 *   requested  store.configurator, store.quotes, store.promo-check, store.support-channels
 *
 * The configurator is built from the back office's own catalogue rows (`../admin/catalogue.ts`)
 * — patterns, materials, ink colours, finishes, die-cuts, assemblies — so an admin edit shows in
 * the shop, and the ids it hands out are the ids the calculator is sent back.
 *
 * Every figure is obviously fake: a smooth function of size, material, colours, finishes and
 * quantity, computed in whole satang the way the mock commerce data is. It is not the ported
 * calculator and must never be read as a price.
 */

import { http, HttpResponse, type HttpHandler } from "msw";
import type { z } from "zod";

import type { storeConfigurator, storeGenericConfiguration, storeQuote } from "@/lib/api/requests/store-quotes";
import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { baht } from "../admin/commerce";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { byId, catalogProducts, imageUrl, live, typeCodeOf, type Row } from "./catalog";
import { customerOf } from "./customers";

type Configurator = z.output<typeof storeConfigurator>;
type Group = Configurator["groups"][number];
type Option = Group["options"][number];
type GenericConfiguration = z.output<typeof storeGenericConfiguration>;
type FoldingConfiguration = Schemas["FoldingConfigurationDto"];
type Step = Schemas["QuoteStepDto"];
export type StoreQuote = z.output<typeof storeQuote>;

const english = (request: Request) => request.headers.get("accept-language")?.startsWith("en") ?? false;
const str = (value: unknown) => (typeof value === "string" ? value : null);

/** D-051, as the settings mock would hold it. */
export const QUOTE_VALIDITY_DAYS = 15;

/* ---------------------------------------------------------------------------- configurator */

const CALCULATOR_OF: Record<string, Configurator["calculator"]> = {
  folding_carton: "folding",
  corrugated: "corrugate",
  label_sticker: "label",
  tag_sleeve: "tag_sleeve",
  flexible_pouch: "pouch",
  standard_product: "standard_product",
  service: "service",
};

/** The catalogue's pattern keys that `@packio/dieline` draws, by the key the store sends. */
const DIELINE_KEYS: Record<string, string> = { rte: "tuck-end", rsc: "rsc", tray: "tray", "tuck-end": "tuck-end" };

const option = (
  row: { id: string; code: string; nameTh: string; nameEn: string },
  extra: Partial<Option> = {},
): Option => ({
  id: row.id,
  code: row.code,
  nameTh: row.nameTh,
  nameEn: row.nameEn,
  descriptionTh: null,
  descriptionEn: null,
  imageUrl: null,
  swatchHex: null,
  isDefault: false,
  print: null,
  area: null,
  ...extra,
});

/** A made-up option for the kinds the admin mock has no table for (label shapes, pouch films…). */
let synthetic = 0;
const fake = (code: string, nameTh: string, nameEn: string, extra: Partial<Option> = {}) =>
  option({ id: mockId("cfg", ++synthetic), code, nameTh, nameEn }, extra);

const group = (
  kind: Group["kind"],
  step: Group["step"],
  names: [string, string],
  options: Option[],
  extra: Partial<Group> = {},
): Group => ({
  kind,
  step,
  nameTh: names[0],
  nameEn: names[1],
  helpTh: null,
  helpEn: null,
  selection: "single",
  required: true,
  options: options.map((entry, index) => ({
    ...entry,
    // A single choice starts on the option marked default, else the first; a multiple one on none.
    isDefault: entry.isDefault || (index === 0 && !extra.selection && !options.some((item) => item.isDefault)),
  })),
  ...extra,
});

const SWATCH: Record<string, string> = { ขาว: "#f4f1ea", น้ำตาล: "#b08a5a" };

function materials(kind: "paper" | "board"): Option[] {
  return live(catalogueRows("materials"))
    .filter((row) => (kind === "board" ? row.fluteTypeId !== null || row.kind === "board" : row.kind === "paper"))
    .map((row) =>
      option(row as never, {
        descriptionTh:
          row.paperGroup === "kraft"
            ? "กระดาษสีน้ำตาลธรรมชาติ ดูเป็นมิตรกับสิ่งแวดล้อม พิมพ์สีเข้มได้ดี"
            : "กระดาษผิวขาวเรียบ พิมพ์สีสด เหมาะกับงานที่ต้องการภาพคมชัด",
        descriptionEn:
          row.paperGroup === "kraft"
            ? "Natural brown board with an eco look; best with darker inks"
            : "Smooth white board for bright, sharp print",
        swatchHex: SWATCH[String(row.outsideColour)] ?? "#e8e2d6",
      }),
    );
}

function processColours() {
  const inks = live(catalogueRows("inkColours"));
  const process = inks.filter((row) => row.colourKind === "process").map((row) => String(row.id));
  const black = String(inks.find((row) => row.code === "cmyk-k")?.id ?? process[0]);
  return { process, black };
}

function printPresets(maxColours: number): Option[] {
  const { process, black } = processColours();
  const full = process.map((inkColourId) => ({ inkColourId, percent: 100 }));
  const presets = [
    fake("print-none", "ไม่พิมพ์", "No print", {
      print: { front: [], back: [] },
      descriptionTh: "สีของวัสดุเอง ไม่มีงานพิมพ์",
      descriptionEn: "The material's own colour, unprinted",
    }),
    fake("print-1c", "1 สี ด้านนอก", "1 colour outside", {
      print: { front: [{ inkColourId: black, percent: 100 }], back: [] },
      descriptionTh: "โลโก้หรือข้อความสีเดียว ประหยัดที่สุด",
      descriptionEn: "A one-colour logo or text; the most economical",
    }),
    fake("print-4c", "4 สี ด้านนอก", "Full colour outside", {
      print: { front: full, back: [] },
      descriptionTh: "พิมพ์ภาพสีเต็มรูปแบบ (CMYK)",
      descriptionEn: "Full-colour images (CMYK)",
      isDefault: true,
    }),
    fake("print-4c1c", "4 สี นอก + 1 สี ใน", "Full colour out + 1 inside", {
      print: { front: full, back: [{ inkColourId: black, percent: 100 }] },
      descriptionTh: "เพิ่มข้อความหรือลายด้านในกล่อง",
      descriptionEn: "Adds a message or pattern inside the box",
    }),
  ];
  return presets.filter((preset) => (preset.print?.front.length ?? 0) <= maxColours);
}

function finishes(kinds: string[], area = false): Option[] {
  return live(catalogueRows("finishes"))
    .filter((row) => kinds.includes(String(row.finishKind)))
    .map((row) =>
      option(row as never, {
        area:
          area && (row.requiresWidth || row.requiresLength || row.requiresAmount)
            ? {
                requiresAmount: Boolean(row.requiresAmount),
                requiresWidth: Boolean(row.requiresWidth),
                requiresLength: Boolean(row.requiresLength),
                maxAmount: 10,
              }
            : null,
      }),
    );
}

const rows = (table: "diecutTypes" | "assemblies") => live(catalogueRows(table)).map((row) => option(row as never));

function rulesOf(pattern: Row, kind: Configurator["size"]["kind"]): Configurator["size"]["patterns"][number]["rules"] {
  const constraints = (pattern.constraints as Record<string, number> | undefined) ?? {};
  return {
    minLengthMm: constraints.minL ?? 30,
    maxLengthMm: constraints.maxL ?? 600,
    minWidthMm: constraints.minW ?? 30,
    maxWidthMm: constraints.maxW ?? 500,
    minHeightMm: kind === "box" ? (constraints.minD ?? 20) : null,
    maxHeightMm: kind === "box" ? (constraints.maxD ?? 400) : null,
    minGussetMm: kind === "pouch" ? 0 : null,
    maxGussetMm: kind === "pouch" ? 120 : null,
    lengthMustExceedWidth: false,
    stepMm: 1,
  };
}

function patternsOf(product: Row, kind: Configurator["size"]["kind"]): Configurator["size"]["patterns"] {
  if (kind === "none") return [];
  const entries = (product.patterns as { patternId: string }[] | undefined) ?? [];
  const patterns = entries.flatMap((entry) => {
    const row = byId(live(catalogueRows("patterns")), entry.patternId);
    return row ? [row] : [];
  });
  if (patterns.length > 0) {
    return patterns.map((pattern) => {
      const subs = catalogueRows("subPatterns").filter((sub) => sub.patternId === pattern.id);
      return {
        id: String(pattern.id),
        code: String(pattern.code),
        name: String(pattern.name),
        dielineKey: DIELINE_KEYS[String(pattern.dielineKey)] ?? null,
        imageUrl: null,
        // A single-part box prices its body only; multi-part patterns list their parts.
        parts: subs.length > 0 ? [{ subPatternId: String(subs[0]!.id), name: String(subs[0]!.name) }] : [],
        rules: rulesOf(pattern, kind),
      };
    });
  }
  // Flat items and pouches have no catalogue pattern in the mock: one made-up shape each.
  const name = kind === "pouch" ? "ซองมาตรฐาน" : "ชิ้นงานแบน";
  return [
    {
      id: mockId("cpt", String(product.slug).length),
      code: kind === "pouch" ? "POUCH-STD" : "FLAT-STD",
      name,
      dielineKey: null,
      imageUrl: null,
      parts: [],
      rules: rulesOf({ constraints: { minW: 20, maxW: 400, minL: 20, maxL: 500 } } as unknown as Row, kind),
    },
  ];
}

export function configuratorOf(product: Row): Configurator | null {
  const productTypeCode = typeCodeOf(product);
  const type = byId(catalogueRows("productTypes"), product.productTypeId);
  const calculator = CALCULATOR_OF[productTypeCode];
  if (!calculator || type?.quoteMode !== "instant") return null;
  synthetic = 0;

  const kind: Configurator["size"]["kind"] =
    calculator === "folding" || calculator === "corrugate"
      ? "box"
      : calculator === "pouch"
        ? "pouch"
        : calculator === "standard_product" || calculator === "service"
          ? "none"
          : "flat";
  const patterns = patternsOf(product, kind);
  const standardSizes = live(catalogueRows("standardSizes"))
    .filter((size) => size.catalogProductId === product.id)
    .map((size) => ({
      code: String(size.code),
      name: String(size.name),
      patternId: null,
      lengthMm: Number(size.lengthMm),
      widthMm: Number(size.widthMm),
      heightMm: kind === "box" ? Number(size.heightMm) : null,
      gussetMm: null,
    }));

  const coatingHelp: [string, string] = [
    "เคลือบช่วยกันรอยขีดข่วนและความชื้น เคลือบด้านให้ความรู้สึกหรู เคลือบเงาให้สีสด",
    "A coating protects against scuffs and damp: matt feels premium, gloss makes colours pop",
  ];
  const groups: Group[] = [];
  switch (calculator) {
    case "folding":
      groups.push(
        group("material", "material", ["กระดาษ", "Board"], materials("paper"), {
          helpTh: "กระดาษยิ่งหนา (แกรมสูง) กล่องยิ่งแข็งแรง",
          helpEn: "Heavier board (higher gsm) makes a sturdier box",
        }),
        group("print", "printing", ["การพิมพ์", "Printing"], printPresets(4)),
        group(
          "coating_front",
          "finishing",
          ["เคลือบผิวด้านนอก", "Outside coating"],
          finishes(["lamination", "varnish"]),
          {
            required: false,
            helpTh: coatingHelp[0],
            helpEn: coatingHelp[1],
          },
        ),
        group("finish", "finishing", ["งานพิเศษ", "Special finishes"], finishes(["spot_uv", "foil"], true), {
          selection: "multiple",
          required: false,
          helpTh: "ปั๊มฟอยล์หรือสปอตยูวีเฉพาะจุด เช่น โลโก้ — ระบุขนาดพื้นที่โดยประมาณ",
          helpEn: "Foil or spot UV on a detail such as the logo — give its approximate size",
        }),
        group("diecut", "assembly", ["ไดคัท", "Die-cut"], rows("diecutTypes")),
        group("assembly", "assembly", ["การขึ้นรูป", "Assembly"], rows("assemblies"), {
          selection: "multiple",
          required: false,
        }),
      );
      break;
    case "corrugate":
      groups.push(
        group(
          "material",
          "material",
          ["ลอนกระดาษ", "Flute"],
          live(catalogueRows("fluteTypes")).map((row) =>
            option(
              { id: String(row.id), code: String(row.code), nameTh: String(row.name), nameEn: `${row.code} flute` },
              {
                descriptionTh:
                  Number(row.layers) >= 5
                    ? "5 ชั้น แข็งแรงมาก สำหรับสินค้าหนัก"
                    : "3 ชั้น น้ำหนักเบา เหมาะกับกล่องไปรษณีย์",
                descriptionEn:
                  Number(row.layers) >= 5 ? "5-ply, very strong, for heavy goods" : "3-ply, light, for mailers",
                swatchHex: "#b58b5c",
              },
            ),
          ),
          {
            helpTh: "ลอน E บางและพิมพ์สวย ลอน B/C หนากว่า ลอน BC แข็งแรงที่สุด",
            helpEn: "E-flute is thin and prints well; B/C are thicker; BC is the strongest",
          },
        ),
        group("print", "printing", ["การพิมพ์", "Printing"], printPresets(4)),
      );
      break;
    case "label":
      groups.push(
        group(
          "shape",
          "material",
          ["รูปทรง", "Shape"],
          [
            fake("rect", "สี่เหลี่ยมมุมมน", "Rounded rectangle"),
            fake("circle", "วงกลม", "Circle"),
            fake("oval", "วงรี", "Oval"),
            fake("custom", "ไดคัทตามรูป", "Custom die-cut", {
              descriptionTh: "ตัดตามเส้นรอบรูปที่คุณออกแบบ",
              descriptionEn: "Cut around the outline you design",
            }),
          ],
        ),
        group(
          "material",
          "material",
          ["เนื้อสติ๊กเกอร์", "Label stock"],
          [
            fake("paper-gloss", "กระดาษขาวมัน", "White gloss paper", { swatchHex: "#f7f7f2" }),
            fake("pp-white", "PP ขาว กันน้ำ", "White PP (waterproof)", {
              swatchHex: "#fbfbfb",
              descriptionTh: "พลาสติกกันน้ำ ทนความชื้น เหมาะกับขวดและของแช่เย็น",
              descriptionEn: "Waterproof film for bottles and chilled goods",
            }),
            fake("pp-clear", "PP ใส", "Clear PP", { swatchHex: "#e9f1f4" }),
            fake("kraft-label", "กระดาษคราฟท์", "Kraft paper", { swatchHex: "#b08a5a" }),
          ],
        ),
        group("print", "printing", ["การพิมพ์", "Printing"], printPresets(4).slice(1)),
        group("coating_front", "finishing", ["เคลือบ", "Coating"], finishes(["lamination"]), {
          required: false,
          helpTh: coatingHelp[0],
          helpEn: coatingHelp[1],
        }),
      );
      break;
    case "tag_sleeve":
      groups.push(
        group("material", "material", ["กระดาษ", "Board"], materials("paper")),
        group("print", "printing", ["การพิมพ์", "Printing"], printPresets(4)),
        group("coating_front", "finishing", ["เคลือบ", "Coating"], finishes(["lamination"]), { required: false }),
        group(
          "assembly",
          "assembly",
          ["เจาะรูและเชือก", "Hole and string"],
          [fake("hole", "เจาะรู 5 มม.", "5 mm hole"), fake("hole-string", "เจาะรู + ร้อยเชือก", "Hole with string")],
          { selection: "multiple", required: false },
        ),
      );
      break;
    case "pouch":
      groups.push(
        group(
          "pouch_type",
          "material",
          ["แบบซอง", "Pouch style"],
          [
            fake("stand-up", "ซองตั้งได้ (ก้นตั้ง)", "Stand-up pouch"),
            fake("flat-3side", "ซองแบน 3 ด้าน", "Three-side seal"),
            fake("side-gusset", "ซองขยายข้าง", "Side gusset"),
          ],
        ),
        group(
          "material",
          "material",
          ["วัสดุฟิล์ม", "Film"],
          [
            fake("pet-al-pe", "PET/AL/PE (ฟอยล์)", "PET/AL/PE (foil)", {
              swatchHex: "#c9ccd1",
              descriptionTh: "กันแสงและอากาศได้ดีที่สุด เหมาะกับกาแฟ ขนม",
              descriptionEn: "The best light and oxygen barrier, for coffee and snacks",
            }),
            fake("pet-pe", "PET/PE ใส", "Clear PET/PE", { swatchHex: "#eef3f5" }),
            fake("kraft-pe", "คราฟท์/PE", "Kraft/PE", { swatchHex: "#b08a5a" }),
          ],
        ),
        group("print", "printing", ["การพิมพ์", "Printing"], printPresets(4)),
        group("closure", "assembly", ["ซิปล็อก", "Zip"], [fake("zip", "มีซิปล็อก", "With a zip")], {
          selection: "multiple",
          required: false,
        }),
        group("window", "assembly", ["หน้าต่างใส", "Window"], [fake("window", "มีหน้าต่างใส", "With a window")], {
          selection: "multiple",
          required: false,
        }),
      );
      break;
    default:
      break;
  }

  const difficulty = live(catalogueRows("difficultyLevels")).find((row) => row.code === "level-2");
  return {
    slug: String(product.slug),
    catalogProductId: String(product.id),
    productTypeCode,
    calculator,
    unit: calculator === "label" ? "ดวง" : "ชิ้น",
    size: { kind, patterns, standardSizes, customAllowed: kind !== "none" },
    groups: groups.filter((entry) => entry.options.length > 0),
    quantity: {
      presets: calculator === "label" ? [1000, 3000, 5000, 10000, 20000] : [500, 1000, 2000, 3000, 5000, 10000],
      min: calculator === "label" ? 500 : 100,
      max: 500_000,
      default: 1000,
      maxTiers: 6,
    },
    design: {
      options:
        calculator === "folding" || calculator === "corrugate"
          ? ["own_file", "online_designer", "hired_design"]
          : ["own_file", "hired_design"],
      default: "own_file",
    },
    mockup: { options: calculator === "service" ? ["none"] : ["none", "with_print", "without_print"] },
    fixedInputs: difficulty ? { difficultyLevelId: String(difficulty.id) } : {},
    quoteValidityDays: QUOTE_VALIDITY_DAYS,
  };
}

function productOfSlug(slug: string | undefined): Row | undefined {
  return catalogProducts().find((row) => row.slug === slug);
}

function productOfId(id: string | undefined): Row | undefined {
  return catalogProducts().find((row) => row.id === id);
}

/* ------------------------------------------------------------------------------- fake price */

interface Inputs {
  configurator: Configurator;
  product: Row;
  l: number;
  w: number;
  d: number;
  gusset: number;
  quantities: number[];
  colours: number;
  extras: number;
  materialFactor: number;
  graphic: boolean;
  structure: boolean;
}

const invalid = (path: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code: "range", message }]);

function checkSize(configurator: Configurator, patternId: string | undefined, l: number, w: number, d: number) {
  if (configurator.size.kind === "none") return null;
  const pattern =
    configurator.size.patterns.find((entry) => entry.id === patternId) ?? configurator.size.patterns[0] ?? null;
  if (!pattern) return invalid("configuration.patternId", "ไม่พบรูปแบบนี้");
  const rules = pattern.rules;
  if (l < rules.minLengthMm || l > rules.maxLengthMm)
    return invalid("configuration.l", `ความยาวต้องอยู่ระหว่าง ${rules.minLengthMm}–${rules.maxLengthMm} มม.`);
  if (w < rules.minWidthMm || w > rules.maxWidthMm)
    return invalid("configuration.w", `ความกว้างต้องอยู่ระหว่าง ${rules.minWidthMm}–${rules.maxWidthMm} มม.`);
  if (rules.minHeightMm !== null && rules.maxHeightMm !== null && (d < rules.minHeightMm || d > rules.maxHeightMm))
    return invalid("configuration.d", `ความสูงต้องอยู่ระหว่าง ${rules.minHeightMm}–${rules.maxHeightMm} มม.`);
  return null;
}

function inputsOf(productTypeCode: string, raw: Record<string, unknown>): Inputs | Response {
  const product = productOfId(str(raw.catalogProductId) ?? undefined);
  if (!product || typeCodeOf(product) !== productTypeCode)
    return invalid("configuration.catalogProductId", "ไม่พบสินค้านี้");
  const configurator = configuratorOf(product);
  if (!configurator) return problem(422, "pricing.not_instant", "สินค้านี้ขอใบเสนอราคาเท่านั้น");
  const optionById = new Map(configurator.groups.flatMap((entry) => entry.options.map((item) => [item.id, item])));
  const materialFactorOf = (id: unknown) => {
    const row = byId(catalogueRows("materials"), id);
    return row?.gsm ? Number(row.gsm) / 350 : 1;
  };

  if (configurator.calculator === "folding") {
    const config = raw as unknown as FoldingConfiguration;
    const bad = checkSize(configurator, config.patternId, config.l, config.w, config.d);
    if (bad) return bad;
    const part = config.parts[0];
    return {
      configurator,
      product,
      l: config.l,
      w: config.w,
      d: config.d,
      gusset: 0,
      quantities: config.quantities,
      colours: (part?.printFront?.length ?? 0) + (part?.printBack?.length ?? 0),
      extras:
        (part?.finish1FrontId ? 1 : 0) +
        (part?.finish1BackId ? 1 : 0) +
        (part?.finish2?.length ?? 0) +
        (part?.assemblies?.length ?? 0),
      materialFactor: materialFactorOf(config.materialId),
      graphic: config.design?.graphic ?? false,
      structure: config.design?.structure ?? false,
    };
  }

  const config = raw as unknown as GenericConfiguration;
  const size = configurator.size.standardSizes.find((entry) => entry.code === config.standardSizeCode);
  const l = config.l ?? size?.lengthMm ?? 100;
  const w = config.w ?? size?.widthMm ?? 100;
  const d = config.d ?? size?.heightMm ?? 0;
  const bad = checkSize(configurator, config.patternId, l, w, configurator.size.kind === "box" ? d : 0);
  if (bad && configurator.size.kind !== "none") return bad;
  const chosen = Object.values(config.options ?? {}).flatMap((value) => (Array.isArray(value) ? value : [value]));
  const print = chosen.map((id) => optionById.get(id)?.print).find(Boolean);
  const material = chosen.map((id) => optionById.get(id)).find((item) => item?.swatchHex);
  return {
    configurator,
    product,
    l,
    w,
    d,
    gusset: config.gusset ?? 0,
    quantities: config.quantities,
    colours: (print?.front.length ?? 0) + (print?.back.length ?? 0),
    extras: chosen.filter((id) => !optionById.get(id)?.print && !optionById.get(id)?.swatchHex).length,
    materialFactor: material ? 1 + (material.code.length % 3) * 0.1 : 1,
    graphic: config.design?.graphic ?? false,
    structure: config.design?.structure ?? false,
  };
}

const BASE: Record<Configurator["calculator"], [base: number, perCm2: number]> = {
  folding: [180, 1.1],
  corrugate: [900, 1.6],
  label: [20, 0.7],
  tag_sleeve: [60, 0.9],
  pouch: [350, 1.2],
  standard_product: [500, 0],
  service: [150_000, 0],
};

/** Per piece, before VAT, in satang. */
function unitNetOf(inputs: Inputs, quantity: number): number {
  const [base, rate] = BASE[inputs.configurator.calculator];
  const { l, w, d, gusset } = inputs;
  const cm2 =
    inputs.configurator.size.kind === "box"
      ? (2 * (l * w + w * d + l * d)) / 100
      : inputs.configurator.size.kind === "pouch"
        ? (w * (l * 2 + gusset)) / 100
        : inputs.configurator.size.kind === "flat"
          ? (l * w) / 100
          : 0;
  const perPiece = base + cm2 * rate * inputs.materialFactor + inputs.colours * 35 + inputs.extras * 90;
  return Math.max(1, Math.round(perPiece * Math.sqrt(1 + 1500 / quantity)));
}

const DAY = 24 * 60;
const vat = (net: number) => Math.round(net * 0.07);
const shippingNetOf = (quantity: number) => 15_000 + Math.ceil(quantity / 1000) * 4_000;
const leadTimeOf = (quantity: number) => Math.min(25, 7 + Math.ceil(quantity / 5000));
const DESIGN_FEE_NET = 150_000;
const STRUCTURE_FEE_NET = 200_000;

function stepOf(inputs: Inputs, quantity: number, postcode: string | undefined): Step {
  const noPrice = (reason: Step["reason"]): Step => ({
    quantity,
    instant: false,
    reason,
    unitPrice: null,
    productAmount: null,
    designFeeAmount: null,
    structureDesignFeeAmount: null,
    shippingAmount: null,
    vatAmount: null,
    grossAmount: null,
    leadTimeDays: null,
    earliestShipDate: null,
    toleranceShortagePct: null,
    toleranceOveragePct: null,
    shippingPending: false,
  });
  // D-101: the one mock factory's weekly capacity. D-043: its machines stop at 450 mm.
  if (quantity > 200_000) return noPrice("capacity_unavailable");
  if (inputs.l > 450) return noPrice("no_price_path");

  const productNet = unitNetOf(inputs, quantity) * quantity;
  const designNet = inputs.graphic ? DESIGN_FEE_NET : 0;
  const structureNet = inputs.structure ? STRUCTURE_FEE_NET : 0;
  const shippingNet = postcode ? shippingNetOf(quantity) : 0;
  const productGross = productNet + vat(productNet);
  const shippingGross = shippingNet + vat(shippingNet);
  const lead = leadTimeOf(quantity);
  return {
    quantity,
    instant: true,
    reason: null,
    unitPrice: baht(Math.round((productGross + shippingGross) / quantity)),
    productAmount: baht(productGross),
    designFeeAmount: baht(designNet + vat(designNet)),
    structureDesignFeeAmount: baht(structureNet + vat(structureNet)),
    shippingAmount: baht(shippingGross),
    vatAmount: baht(vat(productNet) + vat(designNet) + vat(structureNet) + vat(shippingNet)),
    grossAmount: baht(productGross + designNet + vat(designNet) + structureNet + vat(structureNet) + shippingGross),
    leadTimeDays: lead,
    earliestShipDate: bangkokIso(Math.round(lead * 1.4) * DAY).slice(0, 10),
    toleranceShortagePct: "5.0000",
    toleranceOveragePct: "5.0000",
    shippingPending: !postcode,
  };
}

/* ------------------------------------------------------------------------------ saved quotes */

const PROMOTIONS: Record<string, { title: string; titleEn: string; pct: number; types?: string[]; cap?: number }> = {
  PACKIO10: { title: "ลด 10% ค่าสินค้า", titleEn: "10% off the product", pct: 10 },
  FIRSTBOX: {
    title: "ลูกค้าใหม่ ลด 15% (สูงสุด ฿500)",
    titleEn: "New customers: 15% off (up to ฿500)",
    pct: 15,
    cap: 50_000,
  },
  CORRUGATE5: { title: "กล่องลูกฟูก ลด 5%", titleEn: "5% off corrugated boxes", pct: 5, types: ["corrugated"] },
};
const EXPIRED_CODES = new Set(["SUMMER2025"]);

function checkCode(code: string, productTypeCode: string) {
  const key = code.trim().toUpperCase();
  if (EXPIRED_CODES.has(key)) return { key, promotion: null, reason: "expired" as const };
  const promotion = PROMOTIONS[key];
  if (!promotion) return { key, promotion: null, reason: "not_found" as const };
  if (promotion.types && !promotion.types.includes(productTypeCode))
    return { key, promotion: null, reason: "not_applicable" as const };
  return { key, promotion, reason: null };
}

/** Each persona's saved quotations, newest first. */
const quotesByPersona = new Map<string, StoreQuote[]>();
/** Share token → quotation id. */
const shareTokens = new Map<string, { quoteId: string; persona: string; expiresAt: string }>();

export function quotesOf(persona: string): StoreQuote[] {
  if (!quotesByPersona.has(persona)) quotesByPersona.set(persona, []);
  return quotesByPersona.get(persona)!;
}

export function findQuote(quoteId: string): StoreQuote | undefined {
  for (const list of quotesByPersona.values()) {
    const quote = list.find((candidate) => candidate.id === quoteId);
    if (quote) return quote;
  }
  return undefined;
}

let quoteSeq = 0;
export function nextQuoteId(): { id: string; quoteCode: string } {
  quoteSeq += 1;
  return { id: mockId("squ", quoteSeq), quoteCode: `QT-2569-W${String(quoteSeq).padStart(4, "0")}` };
}

const validUntilOf = () => `${bangkokIso(QUOTE_VALIDITY_DAYS * DAY).slice(0, 10)}T23:59:59+07:00`;

function specsOf(inputs: Inputs, raw: Record<string, unknown>, en: boolean): StoreQuote["specs"] {
  const { configurator } = inputs;
  const specs: StoreQuote["specs"] = [];
  const pattern = configurator.size.patterns.find((entry) => entry.id === raw.patternId);
  if (pattern) specs.push({ label: en ? "Style" : "รูปแบบ", value: pattern.name });
  if (configurator.size.kind !== "none") {
    const dims = [inputs.l, inputs.w, configurator.size.kind === "box" ? inputs.d : null]
      .filter((value): value is number => value !== null)
      .join(" × ");
    specs.push({ label: en ? "Size" : "ขนาด", value: `${dims} ${en ? "mm" : "มม."}` });
  }
  const ids = new Set<string>();
  if (configurator.calculator === "folding") {
    const config = raw as unknown as FoldingConfiguration;
    ids.add(config.materialId);
    const part = config.parts[0];
    if (part?.finish1FrontId) ids.add(part.finish1FrontId);
    for (const finish of part?.finish2 ?? []) ids.add(finish.finishId);
    if (part?.diecutTypeId) ids.add(part.diecutTypeId);
    for (const assembly of (part?.assemblies ?? []) as unknown as { assemblyId: string }[])
      ids.add(assembly.assemblyId);
    const print = configurator.groups
      .find((entry) => entry.kind === "print")
      ?.options.find(
        (item) =>
          (item.print?.front.length ?? 0) === (part?.printFront?.length ?? 0) &&
          (item.print?.back.length ?? 0) === (part?.printBack?.length ?? 0),
      );
    if (print) ids.add(print.id);
  } else {
    const config = raw as unknown as GenericConfiguration;
    for (const value of Object.values(config.options ?? {})) for (const id of [value].flat()) ids.add(id);
  }
  for (const entry of configurator.groups) {
    const chosen = entry.options.filter((item) => ids.has(item.id));
    if (chosen.length > 0)
      specs.push({
        label: en ? entry.nameEn : entry.nameTh,
        value: chosen.map((item) => (en ? item.nameEn : item.nameTh)).join(", "),
      });
  }
  return specs;
}

const MOCKUP_NET: Record<StoreQuote["mockupOption"], number> = { none: 0, with_print: 180_000, without_print: 90_000 };

function buildQuote(
  inputs: Inputs,
  raw: Record<string, unknown>,
  body: {
    quantity: number;
    deliveryPostcode?: string;
    designOption: StoreQuote["designOption"];
    mockupOption: StoreQuote["mockupOption"];
    promoCode?: string;
  },
  en: boolean,
): StoreQuote | Response {
  const { quantity } = body;
  const step = stepOf(inputs, quantity, body.deliveryPostcode);
  if (!step.instant) return problem(409, "pricing.no_instant_price", "จำนวนนี้ไม่มีราคาทันที กรุณาขอใบเสนอราคา");
  const unitNet = unitNetOf(inputs, quantity);
  const productNet = unitNet * quantity;
  const designNet = inputs.graphic ? DESIGN_FEE_NET : 0;
  const structureNet = inputs.structure ? STRUCTURE_FEE_NET : 0;
  const mockupNet = MOCKUP_NET[body.mockupOption];
  const shippingNet = body.deliveryPostcode ? shippingNetOf(quantity) : 0;

  const code = body.promoCode ? checkCode(body.promoCode, inputs.configurator.productTypeCode) : null;
  const fullDiscount = code?.promotion ? Math.round((productNet * code.promotion.pct) / 100) : 0;
  const discount = code?.promotion?.cap ? Math.min(fullDiscount, code.promotion.cap) : fullDiscount;

  const unit = inputs.configurator.unit;
  const line = (
    lineType: StoreQuote["lines"][number]["lineType"],
    description: string,
    net: number,
    count: number,
    lineUnit: string,
    oneOff: boolean,
  ): StoreQuote["lines"][number] => ({
    lineType,
    description,
    quantity: `${count}.000`,
    unit: lineUnit,
    unitPrice: (net / count / 100).toFixed(6),
    netAmount: baht(net),
    vatAmount: baht(vat(net)),
    grossAmount: baht(net + vat(net)),
    oneOff,
    waivedReason: null,
  });
  const name = en ? String(inputs.product.nameEn) : String(inputs.product.nameTh);
  const lines = [
    line("product", `${name} ${quantity.toLocaleString("th-TH")} ${unit}`, productNet, quantity, unit, false),
    ...(designNet
      ? [line("design_fee", en ? "Graphic design" : "ค่าออกแบบกราฟิก", designNet, 1, en ? "job" : "งาน", true)]
      : []),
    ...(structureNet
      ? [
          line(
            "structure_design_fee",
            en ? "Structure design" : "ค่าออกแบบโครงสร้าง",
            structureNet,
            1,
            en ? "job" : "งาน",
            true,
          ),
        ]
      : []),
    ...(mockupNet
      ? [
          line(
            "mockup",
            body.mockupOption === "with_print"
              ? en
                ? "Physical mockup, printed"
                : "ตัวอย่างจริง พิมพ์ลาย"
              : en
                ? "Physical mockup, blank"
                : "ตัวอย่างจริง ไม่พิมพ์",
            mockupNet,
            1,
            en ? "piece" : "ชิ้น",
            true,
          ),
        ]
      : []),
    ...(shippingNet
      ? [line("shipping", en ? "Delivery" : "ค่าจัดส่ง", shippingNet, 1, en ? "trip" : "เที่ยว", false)]
      : []),
  ];
  const net = productNet + designNet + structureNet + mockupNet - discount;
  const vatAmount = vat(net + shippingNet);
  const lead = leadTimeOf(quantity);
  const id = nextQuoteId();
  return {
    ...id,
    status: "saved",
    productType: {
      code: inputs.configurator.productTypeCode,
      name: String(byId(catalogueRows("productTypes"), inputs.product.productTypeId)?.[en ? "nameEn" : "nameTh"] ?? ""),
    },
    product: {
      slug: String(inputs.product.slug),
      name,
      imageUrl: imageUrl(((inputs.product.images as { fileId: string }[] | undefined) ?? [])[0]?.fileId),
    },
    specs: specsOf(inputs, raw, en),
    quantity,
    unit,
    lines,
    unitPrice: ((productNet - discount + vat(productNet - discount)) / quantity / 100).toFixed(6),
    netAmount: baht(net),
    discountAmount: baht(discount),
    shippingAmount: baht(shippingNet),
    vatAmount: baht(vatAmount),
    grossAmount: baht(net + shippingNet + vatAmount),
    currency: "THB",
    promotion: code
      ? {
          code: code.key,
          applied: Boolean(code.promotion),
          reason: code.reason,
          title: code.promotion ? (en ? code.promotion.titleEn : code.promotion.title) : null,
          discountAmount: baht(discount),
          capped: Boolean(code.promotion?.cap && fullDiscount > code.promotion.cap),
        }
      : null,
    designOption: body.designOption,
    mockupOption: body.mockupOption,
    leadTimeDays: lead,
    earliestShipDate: step.earliestShipDate!,
    estimatedDeliveryDate: body.deliveryPostcode ? bangkokIso((Math.round(lead * 1.4) + 2) * DAY).slice(0, 10) : null,
    deliveryPostcode: body.deliveryPostcode ?? null,
    tolerance: { shortagePct: "5.0000", overagePct: "5.0000" },
    validUntil: validUntilOf(),
    configuration: raw,
    source: "instant",
    nextActions: [{ key: "quote.add_to_cart" }, { key: "quote.share" }, { key: "quote.export_pdf" }],
    createdAt: bangkokIso(),
  };
}

/* ---------------------------------------------------------------------------------- handlers */

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");

export const storeQuoteHandlers: HttpHandler[] = [
  // Published (B2.3), mocked for every instant type: folding in its own DTO, the others in the
  // generic shape of CONTRACT-REQUEST store.quote-configurations.
  http.post("*/v1/store/quotes/actions/calculate", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Schemas["CalculateQuoteDto"] | null;
    if (!body?.productTypeCode || !body.configuration)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "configuration", code: "required", message: "required" },
      ]);
    const inputs = inputsOf(body.productTypeCode, body.configuration as unknown as Record<string, unknown>);
    if (inputs instanceof Response) return inputs;
    if (!Array.isArray(inputs.quantities) || inputs.quantities.length === 0 || inputs.quantities.length > 10)
      return invalid("configuration.quantities", "ระบุจำนวน 1–10 ระดับ");
    const result: Schemas["QuoteCalculationDto"] = {
      calculatorVersion: "mock-0.0.0",
      steps: inputs.quantities.map((quantity) => stepOf(inputs, quantity, body.deliveryPostcode)),
    };
    return HttpResponse.json(result);
  }),

  // CONTRACT-REQUEST store.configurator
  mockRequest("GET /v1/store/catalog/products/{slug}/configurator", ({ params }) => {
    const product = productOfSlug(params.slug);
    const configurator = product ? configuratorOf(product) : null;
    return configurator ?? problem(404, "http.not_found", "สินค้านี้ขอใบเสนอราคาเท่านั้น");
  }),

  // CONTRACT-REQUEST store.quotes
  mockRequest("POST /v1/store/quotes", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const product = productOfSlug(body.catalogProductSlug);
    if (!product) return problem(404, "http.not_found", "ไม่พบสินค้านี้");
    const inputs = inputsOf(body.productTypeCode, { ...body.configuration, quantities: [body.quantity] });
    if (inputs instanceof Response) return inputs;
    const quote = buildQuote(inputs, body.configuration, body, english(request));
    if (quote instanceof Response) return quote;
    quotesOf(customer.persona).unshift(quote);
    return quote;
  }),

  mockRequest("GET /v1/store/quotes", ({ query, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const list = quotesOf(customer.persona).filter((quote) => !query.status || quote.status === query.status);
    return paginate(
      list.map((quote) => ({
        id: quote.id,
        quoteCode: quote.quoteCode,
        status: Date.parse(quote.validUntil) < Date.now() ? "expired" : quote.status,
        productType: quote.productType,
        product: quote.product,
        quantity: quote.quantity,
        unit: quote.unit,
        grossAmount: quote.grossAmount,
        currency: quote.currency,
        validUntil: quote.validUntil,
        source: quote.source,
        createdAt: quote.createdAt,
      })),
      query,
    );
  }),

  mockRequest("GET /v1/store/quotes/{quoteId}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return quotesOf(customer.persona).find((quote) => quote.id === params.quoteId) ?? notFound();
  }),

  mockRequest("POST /v1/store/quotes/{quoteId}/actions/share", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound();
    const token = `shr${quote.id.slice(-6)}${Math.random().toString(36).slice(2, 8)}`;
    shareTokens.set(token, { quoteId: quote.id, persona: customer.persona, expiresAt: quote.validUntil });
    if (quote.status === "saved") quote.status = "shared";
    return { token, expiresAt: quote.validUntil };
  }),

  mockRequest("GET /v1/store/shared-quotes/{token}", ({ params }) => {
    const share = shareTokens.get(params.token);
    const quote = share ? quotesOf(share.persona).find((candidate) => candidate.id === share.quoteId) : undefined;
    if (!share || !quote || Date.parse(share.expiresAt) < Date.now())
      return problem(404, "http.not_found", "ลิงก์นี้หมดอายุหรือไม่มีอยู่");
    return {
      quoteCode: quote.quoteCode,
      productType: quote.productType,
      product: quote.product,
      specs: quote.specs,
      quantity: quote.quantity,
      unit: quote.unit,
      unitPrice: quote.unitPrice,
      grossAmount: quote.grossAmount,
      currency: quote.currency,
      leadTimeDays: quote.leadTimeDays,
      validUntil: quote.validUntil,
      configuration: quote.configuration,
    };
  }),

  mockRequest("POST /v1/store/quotes/{quoteId}/actions/export-pdf", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound();
    return {
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(`ใบเสนอราคา ${quote.quoteCode} (ข้อมูลจำลอง) — Collective Group (Thailand)`)}`,
      expiresAt: bangkokIso(5),
    };
  }),

  // CONTRACT-REQUEST store.promo-check
  mockRequest("POST /v1/store/promotions/actions/check", ({ body, request }) => {
    const { key, promotion, reason } = checkCode(body.code, body.productTypeCode);
    const en = english(request);
    return {
      code: key,
      valid: Boolean(promotion),
      reason,
      title: promotion ? (en ? promotion.titleEn : promotion.title) : null,
      benefit: promotion
        ? en
          ? `${promotion.pct}% off the product price, applied to your quotation and at checkout`
          : `ลด ${promotion.pct}% จากค่าสินค้า คำนวณในใบเสนอราคาและตอนชำระเงิน`
        : null,
    };
  }),

  // CONTRACT-REQUEST store.support-channels
  mockRequest("GET /v1/store/support-channels", ({ request }) => ({
    lineOaId: "@packio.mock",
    phone: "02-000-0000",
    email: "support@packio.invalid",
    hours: english(request) ? "Mon–Sat 09:00–18:00 (mock data)" : "จันทร์–เสาร์ 09:00–18:00 (ข้อมูลจำลอง)",
  })),
];
