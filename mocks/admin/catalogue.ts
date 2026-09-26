/**
 * The published catalogue, CMS and geography surface (packio-api B2.1), mocked statefully:
 * every table through `./tables.ts` (ETag / If-Match, archive by status), plus the operations
 * that are not plain CRUD — changing a product type's quote mode, reordering home sections,
 * replacing an article's categories, and the Excel import (upload → preview → confirm) and
 * export. Typed by `Schemas` where a handler builds a body; rows are the contract's examples and
 * obviously fake variants.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { bangkokIso, mockId, problem } from "../support";
import { PRODUCT_TYPES } from "./catalog";
import { files } from "./platform";
import { etagOf, table, type Row, type TableConfig } from "./tables";

const R = "catalog.read";
const M = "catalog.manage";
const CMS = "cms.manage";
const GEO = "geography.manage";

const group = (code: string, nameTh: string, nameEn: string, sort: number) => ({ code, nameTh, nameEn, sort });

const typeId = (code: string) => PRODUCT_TYPES.find((type) => type.code === code)!.id;

const TABLES: Record<string, TableConfig> = {
  productTypes: {
    path: "/v1/admin/catalog/product-types",
    read: R,
    manage: M,
    ns: "typ",
    search: ["code", "nameTh", "nameEn"],
    filters: ["quoteMode"],
    unique: "code",
    examples: false,
    rows: PRODUCT_TYPES as unknown as Row[],
    defaultSort: "sort",
  },
  productCategories: {
    path: "/v1/admin/catalog/product-categories",
    read: R,
    manage: M,
    ns: "pct",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    examples: false,
    rows: PRODUCT_TYPES.map((type, index) => ({
      id: type.categoryId,
      code: type.code,
      nameTh: type.nameTh,
      nameEn: type.nameEn,
      parentId: null,
      sort: (index + 1) * 10,
      status: "active",
      updatedAt: type.updatedAt,
    })),
    defaultSort: "sort",
  },
  patterns: {
    path: "/v1/admin/catalog/patterns",
    read: R,
    manage: M,
    ns: "ptn",
    search: ["code", "name", "technicalName"],
    filters: ["productTypeId"],
    unique: "code",
    variants: [
      { code: "RSC-01", name: "กล่องฝาชน (RSC)", technicalName: "Regular slotted container", dielineKey: "rsc" },
      { code: "TRAY-01", name: "ถาดพับขึ้นรูป", technicalName: "Four-corner tray", dielineKey: "tray" },
      {
        code: "STE-01",
        name: "ฝาเสียบทางเดียว",
        technicalName: "Straight tuck end",
        dielineKey: null,
        status: "draft",
      },
    ],
  },
  subPatterns: {
    path: "/v1/admin/catalog/sub-patterns",
    read: R,
    manage: M,
    ns: "sbp",
    search: ["name"],
    filters: ["patternId"],
    variants: [{ name: "ฝาบน", seq: 2 }],
  },
  printTypes: {
    path: "/v1/admin/catalog/print-types",
    read: R,
    manage: M,
    ns: "prt",
    search: ["code", "nameTh", "nameEn"],
    filters: ["productTypeId"],
    unique: "code",
    variants: [
      { code: "folding_digital", nameTh: "ดิจิทัล", nameEn: "Digital", sort: 20, canChargePlateAndDie: false },
    ],
  },
  specTitles: {
    path: "/v1/admin/catalog/spec-titles",
    read: R,
    manage: M,
    ns: "spt",
    search: ["code", "nameTh", "nameEn"],
    filters: ["productTypeId"],
    unique: "code",
    variants: [
      { code: "finish", nameTh: "งานตกแต่ง", nameEn: "Finish", sort: 20 },
      { code: "print", nameTh: "การพิมพ์", nameEn: "Print", sort: 30 },
    ],
  },
  materialFamilies: {
    path: "/v1/admin/catalog/material-families",
    read: R,
    manage: M,
    ns: "mtf",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    variants: [
      { code: "kraft", nameTh: "กระดาษคราฟท์", nameEn: "Kraft" },
      { code: "corrugated", nameTh: "กระดาษลูกฟูก", nameEn: "Corrugated board" },
    ],
  },
  materials: {
    path: "/v1/admin/catalog/materials",
    read: R,
    manage: M,
    ns: "mat",
    search: ["code", "nameTh", "nameEn"],
    filters: ["kind", "familyId"],
    unique: "code",
    variants: [
      { code: "art-card-300", nameTh: "อาร์ตการ์ด 300 แกรม", nameEn: "Art card 300 gsm", gsm: 300 },
      { code: "art-card-400", nameTh: "อาร์ตการ์ด 400 แกรม", nameEn: "Art card 400 gsm", gsm: 400 },
      {
        code: "kraft-300",
        nameTh: "คราฟท์ 300 แกรม",
        nameEn: "Kraft 300 gsm",
        gsm: 300,
        paperGroup: "kraft",
        familyId: mockId("mtf", 1),
        outsideColour: "น้ำตาล",
        insideColour: "น้ำตาล",
      },
      {
        code: "greyback-350",
        nameTh: "กล่องแป้งหลังเทา 350 แกรม",
        nameEn: "Grey-back board 350 gsm",
        kind: "board",
        gsm: 350,
        insideColour: "เทา",
      },
      {
        code: "food-board-300",
        nameTh: "กระดาษฟู้ดเกรด 300 แกรม",
        nameEn: "Food-grade board 300 gsm",
        kind: "board",
        gsm: 300,
        isFoodGrade: true,
      },
      {
        code: "pet-film-50",
        nameTh: "ฟิล์ม PET 50 ไมครอน",
        nameEn: "PET film 50 µm",
        kind: "film",
        gsm: null,
        micron: 50,
        status: "draft",
      },
    ],
  },
  fluteTypes: {
    path: "/v1/admin/catalog/flute-types",
    read: R,
    manage: M,
    ns: "flt",
    search: ["code", "name"],
    unique: "code",
    variants: [
      { code: "E", name: "ลอน E (3 ชั้น)", layers: 3, colA: 1.14, colC: 1.18 },
      { code: "B", name: "ลอน B (3 ชั้น)", layers: 3, colA: 1.32, colC: 1.36 },
      { code: "C", name: "ลอน C (3 ชั้น)", layers: 3, colA: 1.42, colC: 1.46 },
    ],
  },
  finishGroups: {
    path: "/v1/admin/catalog/finish-groups",
    read: R,
    manage: M,
    ns: "fng",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    variants: [group("special", "งานพิเศษ", "Special finishes", 20)],
  },
  finishes: {
    path: "/v1/admin/catalog/finishes",
    read: R,
    manage: M,
    ns: "fin",
    search: ["code", "nameTh", "nameEn"],
    filters: ["groupId", "finishKind"],
    unique: "code",
    variants: [
      { code: "gloss-lamination", nameTh: "เคลือบเงา", nameEn: "Gloss lamination" },
      {
        code: "spot-uv",
        nameTh: "สปอตยูวี",
        nameEn: "Spot UV",
        finishKind: "spot_uv",
        requiresWidth: true,
        requiresLength: true,
      },
      {
        code: "hot-foil",
        nameTh: "ปั๊มฟอยล์",
        nameEn: "Hot foil",
        finishKind: "foil",
        isSpecial: true,
        requiresWidth: true,
        requiresLength: true,
      },
      {
        code: "emboss",
        nameTh: "ปั๊มนูน",
        nameEn: "Emboss",
        finishKind: "emboss",
        isSpecial: true,
        requiresWidth: true,
        requiresLength: true,
      },
    ],
  },
  foilTypes: {
    path: "/v1/admin/catalog/foil-types",
    read: R,
    manage: M,
    ns: "fol",
    search: ["code", "name"],
    unique: "code",
    variants: [
      { code: "silver", name: "ฟอยล์เงิน" },
      { code: "rose-gold", name: "ฟอยล์โรสโกลด์" },
    ],
  },
  inkColourGroups: {
    path: "/v1/admin/catalog/ink-colour-groups",
    read: R,
    manage: M,
    ns: "icg",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    variants: [group("pantone", "สีพิเศษ Pantone", "Pantone", 20)],
  },
  inkColours: {
    path: "/v1/admin/catalog/ink-colours",
    read: R,
    manage: M,
    ns: "ink",
    search: ["code", "name"],
    filters: ["groupId"],
    unique: "code",
    variants: [
      { code: "cmyk-m", name: "Magenta" },
      { code: "cmyk-y", name: "Yellow" },
      { code: "cmyk-k", name: "Black" },
    ],
  },
  diecutGroups: {
    path: "/v1/admin/catalog/diecut-groups",
    read: R,
    manage: M,
    ns: "dcg",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    examples: false,
    rows: [
      {
        id: mockId("dcg", 1),
        ...group("diecut", "ไดคัท", "Die-cut", 10),
        status: "active",
        updatedAt: bangkokIso(-3000),
      },
    ],
  },
  diecutTypes: {
    path: "/v1/admin/catalog/diecut-types",
    read: R,
    manage: M,
    ns: "dct",
    search: ["code", "nameTh", "nameEn"],
    filters: ["groupId"],
    unique: "code",
    variants: [{ code: "window", nameTh: "เจาะหน้าต่าง", nameEn: "Window cut" }],
  },
  assemblyGroups: {
    path: "/v1/admin/catalog/assembly-groups",
    read: R,
    manage: M,
    ns: "asg",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    examples: false,
    rows: [
      {
        id: mockId("asg", 1),
        ...group("gluing", "การปะกาว", "Gluing", 10),
        status: "active",
        updatedAt: bangkokIso(-3000),
      },
    ],
  },
  assemblies: {
    path: "/v1/admin/catalog/assemblies",
    read: R,
    manage: M,
    ns: "asm",
    search: ["code", "nameTh", "nameEn"],
    filters: ["groupId"],
    unique: "code",
    variants: [{ code: "crash-lock", nameTh: "ปะกาวล็อกก้น", nameEn: "Crash-lock bottom" }],
  },
  difficultyGroups: {
    path: "/v1/admin/catalog/difficulty-level-groups",
    read: R,
    manage: M,
    ns: "dlg",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    examples: false,
    rows: [
      {
        id: mockId("dlg", 1),
        ...group("assembly", "ความยากงานขึ้นรูป", "Assembly difficulty", 10),
        status: "active",
        updatedAt: bangkokIso(-3000),
      },
    ],
  },
  difficultyLevels: {
    path: "/v1/admin/catalog/difficulty-levels",
    read: R,
    manage: M,
    ns: "dfl",
    search: ["code", "nameTh", "nameEn"],
    filters: ["groupId"],
    unique: "code",
    variants: [
      { code: "level-1", nameTh: "ระดับ 1", nameEn: "Level 1", sort: 10 },
      { code: "level-3", nameTh: "ระดับ 3", nameEn: "Level 3", sort: 30 },
    ],
  },
  packingTypes: {
    path: "/v1/admin/catalog/packing-types",
    read: R,
    manage: M,
    ns: "pkt",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    variants: [{ code: "shrink", nameTh: "ห่อฟิล์มหด", nameEn: "Shrink-wrapped" }],
  },
  catalogProducts: {
    path: "/v1/admin/catalog/catalog-products",
    read: R,
    manage: M,
    ns: "ctp",
    search: ["slug", "nameTh", "nameEn"],
    filters: ["productTypeId"],
    unique: "slug",
    // One product per D-100 type the storefront shows, so the catalogue has something to
    // browse; the variants merge over the contract's tuck-end example, hence `images: []`.
    variants: [
      {
        slug: "mailer-box",
        nameTh: "กล่องไปรษณีย์",
        nameEn: "Mailer box",
        descriptionTh: "กล่องลูกฟูกพิมพ์ลาย",
        productTypeId: typeId("corrugated"),
        images: [],
        sort: 20,
      },
      { slug: "tray-box", nameTh: "กล่องถาด", nameEn: "Tray box", sort: 30, status: "draft" },
      {
        slug: "shipping-box",
        nameTh: "กล่องลูกฟูกฝาชน",
        nameEn: "Regular slotted carton",
        descriptionTh: "กล่องขนส่งลอน B หรือ C สำหรับส่งสินค้าจำนวนมาก (ข้อมูลจำลอง)",
        descriptionEn: "A B- or C-flute shipping carton (mock data)",
        productTypeId: typeId("corrugated"),
        templateAvailability: "online_template",
        images: [],
        sort: 40,
      },
      {
        slug: "product-label",
        nameTh: "สติ๊กเกอร์ฉลากสินค้า",
        nameEn: "Product label",
        descriptionTh: "ฉลากไดคัทตามรูปทรง กันน้ำ (ข้อมูลจำลอง)",
        descriptionEn: "Die-cut waterproof labels (mock data)",
        productTypeId: typeId("label_sticker"),
        templateAvailability: "online_template",
        images: [],
        patterns: [],
        sort: 50,
      },
      {
        slug: "hang-tag",
        nameTh: "ป้ายแท็กห้อยสินค้า",
        nameEn: "Hang tag",
        descriptionTh: "ป้ายแท็กกระดาษอาร์ตการ์ดเจาะรู (ข้อมูลจำลอง)",
        descriptionEn: "Punched art-card hang tags (mock data)",
        productTypeId: typeId("tag_sleeve"),
        templateAvailability: "none",
        images: [],
        patterns: [],
        sort: 60,
      },
      {
        slug: "stand-up-pouch",
        nameTh: "ซองตั้งได้ซิปล็อก",
        nameEn: "Stand-up zip pouch",
        descriptionTh: "ซองฟอยล์ก้นตั้ง ซิปล็อก สำหรับอาหารแห้ง (ข้อมูลจำลอง)",
        descriptionEn: "Foil stand-up pouch with a zip, for dry food (mock data)",
        productTypeId: typeId("flexible_pouch"),
        templateAvailability: "none",
        images: [],
        patterns: [],
        sort: 70,
      },
      {
        slug: "magnetic-gift-box",
        nameTh: "กล่องแข็งฝาแม่เหล็ก",
        nameEn: "Magnetic gift box",
        descriptionTh: "กล่องจั่วปังหุ้มกระดาษ ปิดด้วยแม่เหล็ก ขอใบเสนอราคา (ข้อมูลจำลอง)",
        descriptionEn: "A wrapped rigid box with a magnetic flap; quoted on request (mock data)",
        productTypeId: typeId("rigid_box"),
        templateAvailability: "none",
        images: [],
        patterns: [],
        sort: 80,
      },
      {
        slug: "kraft-paper-bag",
        nameTh: "ถุงกระดาษคราฟท์หูเกลียว",
        nameEn: "Kraft paper bag",
        descriptionTh: "ถุงกระดาษคราฟท์หูเกลียว พิมพ์โลโก้ ขอใบเสนอราคา (ข้อมูลจำลอง)",
        descriptionEn: "A twisted-handle kraft bag with a printed logo; quoted on request (mock data)",
        productTypeId: typeId("paper_bag"),
        templateAvailability: "none",
        images: [],
        patterns: [],
        sort: 90,
      },
    ],
  },
  standardSizes: {
    path: "/v1/admin/catalog/standard-sizes",
    read: R,
    manage: M,
    ns: "sts",
    search: ["code", "name"],
    filters: ["catalogProductId"],
    variants: [
      { code: "M", name: "ขนาดกลาง 15×15×7 ซม.", lengthMm: 150, widthMm: 150, heightMm: 70, sort: 20 },
      { code: "L", name: "ขนาดใหญ่ 20×20×10 ซม.", lengthMm: 200, widthMm: 200, heightMm: 100, sort: 30 },
    ],
  },
  stockAttributeValues: {
    path: "/v1/admin/catalog/stock-attribute-values",
    read: R,
    manage: M,
    ns: "sav",
    search: ["code", "nameTh", "nameEn"],
    filters: ["attribute"],
    variants: [
      { code: "amber", nameTh: "ชา", nameEn: "Amber", sort: 20 },
      { code: "white", nameTh: "ขาว", nameEn: "White", sort: 30 },
    ],
  },
  stockProducts: {
    path: "/v1/admin/catalog/stock-products",
    read: R,
    manage: M,
    ns: "stk",
    search: ["sku", "nameTh", "nameEn"],
    filters: ["productTypeId"],
    unique: "sku",
    variants: [
      { sku: "PET-500", nameTh: "ขวด PET 500 มล.", nameEn: "PET bottle 500 ml", capacityMl: 500, heightMm: 190 },
      {
        sku: "JAR-100",
        nameTh: "กระปุก PP 100 มล.",
        nameEn: "PP jar 100 ml",
        capacityMl: 100,
        heightMm: 55,
        lengthMm: 70,
      },
      {
        sku: "BAG-KR-M",
        nameTh: "ถุงคราฟท์ก้นตั้ง กลาง",
        nameEn: "Kraft stand-up bag M",
        capacityMl: null,
        isFoodGrade: true,
        minOrderQty: 500,
      },
    ],
  },
  semiDesigns: {
    path: "/v1/admin/catalog/semi-designs",
    read: R,
    manage: M,
    ns: "smd",
    search: ["name"],
    filters: ["catalogProductId"],
    variants: [{ name: "ธรรมชาติ โทนเขียว" }, { name: "ป๊อปอาร์ต สีสด", status: "draft" }],
  },
  semiDesignTemplates: {
    path: "/v1/admin/catalog/semi-design-templates",
    read: R,
    manage: M,
    ns: "sdt",
    search: [],
    filters: ["semiDesignId"],
  },
  designFonts: {
    path: "/v1/admin/catalog/design-fonts",
    read: R,
    manage: M,
    ns: "dfn",
    search: ["name"],
    variants: [{ name: "Sarabun" }, { name: "Prompt" }],
  },
  showcaseCategories: {
    path: "/v1/admin/catalog/showcase-categories",
    read: R,
    manage: M,
    ns: "shc",
    search: ["slug", "nameTh", "nameEn"],
    unique: "slug",
    variants: [{ slug: "food", nameTh: "บรรจุภัณฑ์อาหาร", nameEn: "Food packaging", sort: 20 }],
  },
  showcaseProducts: {
    path: "/v1/admin/catalog/showcase-products",
    read: R,
    manage: M,
    ns: "shp",
    search: ["nameTh", "nameEn"],
    filters: ["categoryId", "catalogProductId"],
  },
  provinces: {
    path: "/v1/admin/geography/provinces",
    read: R,
    manage: GEO,
    ns: "gpv",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    variants: [
      { code: "50", nameTh: "เชียงใหม่", nameEn: "Chiang Mai", region: "north" },
      { code: "20", nameTh: "ชลบุรี", nameEn: "Chon Buri", region: "east" },
    ],
  },
  districts: {
    path: "/v1/admin/geography/districts",
    read: R,
    manage: GEO,
    ns: "gdt",
    search: ["code", "nameTh", "nameEn"],
    filters: ["provinceId"],
    unique: "code",
    variants: [{ code: "1002", nameTh: "ดุสิต", nameEn: "Dusit" }],
  },
  subdistricts: {
    path: "/v1/admin/geography/subdistricts",
    read: R,
    manage: GEO,
    ns: "gsd",
    search: ["code", "nameTh", "nameEn", "postcode"],
    filters: ["districtId", "postcode"],
    unique: "code",
    variants: [{ code: "100102", nameTh: "วังบูรพาภิรมย์", nameEn: "Wang Burapha Phirom" }],
  },
  banners: {
    path: "/v1/admin/cms/banners",
    read: CMS,
    manage: CMS,
    ns: "bnr",
    search: ["title"],
    filters: ["position"],
    deletable: true,
    defaultSort: "sort",
    variants: [
      {
        title: "ส่วนลดสมาชิกใหม่",
        position: "home_strip",
        sort: 20,
        targetUrl: "/th/promotions",
        validFrom: null,
        validTo: null,
      },
      { title: "บรรจุภัณฑ์อาหารสำหรับร้านกาแฟ", position: "category", sort: 30, status: "draft" },
    ],
  },
  homeSections: {
    path: "/v1/admin/cms/home-sections",
    read: CMS,
    manage: CMS,
    ns: "hms",
    search: ["slug", "titleTh", "titleEn"],
    unique: "slug",
    deletable: true,
    defaultSort: "sort",
    variants: [
      {
        slug: "product-types",
        kind: "product_types",
        titleTh: "ประเภทบรรจุภัณฑ์",
        titleEn: "Packaging types",
        sort: 20,
        config: {},
      },
      {
        slug: "showcase",
        kind: "showcase",
        titleTh: "ผลงานลูกค้า",
        titleEn: "Customer showcase",
        sort: 30,
        config: { limit: 8 },
      },
      { slug: "articles", kind: "articles", titleTh: "บทความ", titleEn: "Articles", sort: 40, config: { limit: 3 } },
    ],
  },
  articleCategories: {
    path: "/v1/admin/cms/article-categories",
    read: CMS,
    manage: CMS,
    ns: "arc",
    search: ["slug", "nameTh", "nameEn"],
    unique: "slug",
    variants: [{ slug: "brand-stories", nameTh: "เรื่องเล่าแบรนด์", nameEn: "Brand stories", sort: 20 }],
  },
  articles: {
    path: "/v1/admin/cms/articles",
    read: CMS,
    manage: CMS,
    ns: "art",
    search: ["slug", "titleTh", "titleEn"],
    filters: ["categoryId"],
    unique: "slug",
    deletable: true,
    variants: [
      {
        slug: "choosing-box-paper",
        titleTh: "เลือกกระดาษทำกล่องอย่างไรให้เหมาะกับสินค้า",
        titleEn: "Choosing the right board for your box",
        excerptTh: "อาร์ตการ์ด คราฟท์ หรือลูกฟูก — ต่างกันอย่างไร (ข้อมูลจำลอง)",
        excerptEn: "Art card, kraft or corrugated: what differs (mock data)",
        status: "published",
        publishedAt: "2026-09-20T09:00:00+07:00",
        body: {
          th: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "กระดาษแต่ละชนิดเหมาะกับงานต่างกัน " },
                  { type: "text", marks: [{ type: "bold" }], text: "บทความนี้เป็นข้อมูลจำลอง" },
                  { type: "text", text: " สำหรับทดสอบหน้าบทความ" },
                ],
              },
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "อาร์ตการ์ด" }] },
              {
                type: "paragraph",
                content: [{ type: "text", text: "ผิวเรียบ พิมพ์สีสด เหมาะกับกล่องเครื่องสำอางและอาหารเสริม" }],
              },
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "สิ่งที่ควรพิจารณา" }] },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "น้ำหนักสินค้า" }] }],
                  },
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "การขนส่ง" }] }] },
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "ดู" },
                          {
                            type: "text",
                            marks: [{ type: "link", attrs: { href: "/products" } }],
                            text: "สินค้าทั้งหมด",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        slug: "food-safe-packaging",
        titleTh: "บรรจุภัณฑ์สัมผัสอาหารต้องรู้อะไรบ้าง",
        excerptTh: "วัสดุ การเคลือบ และมาตรฐานที่เกี่ยวข้อง",
        status: "draft",
        publishedAt: null,
        body: {
          th: {
            type: "doc",
            content: [
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "วัสดุที่ใช้ได้" }] },
              {
                type: "paragraph",
                content: [{ type: "text", text: "กระดาษฟู้ดเกรดและการเคลือบกันซึม (ข้อมูลจำลอง)" }],
              },
            ],
          },
        },
      },
    ],
  },
  faqCategories: {
    path: "/v1/admin/cms/faq-categories",
    read: CMS,
    manage: CMS,
    ns: "fqc",
    search: ["code", "nameTh", "nameEn"],
    unique: "code",
    variants: [{ code: "shipping", nameTh: "การจัดส่ง", nameEn: "Shipping", sort: 20 }],
  },
  faqs: {
    path: "/v1/admin/cms/faqs",
    read: CMS,
    manage: CMS,
    ns: "faq",
    search: ["questionTh", "questionEn"],
    filters: ["categoryId"],
    deletable: true,
    variants: [
      {
        questionTh: "ผลิตกี่วัน",
        answerTh: "ดูระยะผลิตในใบเสนอราคาแต่ละรายการ",
        questionEn: null,
        answerEn: null,
        sort: 20,
      },
      { questionTh: "ขอตัวอย่างจริงได้ไหม", answerTh: "ได้ เป็นบริการเสริมแบบมีค่าใช้จ่าย", sort: 30, status: "draft" },
    ],
  },
  videos: {
    path: "/v1/admin/cms/videos",
    read: CMS,
    manage: CMS,
    ns: "vid",
    search: ["title", "url"],
    filters: ["subjectType", "subjectId"],
    deletable: true,
  },
  seoPages: {
    path: "/v1/admin/cms/seo-pages",
    read: "seo.manage",
    manage: "seo.manage",
    ns: "seo",
    search: ["pageKey", "titleTh", "titleEn"],
    unique: "pageKey",
    variants: [
      {
        pageKey: "/th",
        titleTh: "Packio — ผลิตบรรจุภัณฑ์ออนไลน์",
        h1: null,
        descriptionTh: "ออกแบบ สั่งผลิต ติดตามงาน ในที่เดียว",
        keywords: null,
      },
      { pageKey: "/th/rfq", titleTh: "ขอใบเสนอราคาบรรจุภัณฑ์", noindex: true, keywords: null },
    ],
  },
};

const stores = Object.fromEntries(Object.entries(TABLES).map(([key, config]) => [key, table(config)])) as Record<
  keyof typeof TABLES,
  ReturnType<typeof table>
>;

/**
 * The live rows of one table — the storefront mock (`mocks/store/catalog.ts`) reads the same
 * state the back office edits, so publishing a product in admin shows it in the shop.
 */
