/**
 * Storefront content that teaches (U5.6, U5.2): the glossary, the materials library and buyer
 * learning paths. packio-api keeps the glossary (`glossary_terms`, `admin.cmsGlossaryTerms`) and the
 * materials (`admin.catalogMaterials`) for staff only at v0.41.0, and has no learning paths, so the
 * storefront asks for public reads of each. All three are open to guests (`public`).
 */

import { z } from "zod";

import { request } from "./define";

export const glossaryTerm = z
  .object({
    /** Stable anchor for links (`/help/glossary#<slug>`) and the chips that point at it. */
    slug: z.string().regex(/^[a-z0-9-]+$/),
    termTh: z.string(),
    termEn: z.string().nullable(),
    definitionTh: z.string(),
    definitionEn: z.string().nullable(),
    /** Other spellings a search or a chip may use (ลอนอี, E flute …). */
    aliases: z.array(z.string()),
  })
  .meta({ id: "StoreGlossaryTermDto" });

export const materialCard = z
  .object({
    code: z.string(),
    nameTh: z.string(),
    nameEn: z.string(),
    kind: z.enum(["paper", "board", "corrugated", "film", "other"]).meta({ id: "StoreMaterialKind" }),
    descriptionTh: z.string().nullable(),
    descriptionEn: z.string().nullable(),
    imageUrl: z.string().nullable(),
    /** Thickness in mm, grammage, the flute for corrugated — each null where it does not apply. */
    caliperMm: z.number().nullable(),
    gsm: z.number().nullable(),
    flute: z.string().nullable(),
    /** The print methods the network runs on it (offset, flexo, digital…), by code with names. */
    printMethods: z.array(z.object({ code: z.string(), nameTh: z.string(), nameEn: z.string() })),
    foodContact: z.enum(["approved", "not_approved"]).meta({ id: "FoodContactStatus" }),
    recyclability: z
      .enum(["recyclable", "recyclable_if_clean", "not_recyclable", "unknown"])
      .meta({ id: "Recyclability" }),
    /** Where it can be ordered: the configurator that offers it and the option id that picks it. */
    offeredOn: z.array(
      z.object({ productSlug: z.string(), nameTh: z.string(), nameEn: z.string(), materialOptionId: z.string() }),
    ),
  })
  .meta({ id: "StoreMaterialDto" });

export const learningPath = z
  .object({
    slug: z.string(),
    titleTh: z.string(),
    titleEn: z.string().nullable(),
    summaryTh: z.string(),
    summaryEn: z.string().nullable(),
    /** The articles to read, in order — published `store.catalog.getArticle` slugs. */
    steps: z.array(z.object({ articleSlug: z.string(), titleTh: z.string(), titleEn: z.string().nullable() })),
    /** Where the path ends: an action pre-filled from what was learnt. */
    action: z
      .object({
        target: z.enum(["configurator", "studio", "styles", "samples", "rfq"]).meta({ id: "LearningActionTarget" }),
        productSlug: z.string().nullable(),
        materialOptionId: z.string().nullable(),
        labelTh: z.string(),
        labelEn: z.string().nullable(),
      })
      .meta({ id: "LearningActionDto" }),
  })
  .meta({ id: "StoreLearningPathDto" });

export const storeContentRequests = {
  "GET /v1/store/catalog/glossary-terms": request({
    request: "store.catalog-glossary",
    summary: "The published glossary for customers: Thai and English term, definition, aliases, stable slug",
    decisions: ["D-219"],
    response: z.object({ data: z.array(glossaryTerm) }),
    public: true,
  }),
  "GET /v1/store/catalog/materials": request({
    request: "store.catalog-materials",
    summary: "The materials library: published materials with spec data and where each can be ordered",
    decisions: ["D-219"],
    response: z.object({ data: z.array(materialCard) }),
    public: true,
  }),
  "GET /v1/store/learning-paths": request({
    request: "store.learning-paths",
    summary: "Buyer learning paths: ordered articles ending in a pre-filled action",
    decisions: ["D-219"],
    response: z.object({ data: z.array(learningPath) }),
    public: true,
  }),
} as const;
