/**
 * The configurator and instant quote, mocked (F3 3.2):
 *
 *   published  `POST /v1/store/quotes/actions/calculate` (B2.3) — every instant type in its own
 *              published configuration (U2.F1), on the basis it was entered (D-182), with the
 *              target's gap (D-247)
 *   published  saved quotations (`store.quotes.save` / `.list` / `.get` / `.share` / `.getShared` /
 *              `.requestPdf` / `.getPdf`, U-F0.2) — projected from the records below, which the
 *              cart, checkout, RFQ and reorder mocks share
 *   published  `store.catalog.getConfigurator` — the published `StoreConfiguratorDto`, converted from the
 *              mock's own, richer view below (`toStoreConfiguratorDto`)
 *   published  the code check (`store.promotions.checkCode`) and the CS channels (`store.support.getChannels`)
 *
 * The configurator is built from the back office's own catalogue rows (`../admin/catalogue.ts`)
 * — patterns, materials, ink colours, finishes, die-cuts, assemblies — so an admin edit shows in
 * the shop, and the ids it hands out are the ids the calculator is sent back.
 *
 * Every figure is obviously fake: a smooth function of size, material, colours, finishes and
 * quantity, computed in whole satang the way the mock commerce data is. It is not the ported
 * calculator and must never be read as a price.
 */

import { resolveStyleId } from "@getpack/dieline";
import { http, HttpResponse, type HttpHandler } from "msw";
import type { z } from "zod";

import type { storeQuote } from "@/lib/api/requests/store-quotes";
import type { Schemas } from "@/lib/api/types";

import { lineSummaryOf } from "../admin/catalog";
import { catalogueRows } from "../admin/catalogue";
import { baht } from "../admin/commerce";
import { bangkokIso, mockId, paginate, problem, QUOTE_V2_EMPTY } from "../support";
import { byId, catalogProducts, imageUrl, live, typeCodeOf, type Row } from "./catalog";
import { customerOf } from "./customers";
import { BasisError, caliperOf, convert, familyOf, type Basis, type Size } from "./specs";
import { unitOf } from "./order-dto";
import { QUOTE_STATUS } from "@/domain/status";
import { buildCalculateBody } from "@/features/customer/configurator/build";
import { initialState, readyToPrice } from "@/features/customer/configurator/state";
import { statusLabels } from "../status-labels";

type Step = Schemas["QuoteStepDto"];
export type StoreQuote = z.output<typeof storeQuote>;

const english = (request: Request) => request.headers.get("accept-language")?.startsWith("en") ?? false;
const str = (value: unknown) => (typeof value === "string" ? value : null);

/** D-051, as the settings mock would hold it. */
export const QUOTE_VALIDITY_DAYS = 15;

/* ---------------------------------------------------------------------------- configurator */

/*
 * The mock's own view of a product's configurator: what F3 3.2 first asked for (typed groups per
 * calculator input, print presets, swatches and explainers), richer than what getpack-api
 * publishes. The fake price below reads it; the configurator endpoint converts it to the
 * published `StoreConfiguratorDto` (`toStoreConfiguratorDto`), dropping what the contract has no
 * place for, so the storefront sees exactly what the real API can say.
 */
type GroupKind =
  | "material"
  | "print"
  | "coating_front"
  | "coating_back"
  | "finish"
  | "diecut"
  | "assembly"
  | "shape"
  | "pouch_type"
  | "closure"
  | "window";
type SizeKind = "box" | "flat" | "pouch" | "none";
interface PrintColour {
  inkColourId: string;
  percent: number;
}
interface Option {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  descriptionTh: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  swatchHex: string | null;
  isDefault: boolean;
  print: { front: PrintColour[]; back: PrintColour[] } | null;
  area: { requiresAmount: boolean; requiresWidth: boolean; requiresLength: boolean; maxAmount: number } | null;
  /** The catalogue row's published attributes (gsm, finish kind…). */
  attributes?: Record<string, unknown>;
}
interface Group {
  kind: GroupKind;
  step: "material" | "printing" | "finishing" | "assembly";
  nameTh: string;
  nameEn: string;
  helpTh: string | null;
  helpEn: string | null;
  selection: "single" | "multiple";
  required: boolean;
  options: Option[];
}
interface Rules {
  minLengthMm: number;
  maxLengthMm: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number | null;
  maxHeightMm: number | null;
  minGussetMm: number | null;
  maxGussetMm: number | null;
  lengthMustExceedWidth: boolean;
  stepMm: number;
}
interface Pattern {
  id: string;
  code: string;
  name: string;
  dielineKey: string | null;
  imageUrl: string | null;
  parts: { subPatternId: string | null; name: string }[];
  rules: Rules;
  /** D-184: the public code, once the pattern has one; the international name only when verified (D-211). */
  styleCode: string | null;
  internationalName: string | null;
}
interface Configurator {
  slug: string;
  catalogProductId: string;
  productTypeCode: string;
  calculator: Schemas["CalculatorKey"];
  unit: string;
  size: {
    kind: SizeKind;
    patterns: Pattern[];
    standardSizes: {
      id: string;
      code: string;
      name: string;
      patternId: string | null;
      lengthMm: number;
      widthMm: number;
      heightMm: number | null;
      gussetMm: number | null;
    }[];
    customAllowed: boolean;
  };
  groups: Group[];
  quantity: { presets: number[]; min: number; max: number; default: number; maxTiers: number };
  design: { options: Schemas["DesignOption"][]; default: Schemas["DesignOption"] };
  mockup: { options: Schemas["MockupOption"][] };
  fixedInputs: Record<string, string>;
  quoteValidityDays: number;
}

const CALCULATOR_OF: Record<string, Configurator["calculator"]> = {
  folding_carton: "folding",
  corrugated: "corrugate",
  label_sticker: "label",
  tag_sleeve: "tag_sleeve",
  flexible_pouch: "pouch",
  standard_product: "standard_product",
  service: "service",
};

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

