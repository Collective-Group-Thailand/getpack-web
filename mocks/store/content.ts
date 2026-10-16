/**
 * Content that teaches (U5.6), standing in for three contract requests until getpack-api publishes
 * them: the customer glossary (the terms of `docs/ui/glossary.md`, our own wording), the materials
 * library over the back office's material rows, and learning paths over the mock's own articles.
 */

import type { z } from "zod";

import type { glossaryTerm, learningPath, materialCard } from "@/lib/api/requests/store-content";

import { catalogueRows } from "../admin/catalogue";
import { mockRequest } from "../route";
import { articles, catalogProducts, imageUrl, live } from "./catalog";

type Term = z.output<typeof glossaryTerm>;

/** The glossary's own wording (docs/ui/glossary.md); the slugs are what chips and help links point at. */
export const GLOSSARY: Term[] = [
  term(
    "dieline",
    "แผ่นคลี่ / ไดไลน์",
    "Dieline",
    "แบบกล่องที่กางออกเป็นแผ่นเรียบ ก่อนพับขึ้นรูป บอกตำแหน่งตัด พับ และทากาว",
    "The flat layout of a box before it is folded: where it is cut, creased and glued.",
    ["ไดไลน์", "แผ่นคลี่"],
  ),
  term(
    "die-cut",
    "ไดคัท",
    "Die-cut",
    "การตัดกระดาษเป็นรูปทรงด้วยบล็อกใบมีด ตามเส้นในไดไลน์",
    "Cutting board to shape with a steel-rule die, following the dieline.",
    ["ไดคัต"],
  ),
  term(
    "cutting-die",
    "บล็อกไดคัท",
    "Cutting die",
    "แม่พิมพ์ใบมีดที่ทำครั้งเดียวต่อแบบ ใช้ซ้ำได้เมื่อสั่งแบบเดิม",
    "The steel-rule tool, made once per design and reused on a reorder.",
    ["บล็อก"],
  ),
  term(
    "bleed",
    "ระยะตัดตก",
    "Bleed",
    "ส่วนของภาพที่เลยขอบตัดออกไป (ปกติ 3 มม.) เพื่อไม่ให้เห็นขอบขาวเมื่อตัดคลาดเล็กน้อย",
    "Artwork that runs past the trim edge (usually 3 mm) so a slightly off cut shows no white.",
    ["bleed"],
  ),
  term(
    "safe-zone",
    "พื้นที่ปลอดภัย",
    "Safe zone",
    "พื้นที่ด้านในเส้นตัด ที่ควรวางตัวอักษรและโลโก้ เพื่อไม่ให้ถูกตัดหรือพับทับ",
    "The area inside the cut where text and logos stay clear of cuts and folds.",
    ["safe area"],
  ),
  term(
    "crease",
    "เส้นพับ",
    "Crease",
    "รอยกดบนกระดาษเพื่อให้พับได้ตรง ไม่แตก",
    "A pressed line that makes the board fold cleanly without cracking.",
    ["fold line"],
  ),
  term(
    "e-flute",
    "ลอน E",
    "E-flute",
    "ลูกฟูกลอนบาง ประมาณ 1.5 มม. แข็งแรงพอสำหรับกล่องไปรษณีย์ และพิมพ์ได้สวย",
    "Thin corrugated flute, about 1.5 mm — strong enough for mailers and prints well.",
    ["ลอนอี", "E flute"],
  ),
  term(
    "b-flute",
    "ลอน B",
    "B-flute",
    "ลูกฟูกลอนกลาง ประมาณ 3 มม. รับแรงกดได้มากกว่าลอน E",
    "Medium corrugated flute, about 3 mm; takes more load than E-flute.",
    ["ลอนบี"],
  ),
  term(
    "ect",
    "ECT",
    "Edge crush test",
    "ค่าความแข็งแรงของลูกฟูกเมื่อถูกกดด้านข้าง ยิ่งสูงยิ่งซ้อนได้มาก",
    "How much edge-on pressure corrugated board takes; higher means it stacks better.",
    ["edge crush"],
  ),
  term(
    "gsm",
    "แกรม",
    "gsm",
    "น้ำหนักกระดาษต่อตารางเมตร ยิ่งมากกระดาษยิ่งหนา",
    "Grams per square metre — heavier usually means thicker board.",
    ["แกรม"],
  ),
  term(
    "spot-uv",
    "สปอตยูวี",
    "Spot UV",
    "เคลือบเงาเฉพาะจุด เช่น โลโก้ ให้เด่นกว่าพื้นด้าน",
    "Gloss coating on chosen areas, such as a logo, to stand out from a matt surface.",
    ["spot uv"],
  ),
  term(
    "offset",
    "ออฟเซ็ท",
    "Offset printing",
    "การพิมพ์ที่ให้สีคมและสม่ำเสมอ เหมาะกับงานจำนวนมาก มีค่าเพลทครั้งแรก",
    "Sharp, consistent printing for larger runs, with a one-off plate charge.",
    ["offset"],
  ),
  term(
    "digital-print",
    "พิมพ์ดิจิทัล",
    "Digital printing",
    "พิมพ์จากไฟล์โดยตรง ไม่ต้องทำเพลท เหมาะกับงานจำนวนน้อย",
    "Prints straight from the file with no plates — suits small runs.",
    ["digital"],
  ),
  term(
    "measurement-basis",
    "การวัดขนาด (ด้านใน/ด้านนอก)",
    "Measurement basis",
    "ขนาดด้านในคือพื้นที่ใส่ของ ด้านนอกคือขนาดกล่องจริง ต่างกันตามความหนาวัสดุ",
    "Inside size is the space for the goods; outside size is the box itself. They differ by the board's thickness.",
    ["ขนาดด้านใน", "ขนาดด้านนอก"],
  ),
];