export function catalogueRows(table: keyof typeof TABLES): Row[] {
  return stores[table]!.rows;
}

/* ------------------------------------------------------------------------ not plain CRUD */

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");

/** Excel import kinds, as `GET /v1/admin/catalog/imports` describes them (B2.1). */
const IMPORT_KINDS: Schemas["ImportKindDto"][] = [
  {
    kind: "materials",
    label: "วัสดุ",
    sheets: [
      {
        name: "materials",
        key: ["code"],
        columns: [
          { header: "code", type: "text", required: true, values: null },
          {
            header: "kind",
            type: "enum",
            required: true,
            values: ["paper", "board", "corrugated_board", "film", "foil", "label_stock", "other"],
          },
          { header: "name_th", type: "text", required: true, values: null },
          { header: "name_en", type: "text", required: true, values: null },
          { header: "gsm", type: "decimal", required: false, values: null },
          { header: "family_code", type: "ref", required: false, values: null },
          { header: "status", type: "enum", required: true, values: ["draft", "active", "inactive", "archived"] },
        ],
      },
    ],
  },
  {
    kind: "stock_products",
    label: "สินค้าสต็อก",
    sheets: [
      {
        name: "stock_products",
        key: ["sku"],
        columns: [
          { header: "sku", type: "text", required: true, values: null },
          { header: "product_type_code", type: "ref", required: true, values: null },
          { header: "name_th", type: "text", required: true, values: null },
          { header: "name_en", type: "text", required: true, values: null },
          {
            header: "unit",
            type: "enum",
            required: true,
            values: ["piece", "box", "pouch", "tube", "set", "job", "round", "trip"],
          },
          { header: "min_order_qty", type: "int", required: true, values: null },
          { header: "is_food_grade", type: "bool", required: false, values: null },
        ],
      },
      {
        name: "attributes",
        key: ["sku", "attribute"],
        columns: [
          { header: "sku", type: "ref", required: true, values: null },
          { header: "attribute", type: "text", required: true, values: null },
          { header: "value_code", type: "ref", required: true, values: null },
        ],
      },
    ],
  },
  ...(
    [
      ["geography", "จังหวัด อำเภอ ตำบล และรหัสไปรษณีย์"],
      ["finishes", "งานตกแต่ง"],
      ["ink_colours", "สีหมึก"],
      ["patterns", "รูปแบบกล่อง"],
      ["standard_sizes", "ขนาดมาตรฐาน"],
      ["stock_attribute_values", "ค่าคุณสมบัติสินค้าสต็อก"],
    ] as const
  ).map(([kind, label]) => ({
    kind,
    label,
    sheets: [
      {
        name: kind,
        key: ["code"],
        columns: [
          { header: "code", type: "text", required: true, values: null },
          { header: "name_th", type: "text", required: true, values: null },
          { header: "name_en", type: "text", required: false, values: null },
        ],
      },
    ],
  })),
];