/** The process set is one ink laid four times, as getpack-api's engine takes it; black is a spot ink. */
function processColours() {
  const inks = live(catalogueRows("inkColours"));
  const process = String(inks.find((row) => row.colourKind === "process")?.id ?? "");
  const black = String(inks.find((row) => row.code === "black")?.id ?? process);
  return { process, black };
}

function printPresets(maxColours: number): Option[] {
  const { process, black } = processColours();
  const full = [1, 2, 3, 4].map(() => ({ inkColourId: process, percent: 100 }));
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
        attributes: {
          finishKind: row.finishKind,
          requiresAmount: Boolean(row.requiresAmount),
          requiresWidth: Boolean(row.requiresWidth),
          requiresLength: Boolean(row.requiresLength),
        },
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

function rulesOf(pattern: Row, kind: SizeKind): Rules {
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

function patternsOf(product: Row, kind: SizeKind): Pattern[] {
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
        // The catalogue's key resolved to a style `@getpack/dieline` draws (`rte` → reverse tuck end).
        dielineKey: resolveStyleId(String(pattern.dielineKey ?? "")),
        imageUrl: null,
        // A multi-part pattern lists every part (a telescope body and lid), each priced; none = one part.
        parts: [...subs]
          .sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0))
          .map((sub) => ({ subPatternId: String(sub.id), name: String(sub.name) })),
        rules: rulesOf(pattern, kind),
        styleCode: str(pattern.styleCode),
        internationalName: pattern.internationalNameVerifiedAt ? str(pattern.internationalName) : null,
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
      styleCode: null,
      internationalName: null,
    },
  ];
}