function term(
  slug: string,
  termTh: string,
  termEn: string,
  definitionTh: string,
  definitionEn: string,
  aliases: string[],
): Term {
  return { slug, termTh, termEn, definitionTh, definitionEn, aliases };
}

type Material = z.output<typeof materialCard>;

const PRINT_METHODS = {
  offset: { code: "offset", nameTh: "ออฟเซ็ท", nameEn: "Offset" },
  digital: { code: "digital", nameTh: "ดิจิทัล", nameEn: "Digital" },
  flexo: { code: "flexo", nameTh: "เฟล็กโซ", nameEn: "Flexo" },
};

function materialOf(row: Record<string, unknown>, offeredOn: Material["offeredOn"]): Material {
  const kind = String(row.kind ?? "paper");
  const film = kind === "film";
  return {
    code: String(row.code),
    nameTh: String(row.nameTh ?? row.code),
    nameEn: String(row.nameEn ?? row.code),
    kind: (["paper", "board", "corrugated", "film"].includes(kind) ? kind : "other") as Material["kind"],
    descriptionTh: typeof row.descriptionTh === "string" ? row.descriptionTh : null,
    descriptionEn: typeof row.descriptionEn === "string" ? row.descriptionEn : null,
    imageUrl: imageUrl(row.imageFileId),
    caliperMm: typeof row.caliperMm === "number" ? row.caliperMm : null,
    gsm: typeof row.gsm === "number" ? row.gsm : null,
    flute: typeof row.flute === "string" ? row.flute : null,
    printMethods: film ? [PRINT_METHODS.flexo, PRINT_METHODS.digital] : [PRINT_METHODS.offset, PRINT_METHODS.digital],
    foodContact: row.isFoodGrade === true ? "approved" : "not_approved",
    recyclability: film
      ? "not_recyclable"
      : String(row.code).startsWith("kraft")
        ? "recyclable"
        : "recyclable_if_clean",
    offeredOn,
  };
}

export const contentHandlers = [
  // CONTRACT-REQUEST store.catalog-glossary
  mockRequest("GET /v1/store/catalog/glossary-terms", () => ({ data: GLOSSARY })),

  // CONTRACT-REQUEST store.catalog-materials
  mockRequest("GET /v1/store/catalog/materials", () => {
    // The configurator offers each kind's first four live rows (`optionGroups` in ./catalog), so a
    // material among them can be picked on every product; the rest are in the library only.
    const rows = live(catalogueRows("materials")).filter((row) => typeof row.code === "string");
    const offered = new Set(rows.slice(0, 4).map((row) => String(row.id)));
    const products = catalogProducts().slice(0, 3);
    return {
      data: rows.map((row) =>
        materialOf(
          row,
          offered.has(String(row.id))
            ? products.map((product) => ({
                productSlug: String(product.slug),
                nameTh: String(product.nameTh ?? product.slug),
                nameEn: String(product.nameEn ?? product.nameTh ?? product.slug),
                materialOptionId: String(row.id),
              }))
            : [],
        ),
      ),
    };
  }),

  // CONTRACT-REQUEST store.learning-paths
  mockRequest("GET /v1/store/learning-paths", () => {
    const published = articles();
    const steps = (from: number, count: number) =>
      published.slice(from, from + count).map((row) => ({
        articleSlug: String(row.slug),
        titleTh: String(row.titleTh),
        titleEn: typeof row.titleEn === "string" ? row.titleEn : null,
      }));
    const product = catalogProducts()[0];
    const firstMaterial = live(catalogueRows("materials"))[0];
    const paths: z.output<typeof learningPath>[] = [
      {
        slug: "first-order",
        titleTh: "สั่งกล่องครั้งแรก",
        titleEn: "Your first box order",
        summaryTh: "รู้จักประเภทกล่อง การวัดขนาด และขั้นตอนตั้งแต่สั่งจนได้ของ",
        summaryEn: "Box types, how to measure, and every step from order to delivery.",
        steps: steps(0, 3),
        action: {
          target: "configurator",
          productSlug: product ? String(product.slug) : null,
          materialOptionId: null,
          labelTh: "เริ่มกำหนดสเปกกล่อง",
          labelEn: "Start configuring a box",
        },
      },
      {
        slug: "save-on-materials",
        titleTh: "เลือกวัสดุให้ประหยัด",
        titleEn: "Choosing materials that save money",
        summaryTh: "แกรม ลอน และการเคลือบ เลือกอย่างไรให้แข็งแรงพอโดยไม่จ่ายเกิน",
        summaryEn: "Grammage, flutes and coatings — strong enough without paying for more.",
        steps: steps(1, 2),
        action: {
          target: "configurator",
          productSlug: product ? String(product.slug) : null,
          materialOptionId: firstMaterial ? String(firstMaterial.id) : null,
          labelTh: "ลองกับวัสดุที่แนะนำ",
          labelEn: "Try the suggested material",
        },
      },
      {
        slug: "print-ready-files",
        titleTh: "เตรียมไฟล์พิมพ์",
        titleEn: "Preparing print-ready files",
        summaryTh: "ระยะตัดตก พื้นที่ปลอดภัย ความละเอียดภาพ และการส่งไฟล์ให้ผ่านในครั้งเดียว",
        summaryEn: "Bleed, safe zone, image resolution, and sending files that pass first time.",
        steps: steps(0, 2),
        action: {
          target: "studio",
          productSlug: null,
          materialOptionId: null,
          labelTh: "เปิดสตูดิโอออกแบบ",
          labelEn: "Open the design studio",
        },
      },
    ];
    return { data: paths.filter((path) => path.steps.length > 0) };
  }),
];