const sha = (fileId: string) => fileId.replace(/-/g, "").padEnd(64, "0").slice(0, 64);

function previewOf(kind: Schemas["CatalogImportKind"], fileId: string): Schemas["ImportPreviewDto"] {
  const name = files.get(fileId)?.originalName ?? "";
  const broken = /error|ผิด/i.test(name);
  const sheets = (IMPORT_KINDS.find((item) => item.kind === kind)?.sheets ?? []).map((sheet, index) => ({
    name: sheet.name,
    create: index === 0 ? 12 : 4,
    update: index === 0 ? 3 : 0,
    unchanged: index === 0 ? 40 : 10,
    invalid: broken && index === 0 ? 2 : 0,
  }));
  const totals = sheets.reduce(
    (sum, sheet) => ({
      create: sum.create + sheet.create,
      update: sum.update + sheet.update,
      unchanged: sum.unchanged + sheet.unchanged,
      invalid: sum.invalid + sheet.invalid,
    }),
    { create: 0, update: 0, unchanged: 0, invalid: 0 },
  );
  return {
    kind,
    fileId,
    previewSha256: sha(fileId),
    sheets,
    totals,
    canConfirm: totals.invalid === 0 && totals.create + totals.update > 0,
    errors: broken
      ? [
          { sheet: sheets[0]!.name, row: 7, column: "code", code: "duplicate", message: "รหัสซ้ำกับแถวที่ 4" },
          { sheet: sheets[0]!.name, row: 12, column: "name_th", code: "required", message: "ต้องระบุชื่อภาษาไทย" },
        ]
      : [],
    errorsTruncated: false,
  };
}