export function configuratorOf(product: Row): Configurator | null {
  const productTypeCode = typeCodeOf(product);
  const type = byId(catalogueRows("productTypes"), product.productTypeId);
  const calculator = CALCULATOR_OF[productTypeCode];
  if (!calculator || type?.quoteMode !== "instant") return null;
  synthetic = 0;

  const kind: SizeKind =
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
      id: String(size.id),
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

/** The published kinds the mock's groups become; a kind the contract has no place for is dropped. */
const PUBLISHED_KIND: Partial<Record<GroupKind, Schemas["OfferableOptionKind"]>> = {
  material: "material",
  coating_front: "coating",
  coating_back: "coating",
  finish: "finish",
  diecut: "diecut",
  assembly: "assembly",
  // A pouch's zip and window are catalogue assemblies (`PouchConfigurationDto.optionIds`).
  closure: "assembly",
  window: "assembly",
};

const UNIT: Record<string, Schemas["ProductUnit"]> = { ชิ้น: "piece", ดวง: "piece", ซอง: "pouch" };

/**
 * The mock's view → the published `StoreConfiguratorDto`. What the contract does not carry is
 * left behind: print presets become the ink colours they print with, group names, help, steps,
 * the shapes and pouch styles of the unported calculators, the mockup add-on, the cutting step
 * and the gusset limits.
 */
function configuratorBase(configurator: Configurator): Schemas["StoreConfiguratorDto"] {
  const published = (option: Option): Schemas["StoreOptionDto"] => ({
    id: option.id,
    code: option.code,
    nameTh: option.nameTh,
    nameEn: option.nameEn,
    descriptionTh: option.descriptionTh,
    descriptionEn: option.descriptionEn,
    imageUrl: option.imageUrl,
    swatchHex: option.swatchHex,
    isDefault: option.isDefault,
    attributes: option.attributes ?? {},
  });
  const optionGroups: Schemas["StoreOptionGroupDto"][] = [];
  for (const group of configurator.groups) {
    const kind = PUBLISHED_KIND[group.kind];
    if (!kind) continue;
    const existing = optionGroups.find((entry) => entry.kind === kind);
    if (existing) {
      // One coating list for both sides.
      for (const option of group.options)
        if (!existing.options.some((known) => known.id === option.id)) existing.options.push(published(option));
      continue;
    }
    optionGroups.push({ kind, options: group.options.map(published) });
  }
  if (configurator.groups.some((group) => group.kind === "print")) {
    optionGroups.push({
      kind: "ink_colour",
      options: live(catalogueRows("inkColours")).map((row) => ({
        id: String(row.id),
        code: String(row.code),
        nameTh: String(row.name),
        nameEn: String(row.name),
        descriptionTh: null,
        descriptionEn: null,
        imageUrl: null,
        swatchHex: null,
        isDefault: false,
        attributes: { colourKind: row.colourKind },
      })),
    });
  }
  const box = configurator.size.kind === "box";
  const inks = optionGroups.find((entry) => entry.kind === "ink_colour")?.options ?? [];
  return {
    slug: configurator.slug,
    catalogProductId: configurator.catalogProductId,
    productTypeCode: configurator.productTypeCode,
    calculator: configurator.calculator,
    instant: configurator.fixedInputs.difficultyLevelId !== undefined,
    difficultyLevelId: configurator.fixedInputs.difficultyLevelId ?? null,
    // Filled by `toStoreConfiguratorDto` once the rest of the DTO exists (D-441).
    defaultSpec: null,
    patterns: configurator.size.patterns.map((pattern) => ({
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      styleCode: pattern.styleCode,
      internationalName: pattern.internationalName,
      // The mock's one pouch shape stands up on a bottom gusset (`b`).
      pouch:
        configurator.size.kind === "pouch"
          ? {
              formula: "stand_up",
              needs: ["b"],
              minBMm: 30,
              maxBMm: 120,
              minSMm: null,
              maxSMm: null,
              minCsMm: null,
              maxCsMm: null,
            }
          : null,
      dielineKey: pattern.dielineKey,
      dielineVariantCodes: [],
      imageUrl: pattern.imageUrl,
      descriptionTh: null,
      descriptionEn: null,
      parts: pattern.parts.flatMap((part, index) =>
        part.subPatternId ? [{ subPatternId: part.subPatternId, seq: index + 1, name: part.name }] : [],
      ),
      fluteTypeIds: [],
      rules: {
        minLMm: pattern.rules.minLengthMm,
        maxLMm: pattern.rules.maxLengthMm,
        minWMm: pattern.rules.minWidthMm,
        maxWMm: pattern.rules.maxWidthMm,
        minHMm: pattern.rules.minHeightMm,
        maxHMm: pattern.rules.maxHeightMm,
        lengthMustExceedWidth: pattern.rules.lengthMustExceedWidth,
        lengthMustExceedHeight: false,
        widthMustExceedHeight: false,
      },
    })),
    standardSizes: configurator.size.standardSizes.map((size) => ({
      id: size.id,
      code: size.code,
      name: size.name,
      lengthMm: size.lengthMm,
      widthMm: size.widthMm,
      heightMm: box ? (size.heightMm ?? 0) : 0,
      // Without a reference configuration the first size is the default; the mock's reference is that size.
      isDefault: configurator.size.standardSizes[0] === size,
    })),
    optionGroups,
    printModel: configurator.calculator === "corrugate" ? printModelOf(inks) : null,
    printAreas: configurator.calculator === "corrugate" ? ["top", "side", "top_side", "all_round"] : [],
    quoteValidityDays: configurator.quoteValidityDays,
    unit: UNIT[configurator.unit] ?? "piece",
    quantity: { ...configurator.quantity },
    design: configurator.design,
  };
}

/**
 * D-443, mocked: a corrugate product with inks offers, on each side, none / one spot colour / CMYK
 * (add-on off) — what the UAT seed gives its corrugated products. Outside opens on CMYK, inside on
 * none, like the postal box (`printModel.<side>.default`).
 */
function printModelOf(inks: Schemas["StoreOptionDto"][]): Schemas["StorePrintModelDto"] | null {
  const cmyk = inks.find((ink) => ink.attributes?.colourKind === "process");
  const spot = inks.filter((ink) => ink.attributes?.colourKind !== "process").map((ink) => ink.id);
  if (!cmyk && spot.length === 0) return null;
  const side = (field: "printFront" | "printBack", printed: boolean): Schemas["StorePrintSideDto"] => ({
    field,
    methods: ["none", ...(spot.length > 0 ? (["spot"] as const) : []), ...(cmyk ? (["cmyk"] as const) : [])],
    spot: spot.length > 0 ? { minColours: 1, maxColours: 1, inkColourIds: spot } : null,
    cmyk: cmyk ? { inkColourId: cmyk.id, addOn: { enabled: false, minColours: 0, maxColours: 0 } } : null,
    default: {
      method: printed && cmyk ? "cmyk" : "none",
      spotInkColourIds: [],
      cmykAddOnInkColourIds: [],
    },
  });
  return { outside: side("printFront", true), inside: side("printBack", false) };
}

/**
 * D-441, mocked: the reference configuration of an instant product is its first pattern at its first
 * standard size, the options flagged default, at the quantity the configurator opens on. The listing
 * card, the price hint and the configurator all read the figure this prices, through the same fake
 * engine as `calculate`, so they cannot drift apart.
 */
export function referenceOf(configurator: Configurator): {
  spec: Schemas["StoreConfiguratorDefaultSpecDto"];
  unitPrice: string;
} | null {
  const base = configuratorBase(configurator);
  if (!base.instant) return null;
  const quantity = base.quantity.default ?? base.quantity.min ?? 1;
  const state = initialState(base, { quantities: [quantity], quantity });
  if (!readyToPrice(base, state)) return null;
  const configuration = buildCalculateBody(base, state).configuration;
  const raw = configuration as unknown as Record<string, unknown>;
  const inputs = inputsOf(base.productTypeCode, raw);
  if (inputs instanceof Response) return null;
  const step = stepOf(inputs, quantity, undefined);
  if (!step.instant || !step.unitPrice) return null;
  return {
    spec: {
      configuration: configuration as unknown as Record<string, unknown>,
      quantity,
      standardSizeCode: state.standardSizeCode,
      ...calculationSpecOf(inputs, raw),
    },
    unitPrice: step.unitPrice,
  };
}

/** The reference of a catalogue product, for the cards and the price hints (`./catalog.ts`). */
export function startingOf(product: Row) {
  const configurator = configuratorOf(product);
  return configurator ? referenceOf(configurator) : null;
}

export function toStoreConfiguratorDto(configurator: Configurator): Schemas["StoreConfiguratorDto"] {
  return { ...configuratorBase(configurator), defaultSpec: referenceOf(configurator)?.spec ?? null };
}

function productOfSlug(slug: string | undefined): Row | undefined {
  return catalogProducts().find((row) => row.slug === slug);
}

export function productOfId(id: string | undefined): Row | undefined {
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
  /** The size on every basis, as `store.quotes.calculate` freezes it (D-182). */
  dimensions: Schemas["QuoteDimensionsDto"] | null;
  /** Every option id the configuration names. */
  ids: Set<string>;
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

/** The size the mock prices: a box's inside size (D-182, converted as getpack-api does), else as entered. */
function pricedSize(
  productTypeCode: string,
  raw: Record<string, unknown>,
  size: Size,
): { size: Size; dimensions: Schemas["QuoteDimensionsDto"] | null } | Response {
  const basis = (raw.basis as Basis | undefined) ?? (TYPE_FAMILY_FLAT.has(productTypeCode) ? "product" : "internal");
  const family = familyOf(productTypeCode, raw.patternId as string | undefined, size.d);
  try {
    const converted = convert(size, basis, family, caliperOf(raw.materialId as string | undefined));
    const priced = family === "flat" ? size : converted.sizes.internal;
    if (!priced) return problem(422, "specs.caliper_missing", "ไม่ทราบความหนาของวัสดุ จึงแปลงขนาดไม่ได้");
    return {
      size: priced,
      dimensions: {
        basis,
        basisAssumed: raw.basis === undefined,
        bases: converted.bases,
        caliperMm: converted.caliperMm,
        conversionVersion: "1.0.0",
        entered: size,
        family,
        priced,
        pricedBasis: family === "flat" ? "product" : "internal",
        sizes: converted.sizes,
      },
    };
  } catch (error) {
    if (error instanceof BasisError) return problem(422, error.code, "แบบนี้ไม่ได้วัดด้วยฐานนี้");
    throw error;
  }
}

const FLUTE_FACTOR: Record<string, number> = { E: 1, B: 1.08, C: 1.15, BC: 1.35 };

const TYPE_FAMILY_FLAT = new Set(["label_sticker", "tag_sleeve", "flexible_pouch", "standard_product", "service"]);

/** Every option id a published configuration names, wherever it sits. */
function idsIn(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "string") into.add(value);
  else if (Array.isArray(value)) for (const item of value) idsIn(item, into);
  else if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      if (!["catalogProductId", "patternId", "difficultyLevelId", "basis", "styleVariantCode", "area"].includes(key))
        idsIn(item, into);
  return into;
}

export function inputsOf(productTypeCode: string, raw: Record<string, unknown>): Inputs | Response {
  const product = productOfId(str(raw.catalogProductId) ?? undefined);
  if (!product || typeCodeOf(product) !== productTypeCode)
    return invalid("configuration.catalogProductId", "ไม่พบสินค้านี้");
  const configurator = configuratorOf(product);
  if (!configurator) return problem(422, "pricing.not_instant", "สินค้านี้ขอใบเสนอราคาเท่านั้น");
  if (Object.keys(raw).some((key) => /unit/i.test(key)))
    return problem(422, "specs.unit_not_accepted", "ระบบรับขนาดเป็นมิลลิเมตรเท่านั้น");
  const num = (value: unknown) => (typeof value === "number" ? value : 0);
  const quantities = Array.isArray(raw.quantities) ? (raw.quantities as number[]) : [];
  const design = (raw.design ?? {}) as { graphic?: boolean; structure?: boolean };
  const materialFactorOf = (id: unknown) => {
    const row = byId(catalogueRows("materials"), id);
    if (row?.gsm) return Number(row.gsm) / 350;
    // The corrugated mock's boards are its flutes: a heavier flute costs more (fake).
    const flute = byId(catalogueRows("fluteTypes"), id);
    return flute ? (FLUTE_FACTOR[String(flute.code)] ?? 1) : 1;
  };
  const kind = configurator.size.kind;
  const entered = { l: num(raw.l), w: num(raw.w), d: kind === "box" ? num(raw.d) : 0 };
  const sized = kind === "none" ? { size: entered, dimensions: null } : pricedSize(productTypeCode, raw, entered);
  if (sized instanceof Response) return sized;
  const { l, w, d } = sized.size;
  if (kind !== "none") {
    const bad = checkSize(configurator, raw.patternId as string | undefined, l, w, kind === "box" ? d : 0);
    if (bad) return bad;
  }
  const list = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : []);
  // Every part is priced: a box's colours and extras add up over its parts (a body and its lid).
  const parts = (list(raw.parts).length > 0 ? list(raw.parts) : [raw]) as Record<string, unknown>[];
  const sum = (count: (part: Record<string, unknown>) => number) => parts.reduce((total, p) => total + count(p), 0);
  const colours = (() => {
    switch (configurator.calculator) {
      case "label":
        return (
          list((raw.printFront as { inkColourIds?: unknown[] } | undefined)?.inkColourIds).length +
          list((raw.printBack as { inkColourIds?: unknown[] } | undefined)?.inkColourIds).length
        );
      case "pouch":
        return raw.printColourId ? 4 : 0;
      default:
        return sum((part) => list(part.printFront).length + list(part.printBack).length);
    }
  })();
  const extras =
    configurator.calculator === "pouch"
      ? list(raw.optionIds).length
      : sum(
          (part) =>
            (part.finish1FrontId || part.coatingFrontId || part.finishFrontId ? 1 : 0) +
            (part.finish1BackId || part.coatingBackId || part.finishBackId ? 1 : 0) +
            list(part.finish2).length +
            list(part.assemblies).length,
        );
  return {
    configurator,
    product,
    l,
    w,
    d,
    gusset: num(raw.b) || num(raw.s),
    quantities,
    colours,
    extras,
    materialFactor: materialFactorOf(raw.materialId),
    graphic: design.graphic ?? false,
    structure: design.structure ?? false,
    dimensions: sized.dimensions,
    ids: idsIn(raw),
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
const DIMENSIONAL_TOLERANCE: Partial<Record<Configurator["calculator"], string>> = {
  folding: "1.00",
  tag_sleeve: "1.00",
  corrugate: "3.00",
};
const vat = (net: number) => Math.round(net * 0.07);
const shippingNetOf = (quantity: number) => 15_000 + Math.ceil(quantity / 1000) * 4_000;
const leadTimeOf = (quantity: number) => Math.min(25, 7 + Math.ceil(quantity / 5000));
const DESIGN_FEE_NET = 150_000;
const STRUCTURE_FEE_NET = 200_000;

export function stepOf(inputs: Inputs, quantity: number, postcode: string | undefined): Step {
  const noPrice = (reason: Step["reason"]): Step => ({
    quantity,
    instant: false,
    reason,
    unitPrice: null,
    productAmount: null,
    designFeeAmount: null,
    structureDesignFeeAmount: null,
    toolingAmount: null,
    toolingWaiver: null,
    toleranceDimensionalMm: null,
    toleranceColourDeltaE: null,
    shippingAmount: null,
    vatAmount: null,
    grossAmount: null,
    leadTimeDays: null,
    earliestShipDate: null,
    earliestDeliveryDate: null,
    toleranceShortagePct: null,
    toleranceOveragePct: null,
    shippingNetAmount: null,
    shippingVatAmount: null,
    shippingPending: false,
    shippingPendingReason: null,
  });
  // D-101: the one mock factory's weekly capacity. D-043: its machines stop at 450 mm.
  if (quantity > 200_000) return noPrice("not_instant");
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
    // Per piece incl. VAT, excluding shipping — the basis a target is compared on (D-247).
    unitPrice: baht(Math.round(productGross / quantity)),
    productAmount: baht(productGross),
    designFeeAmount: baht(designNet + vat(designNet)),
    structureDesignFeeAmount: baht(structureNet + vat(structureNet)),
    // The mock prices no plates or die blocks (v0.3.0 `toolingAmount`); the engine does.
    toolingAmount: baht(0),
    toolingWaiver: null,
    // D-186 platform defaults: ± 1 mm folding cartons (and tags & sleeves), ± 3 mm corrugated;
    // ΔE2000 ≤ 3 on printed work.
    toleranceDimensionalMm: DIMENSIONAL_TOLERANCE[inputs.configurator.calculator] ?? null,
    toleranceColourDeltaE: inputs.colours > 0 ? "3.00" : null,
    shippingAmount: baht(shippingGross),
    vatAmount: baht(vat(productNet) + vat(designNet) + vat(structureNet) + vat(shippingNet)),
    grossAmount: baht(productGross + designNet + vat(designNet) + structureNet + vat(structureNet) + shippingGross),
    leadTimeDays: lead,
    earliestShipDate: bangkokIso(Math.round(lead * 1.4) * DAY).slice(0, 10),
    earliestDeliveryDate: postcode ? bangkokIso((Math.round(lead * 1.4) + 2) * DAY).slice(0, 10) : null,
    toleranceShortagePct: "5.0000",
    toleranceOveragePct: "5.0000",
    shippingNetAmount: postcode ? baht(shippingNet) : null,
    shippingVatAmount: postcode ? baht(vat(shippingNet)) : null,
    shippingPending: !postcode,
    shippingPendingReason: postcode ? null : "no_postcode",
  };
}

/**
 * The same fake engine for the CS desk's published calculators (`../admin/sales.ts`, U-F0.3): a box
 * priced per quantity, so the back office and the storefront answer alike for the same spec.
 */
export function boxStepsOf(
  calculator: "folding" | "corrugate",
  box: { l: number; w: number; d: number; colours: number; extras: number; materialFactor: number },
  design: { graphic: boolean; structure: boolean },
  quantities: number[],
  postcode: string | undefined,
): Step[] {
  const inputs = {
    configurator: { calculator, size: { kind: "box" } } as unknown as Configurator,
    product: {} as Row,
    gusset: 0,
    quantities,
    dimensions: null,
    ids: new Set<string>(),
    ...box,
    ...design,
  } satisfies Inputs;
  return quantities.map((quantity) => stepOf(inputs, quantity, postcode));
}

/* ------------------------------------------------------------------------------ saved quotes */

export const PROMOTIONS: Record<
  string,
  { title: string; titleEn: string; pct: number; types?: string[]; cap?: number }
> = {
  GETPACK10: { title: "ลด 10% ค่าสินค้า", titleEn: "10% off the product", pct: 10 },
  FIRSTBOX: {
    title: "ลูกค้าใหม่ ลด 15% (สูงสุด ฿500)",
    titleEn: "New customers: 15% off (up to ฿500)",
    pct: 15,
    cap: 50_000,
  },
  CORRUGATE5: { title: "กล่องลูกฟูก ลด 5%", titleEn: "5% off corrugated boxes", pct: 5, types: ["corrugated"] },
};
const EXPIRED_CODES = new Set(["SUMMER2025"]);

export function checkCode(code: string, productTypeCode: string) {
  const key = code.trim().toUpperCase();
  if (EXPIRED_CODES.has(key)) return { key, promotion: null, reason: "expired" as const };
  const promotion = PROMOTIONS[key];
  if (!promotion) return { key, promotion: null, reason: "not_found" as const };
  if (promotion.types && !promotion.types.includes(productTypeCode))
    return { key, promotion: null, reason: "not_applicable" as const };
  return { key, promotion, reason: null };
}

/** A mock promotion as the customer sees it (`PromotionOfferDto`); the amount off is the cart's. */
function offerOf(key: string, status: Schemas["PromotionOfferStatus"], en: boolean): Schemas["PromotionOfferDto"] {
  const known = PROMOTIONS[key]!;
  return {
    code: key,
    title: en ? known.titleEn : known.title,
    description: null,
    status,
    validUntil: null,
    benefit: { type: "percent", pct: `${known.pct}.0000`, amount: null, maxAmount: known.cap ? baht(known.cap) : null },
    conditions: {
      firstOrderOnly: key === "FIRSTBOX",
      minOrderValue: null,
      minQuantity: null,
      paymentMethods: [],
      productTypeCodes: known.types ?? [],
    },
  };
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

type SpecLine = StoreQuote["specs"][number] & { prefixed?: string };

function specsOf(inputs: Inputs, raw: Record<string, unknown>, en: boolean): SpecLine[] {
  const { configurator } = inputs;
  const specs: SpecLine[] = [];
  const pattern = configurator.size.patterns.find((entry) => entry.id === raw.patternId);
  if (pattern) specs.push({ label: en ? "Style" : "รูปแบบ", value: pattern.name });
  // D-184: the style code rides on every summary (getpack-api `line-summary.ts`).
  if (pattern?.styleCode) specs.push({ label: en ? "Style code" : "รหัสแบบ", value: pattern.styleCode });
  if (configurator.size.kind !== "none") {
    const size = inputs.dimensions?.entered ?? { l: inputs.l, w: inputs.w, d: inputs.d };
    const dims = [size.l, size.w, configurator.size.kind === "box" && size.d ? size.d : null]
      .filter((value): value is number => value !== null)
      .join(" × ");
    const basis = inputs.dimensions?.basis;
    const on = basis && basis !== "product" ? ` (${en ? BASIS_EN[basis] : BASIS_TH[basis]})` : "";
    specs.push({ label: en ? "Size" : "ขนาด", value: `${dims} ${en ? "mm" : "มม."}${on}` });
  }
  for (const entry of configurator.groups) {
    const chosen = entry.options.filter((item) => inputs.ids.has(item.id));
    if (chosen.length > 0)
      specs.push({
        label: en ? entry.nameEn : entry.nameTh,
        value: chosen.map((item) => (en ? item.nameEn : item.nameTh)).join(", "),
      });
  }
  const inkRows = live(catalogueRows("inkColours"));
  if (configurator.calculator === "corrugate") {
    // B-API-3: a corrugate side is its method ("CMYK", "สีพิเศษ n สี (…)"), the label prefixes the side.
    const part = (Array.isArray(raw.parts) ? raw.parts[0] : null) as Record<string, unknown> | null;
    const sideOf = (value: unknown) => {
      const ids = (Array.isArray(value) ? value : []).map((entry) =>
        String((entry as { inkColourId?: unknown }).inkColourId),
      );
      const rows = inkRows.filter((row) => ids.includes(String(row.id)));
      if (rows.length === 0) return null;
      return rows.some((row) => row.colourKind === "process")
        ? "CMYK"
        : en
          ? `${rows.length} spot colour${rows.length > 1 ? "s" : ""} (${rows.map((row) => row.name).join(", ")})`
          : `สีพิเศษ ${rows.length} สี (${rows.map((row) => row.name).join(", ")})`;
    };
    for (const [key, field, th, enLabel] of [
      ["print_front", "printFront", "พิมพ์ด้านนอก", "Print (outside)"],
      ["print_back", "printBack", "พิมพ์ด้านใน", "Print (inside)"],
    ] as const) {
      const value = sideOf(part?.[field]);
      if (value) specs.push({ label: en ? enLabel : th, value, prefixed: key });
    }
  } else {
    const inks = inkRows.filter((row) => inputs.ids.has(String(row.id)));
    if (inks.length > 0)
      specs.push({ label: en ? "Print colours" : "สีพิมพ์", value: inks.map((row) => String(row.name)).join(", ") });
  }
  return specs;
}

/** D-441: what was priced, as the spec lines and as one string, in both languages. */
export function calculationSpecOf(
  inputs: Inputs,
  raw: Record<string, unknown>,
): Pick<Schemas["QuoteCalculationDto"], "specLabel" | "specs"> {
  const th = specsOf(inputs, raw, false);
  const en = specsOf(inputs, raw, true);
  return {
    specLabel: {
      th: th.map((spec) => (spec.prefixed ? `${spec.label}: ${spec.value}` : spec.value)).join(" · "),
      en: en.map((spec) => (spec.prefixed ? `${spec.label}: ${spec.value}` : spec.value)).join(" · "),
    },
    specs: th.map((spec, index) => ({
      key: `spec_${index + 1}`,
      labelTh: spec.label,
      labelEn: en[index]!.label,
      valueTh: spec.value,
      valueEn: en[index]!.value,
    })),
  };
}

const BASIS_TH: Record<Basis, string> = {
  internal: "ขนาดภายใน",
  external: "ขนาดภายนอก",
  over_crease: "ตามทับเส้น",
  product: "ขนาดชิ้นงาน",
};
const BASIS_EN: Record<Basis, string> = {
  internal: "inside",
  external: "outside",
  over_crease: "over the creases",
  product: "finished size",
};

/**
 * D-247: the gap of each instant quantity to the target (unit price incl. VAT excl. shipping, as
 * getpack-api compares it). The mock's own arithmetic on its own fake prices.
 */
export function gapOf(unitPrice: string, target: string): { gapPerUnit: string; gapPct: string; meetsTarget: boolean } {
  const unit = Math.round(Number(unitPrice) * 100);
  const goal = Math.round(Number(target) * 100);
  const gap = unit - goal;
  return {
    gapPerUnit: (gap / 100).toFixed(2),
    gapPct: ((gap / goal) * 100).toFixed(2),
    meetsTarget: gap <= 0,
  };
}

const MOCKUP_NET: Record<StoreQuote["mockupOption"], number> = { none: 0, with_print: 180_000, without_print: 90_000 };

export function buildQuote(
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

/* ------------------------------------------------------------------- the published quotation */

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** Quotations saved by the storefront, which have no code until shared or put in a PDF. */
export const uncoded = new Set<string>();
const sharedAt = new Map<string, string>();

/** What U2.1–U2.3 added to a saved quotation, kept beside the mock's own record. */
export interface QuoteFacts {
  dimensions?: Schemas["QuoteDimensionsDto"] | null;
  target?: string | null;
  advisory?: Schemas["QuoteAdvisoryDto"];
  fromLever?: Schemas["QuoteFromLeverDto"];
  outcome?: Schemas["QuoteOutcomeDto"];
}
export const quoteFacts = new Map<string, QuoteFacts>();

/** The board chosen from a recommendation (`./advisory.ts`), looked up when a quotation names it. */
let advisoryChoiceOf: (recommendationId: string) => { boardId: string; ref: Schemas["QuoteAdvisoryDto"] } | null = () =>
  null;
export function setAdvisoryLookup(lookup: typeof advisoryChoiceOf) {
  advisoryChoiceOf = lookup;
}
const pdfs = new Map<string, Schemas["QuotePdfStatus"]>();

/** A quotation's one option, as a stable id of its own. */
export const optionIdOf = (quote: StoreQuote) => quote.id.replace("-8000-", "-9000-");

const netOf = (quote: StoreQuote, lineType: StoreQuote["lines"][number]["lineType"]) =>
  quote.lines.find((line) => line.lineType === lineType)?.netAmount ?? "0.00";

/**
 * A saved quote's display summary. The quote keeps its spec lines in one language only, so none
 * are published; its catalogue product is named in both from the catalogue row.
 */
export function quoteSummaryOf(quote: StoreQuote): Schemas["LineSummaryDto"] {
  const product = productOfSlug(quote.product.slug);
  return {
    ...lineSummaryOf(quote.productType.code),
    unit: unitOf(quote.unit),
    specs: quote.specs.map((spec, index) => ({
      key: `spec_${index + 1}`,
      labelTh: spec.label,
      labelEn: spec.label,
      valueTh: spec.value,
      valueEn: spec.value,
    })),
    product: product
      ? {
          slug: quote.product.slug,
          nameTh: String(product.nameTh ?? quote.product.name),
          nameEn: String(product.nameEn ?? quote.product.name),
          imageUrl: quote.product.imageUrl,
        }
      : null,
  };
}

/** D-185: a share link lasts `configurations.share_link_days` (15) from when it was made. */
const SHARE_LINK_DAYS = 15;
const shareExpiryOf = (quoteId: string): string | null => {
  const at = sharedAt.get(quoteId);
  return at
    ? new Date(Date.parse(at) + SHARE_LINK_DAYS * 86_400_000 + 7 * 3_600_000).toISOString().replace("Z", "+07:00")
    : null;
};

export function toSavedQuote(quote: StoreQuote): Schemas["SavedQuoteDto"] {
  const expired = Date.parse(quote.validUntil) < Date.now();
  const shipping = quote.lines.find((line) => line.lineType === "shipping");
  const facts = quoteFacts.get(quote.id) ?? {};
  const target = facts.target ?? null;
  return {
    ...QUOTE_V2_EMPTY,
    dimensions: facts.dimensions ?? null,
    advisory: facts.advisory ?? null,
    targetPricePerUnit: target,
    fromLever: facts.fromLever ?? null,
    outcome: facts.outcome ?? null,
    shareExpiresAt: shareExpiryOf(quote.id),
    id: quote.id,
    quoteCode: uncoded.has(quote.id) ? null : quote.quoteCode,
    status: expired ? "expired" : quote.status,
    ...statusLabels("status", QUOTE_STATUS, expired ? "expired" : quote.status),
    source: quote.source,
    productTypeCode: quote.productType.code,
    summary: quoteSummaryOf(quote),
    configuration: quote.configuration as unknown as Schemas["FoldingConfigurationDto"],
    deliveryPostcode: quote.deliveryPostcode,
    options: [
      {
        id: optionIdOf(quote),
        quantity: quote.quantity,
        unitPrice: quote.unitPrice,
        productAmount: netOf(quote, "product"),
        designFeeAmount: netOf(quote, "design_fee"),
        structureDesignFeeAmount: netOf(quote, "structure_design_fee"),
        // The mock prices no plates or die blocks apart.
        toolingAmount: null,
        toolingWaiver: null,
        toleranceDimensionalMm: null,
        toleranceColourDeltaE: null,
        targetGap: target ? gapOf(quote.unitPrice, target) : null,
        shippingAmount: shipping ? shipping.netAmount : null,
        shippingPending: !shipping,
        shippingPendingReason: shipping ? null : "no_postcode",
        netAmount: quote.netAmount,
        vatAmount: quote.vatAmount,
        grossAmount: quote.grossAmount,
        leadTimeDays: quote.leadTimeDays,
        earliestShipDate: quote.earliestShipDate,
        earliestDeliveryDate: quote.estimatedDeliveryDate,
        toleranceShortagePct: quote.tolerance.shortagePct,
        toleranceOveragePct: quote.tolerance.overagePct,
      },
    ],
    priceLocked: !expired,
    validUntil: quote.validUntil,
    sharedAt: sharedAt.get(quote.id) ?? null,
    pdfStatus: pdfs.get(quote.id) ?? "none",
    currency: "THB",
    createdAt: quote.createdAt,
  };
}

/* ---------------------------------------------------------------------------------- handlers */

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");

export const storeQuoteHandlers: HttpHandler[] = [
  // Published (B2.3), mocked for every instant type in its own published configuration.
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
    const steps = inputs.quantities.map((quantity) => stepOf(inputs, quantity, body.deliveryPostcode));
    const target = body.targetPricePerUnit;
    const result: Schemas["QuoteCalculationDto"] = {
      // The mock records no calculations.
      calculationId: null,
      calculatorVersion: "mock-0.0.0",
      dimensions: inputs.dimensions,
      ...calculationSpecOf(inputs, body.configuration as unknown as Record<string, unknown>),
      target: target
        ? {
            targetPricePerUnit: target,
            steps: steps
              .filter((step) => step.instant && step.unitPrice)
              .map((step) => ({ quantity: step.quantity, ...gapOf(step.unitPrice!, target) })),
          }
        : null,
      steps,
    };
    return HttpResponse.json(result);
  }),

  // Published (`store.catalog.getConfigurator`, v0.3.0): the mock's view in the published shape.
  http.get("*/v1/store/catalog/products/:slug/configurator", ({ params }) => {
    const product = productOfSlug(params.slug as string);
    const configurator = product ? configuratorOf(product) : null;
    if (!configurator) return problem(404, "http.not_found", "สินค้านี้ขอใบเสนอราคาเท่านั้น");
    return HttpResponse.json(toStoreConfiguratorDto(configurator));
  }),

  // Published (U-F0.2): the saved quotation. One option per quantity it was given — the storefront
  // saves one — and no code until it is shared or its PDF is asked for.
  http.post("*/v1/store/quotes", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json().catch(() => null)) as Schemas["SaveQuoteDto"] | null;
    const raw = body?.configuration as unknown as (Record<string, unknown> & { quantities?: number[] }) | undefined;
    if (!body?.productTypeCode || !raw) return invalid("configuration", "required");
    const product = productOfId(raw.catalogProductId as string | undefined);
    if (!product) return problem(404, "http.not_found", "ไม่พบสินค้านี้");
    const quantity = raw.quantities?.[0];
    if (!quantity) return invalid("configuration.quantities", "ระบุจำนวน");
    const inputs = inputsOf(body.productTypeCode, { ...raw, quantities: [quantity] });
    if (inputs instanceof Response) return inputs;
    const design = raw.design as { graphic?: boolean } | undefined;
    const quote = buildQuote(
      inputs,
      raw,
      {
        quantity,
        ...(body.deliveryPostcode ? { deliveryPostcode: body.deliveryPostcode } : {}),
        designOption: design?.graphic ? "hired_design" : "own_file",
        mockupOption: "none",
      },
      english(request),
    );
    if (quote instanceof Response) return quote;
    if (body.advisoryRecommendationId) {
      const chosen = advisoryChoiceOf(body.advisoryRecommendationId);
      if (!chosen) return problem(409, "advisory.choice_required", "เลือกบอร์ดจากคำแนะนำก่อนบันทึกใบเสนอราคา");
      if (chosen.boardId !== raw.materialId)
        return problem(409, "advisory.choice_mismatch", "วัสดุไม่ตรงกับบอร์ดที่เลือกจากคำแนะนำ");
      quoteFacts.set(quote.id, { ...quoteFacts.get(quote.id), advisory: chosen.ref });
    }
    quoteFacts.set(quote.id, {
      ...quoteFacts.get(quote.id),
      dimensions: inputs.dimensions,
      target: body.targetPricePerUnit ?? null,
    });
    quotesOf(customer.persona).unshift(quote);
    uncoded.add(quote.id);
    return HttpResponse.json(toSavedQuote(quote), { status: 201 });
  }),

  http.get("*/v1/store/quotes", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const list = quotesOf(customer.persona)
      .map(toSavedQuote)
      .filter((quote) => !status || quote.status === status);
    return HttpResponse.json(
      paginate(list, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  // Before `:quoteId`, which would otherwise take "shared" for an id. Public: anyone with the link.
  http.get("*/v1/store/quotes/shared/:token", ({ params }) => {
    const share = shareTokens.get(String(params.token));
    const quote = share ? quotesOf(share.persona).find((candidate) => candidate.id === share.quoteId) : undefined;
    if (!share || !quote || Date.parse(share.expiresAt) < Date.now())
      return problem(404, "http.not_found", "ลิงก์นี้หมดอายุหรือไม่มีอยู่");
    return HttpResponse.json(toSavedQuote(quote));
  }),

  http.get("*/v1/store/quotes/:quoteId", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId);
    return quote ? HttpResponse.json(toSavedQuote(quote)) : notFound();
  }),

  http.post("*/v1/store/quotes/:quoteId/actions/share", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound();
    const shareToken = Array.from({ length: 43 }, () => TOKEN_ALPHABET[Math.floor(Math.random() * 64)]).join("");
    shareTokens.set(shareToken, { quoteId: quote.id, persona: customer.persona, expiresAt: quote.validUntil });
    if (quote.status === "saved") quote.status = "shared";
    uncoded.delete(quote.id);
    sharedAt.set(quote.id, bangkokIso());
    const result: Schemas["ShareQuoteResultDto"] = {
      quote: toSavedQuote(quote),
      expiresAt: shareExpiryOf(quote.id)!,
      shareToken,
      sharePath: `/quotes/shared/${shareToken}`,
    };
    return HttpResponse.json(result);
  }),

  http.post("*/v1/store/quotes/:quoteId/actions/request-pdf", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound();
    uncoded.delete(quote.id);
    pdfs.set(quote.id, "pending");
    return HttpResponse.json(toSavedQuote(quote), { status: 202 });
  }),

  // The mock renders at once: the first poll after the request finds it ready.
  http.get("*/v1/store/quotes/:quoteId/pdf", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound();
    const status = pdfs.get(quote.id) ?? "none";
    if (status === "pending") pdfs.set(quote.id, "ready");
    const pdf: Schemas["QuotePdfDto"] =
      status === "none"
        ? { status: "none", url: null, expiresAt: null }
        : {
            status: "ready",
            url: `data:text/plain;charset=utf-8,${encodeURIComponent(`ใบเสนอราคา ${quote.quoteCode} (ข้อมูลจำลอง) — Collective Group (Thailand)`)}`,
            expiresAt: bangkokIso(5),
          };
    return HttpResponse.json(pdf);
  }),

  // store.promotions.checkCode (public): the code's offer in its own terms; the amount is the cart's.
  http.post("*/v1/store/promotions/actions/check", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Schemas["CheckCodeDto"] | null;
    if (!body || !/^[A-Za-z0-9-]{3,40}$/.test(body.code ?? ""))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "code", code: "pattern", message: "code" },
      ]);
    const { key, promotion, reason } = checkCode(body.code, body.productTypeCode ?? "");
    const en = english(request);
    const offer = PROMOTIONS[key] ? offerOf(key, promotion ? "usable" : "not_applicable", en) : null;
    return HttpResponse.json({
      code: key,
      valid: Boolean(promotion),
      reason,
      offer,
    } satisfies Schemas["CodeCheckDto"]);
  }),

  // store.promotions.listMine: the codes a signed-in customer holds — a returning customer has two.
  http.get("*/v1/store/promotions/mine", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const en = english(request);
    const held: Schemas["PromotionOfferDto"][] =
      customer.ownerIndex === null
        ? [offerOf("FIRSTBOX", "usable", en)]
        : [offerOf("GETPACK10", "usable", en), offerOf("CORRUGATE5", "usable", en)];
    return HttpResponse.json(held);
  }),

  // store.support.getChannels (D-221): the CS Lead's setting, obviously fake.
  http.get("*/v1/store/support-channels", ({ request }) =>
    HttpResponse.json({
      lineOaId: "@getpack.mock",
      phone: "02-000-0000",
      email: "support@getpack.invalid",
      hours: english(request) ? "Mon–Sat 09:00–18:00 (mock data)" : "จันทร์–เสาร์ 09:00–18:00 (ข้อมูลจำลอง)",
    } satisfies Schemas["StoreSupportChannelsDto"]),
  ),
];