const special: HttpHandler[] = [
  http.post("*/v1/admin/catalog/product-types/:id/actions/change-quote-mode", async ({ request, params }) => {
    if (!can(staffPersonaOf(request), M)) return forbidden();
    const row = stores.productTypes.rows.find((candidate) => candidate.id === params.id);
    if (!row) return problem(404, "http.not_found", "ไม่พบประเภทสินค้านี้");
    const match = request.headers.get("if-match");
    if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
    if (match !== etagOf(row)) return problem(412, "http.precondition_failed", "รายการนี้ถูกแก้ไขไปแล้ว");
    const body = (await request.json()) as Schemas["ChangeQuoteModeDto"];
    if (body.quoteMode === "instant" && !row.calculatorKey) {
      return problem(
        409,
        "catalog.calculator_not_shipped",
        "ยังไม่มีเครื่องคำนวณราคาสำหรับประเภทนี้ จึงเปิดราคาทันทีไม่ได้ (D-100)",
      );
    }
    Object.assign(row, { quoteMode: body.quoteMode, updatedAt: bangkokIso() });
    return HttpResponse.json(row, { headers: { ETag: etagOf(row) } });
  }),
  http.post("*/v1/admin/cms/home-sections/actions/reorder", async ({ request }) => {
    if (!can(staffPersonaOf(request), CMS)) return forbidden();
    const { ids } = (await request.json()) as Schemas["ReorderDto"];
    const rows = stores.homeSections.rows;
    if (ids.length !== rows.length || !rows.every((row) => ids.includes(row.id))) {
      return problem(422, "validation.failed", "ต้องส่งทุกส่วนในลำดับใหม่", [
        { path: "ids", code: "set", message: "ต้องมีทุกส่วนครบ" },
      ]);
    }
    ids.forEach((id, index) => {
      const row = rows.find((candidate) => candidate.id === id)!;
      row.sort = (index + 1) * 10;
      row.updatedAt = bangkokIso();
    });
    return HttpResponse.json([...rows].sort((a, b) => Number(a.sort) - Number(b.sort)));
  }),
  http.put("*/v1/admin/cms/articles/:id/categories", async ({ request, params }) => {
    if (!can(staffPersonaOf(request), CMS)) return forbidden();
    const row = stores.articles.rows.find((candidate) => candidate.id === params.id);
    if (!row) return problem(404, "http.not_found", "ไม่พบบทความนี้");
    const match = request.headers.get("if-match");
    if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
    if (match !== etagOf(row)) return problem(412, "http.precondition_failed", "บทความนี้ถูกแก้ไขไปแล้ว");
    const body = (await request.json()) as { categoryIds: string[] };
    Object.assign(row, { categoryIds: body.categoryIds, updatedAt: bangkokIso() });
    return HttpResponse.json(row, { headers: { ETag: etagOf(row) } });
  }),
  http.get("*/v1/admin/catalog/imports", ({ request }) =>
    can(staffPersonaOf(request), "catalog.import") ? HttpResponse.json(IMPORT_KINDS) : forbidden(),
  ),
  http.post("*/v1/admin/catalog/imports/:kind/actions/preview", async ({ request, params }) => {
    if (!can(staffPersonaOf(request), "catalog.import")) return forbidden();
    const { fileId } = (await request.json()) as Schemas["ImportFileDto"];
    if (!files.has(fileId)) return problem(404, "files.not_found", "ไม่พบไฟล์ที่อัปโหลด");
    return HttpResponse.json(previewOf(params.kind as Schemas["CatalogImportKind"], fileId));
  }),
  http.post("*/v1/admin/catalog/imports/:kind/actions/confirm", async ({ request, params }) => {
    if (!can(staffPersonaOf(request), "catalog.import")) return forbidden();
    if (!request.headers.get("idempotency-key"))
      return problem(400, "http.idempotency_key_required", "ต้องส่ง Idempotency-Key");
    const body = (await request.json()) as Schemas["ConfirmImportDto"];
    const preview = previewOf(params.kind as Schemas["CatalogImportKind"], body.fileId);
    if (body.previewSha256 !== preview.previewSha256)
      return problem(409, "import.preview_mismatch", "ไฟล์เปลี่ยนไปจากที่ตรวจล่าสุด กรุณาตรวจใหม่");
    if (!preview.canConfirm) return problem(422, "import.invalid_rows", "ยังมีแถวที่ผิดพลาด แก้ไขไฟล์แล้วตรวจใหม่");
    return HttpResponse.json(preview);
  }),
  http.post("*/v1/admin/catalog/exports/:kind", ({ request, params }) => {
    if (!can(staffPersonaOf(request), "catalog.import")) return forbidden();
    const text = `Packio catalogue export: ${String(params.kind)} (ข้อมูลจำลอง)`;
    return HttpResponse.json({
      fileId: mockId("exp", 7),
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
      rows: 55,
      expiresAt: bangkokIso(5),
    } satisfies Schemas["CatalogExportDto"]);
  }),
];

// The special routes first: `…/actions/…` would otherwise be read as an `:id`.
export const catalogueHandlers: HttpHandler[] = [
  ...special,
  ...Object.values(stores).flatMap((store) => store.handlers),
];
