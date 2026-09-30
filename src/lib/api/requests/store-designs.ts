/**
 * The online designer's documents, assets and catalogue (F4 Part C, packio-api B4.1).
 *
 * Tables: `designs` (the customer's document: name, source, product, pattern, material, link to
 * an order item), `design_versions` (every save — autosave, manual, restore, import — each with
 * the whole document; the design's `versionNo` is the ETag) and `design_assets` (uploaded
 * images, stored once and referenced from the document by id). The document itself is the
 * designer's JSON with a `schemaVersion`; the API stores it opaquely and validates only its
 * envelope. A printable file is not made here: the designer uploads its print PDF and submits it
 * as the order's artwork (`store.artwork`, with `designDocumentId`).
 *
 * The catalogue slice (`GET /v1/store/designer/catalog`) is what the engine needs that the
 * public catalogue does not publish: each pattern's `dielineKey` and size limits, and each
 * material's caliper (`materials.micron`) and flute make-up allowances (`flute_types.col_a`,
 * `col_c`, `col_dd`) — so the designer never holds a hard-coded material list.
 */

import { z } from "zod";

import { dateTime, nextAction, request, uuid } from "./define";

/* --------------------------------------------------------------------------------- documents */

export const designSource = z
  .enum(["blank", "product", "order_item", "template", "import", "copy"])
  .meta({ id: "DesignSource" });

/** The designer's document. `spec` is the `@packio/dieline` spec, `content` the artwork. */
export const designDocument = z
  .object({
    schemaVersion: z.number().int().min(1),
    spec: z.record(z.string(), z.unknown()),
    content: z.record(z.string(), z.unknown()),
  })
  .meta({ id: "DesignDocumentDto" });

export const designOrderLink = z
  .object({
    orderId: uuid(),
    orderCode: z.string(),
    /** The order's line the design is for (legacy `design_uuid` on the order item). */
    itemId: uuid(),
    itemName: z.string(),
  })
  .meta({ id: "DesignOrderLinkDto" });

export const designProduct = z
  .object({ slug: z.string(), name: z.string(), productTypeCode: z.string() })
  .meta({ id: "DesignProductDto" });

export const designAsset = z
  .object({
    id: uuid(),
    fileId: uuid(),
    /** Short-lived signed URL (api-conventions §3); the document refers to the asset by `id`. */
    url: z.string(),
    mimeType: z.string(),
    widthPx: z.number().int().nullable(),
    heightPx: z.number().int().nullable(),
    sizeBytes: z.number().int(),
    createdAt: dateTime(),
  })
  .meta({ id: "DesignAssetDto" });

export const storeDesignSummary = z
  .object({
    id: uuid(),
    name: z.string(),
    /** `@packio/dieline` style of the document, for a thumbnail fallback and filters. */
    styleId: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    product: designProduct.nullable(),
    link: designOrderLink.nullable(),
    versionNo: z.number().int(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  })
  .meta({ id: "StoreDesignSummaryDto" });

export const storeDesign = storeDesignSummary
  .extend({
    source: designSource,
    document: designDocument,
    patternId: uuid().nullable(),
    materialId: uuid().nullable(),
    assets: z.array(designAsset),
    /** `design.submit_for_print` when linked to an order item waiting for artwork. */
    nextActions: z.array(nextAction()),
  })
  .meta({ id: "StoreDesignDto" });

const designName = z.string().trim().min(1).max(120);

/* --------------------------------------------------------------------------------- catalogue */

export const designerMaterialKind = z
  .enum(["paperboard", "corrugated", "rigid", "label", "flexible"])
  .meta({ id: "DesignerMaterialKind" });

export const designerMaterial = z
  .object({
    /** The catalogue material (or flute type) id — the same id the configurator's material option carries. */
    id: uuid(),
    code: z.string(),
    nameTh: z.string(),
    nameEn: z.string().nullable(),
    kind: designerMaterialKind,
    /** Board thickness in mm (`materials.micron` / 1000, or the flute's caliper). */
    caliperMm: z.number(),
    flute: z.string().nullable(),
    /** Flute make-up allowances in mm (`col_a` panel, `col_c` flap, `col_dd` depth), when set. */
    allowances: z
      .object({ panel: z.number().nullable(), flap: z.number().nullable(), depth: z.number().nullable() })
      .nullable(),
    /** The board's own colour for previews (`outside_colour`). */
    swatchHex: z.string().nullable(),
    printable: z.boolean(),
    isFoodGrade: z.boolean(),
  })
  .meta({ id: "DesignerMaterialDto" });

export const designerPattern = z
  .object({
    id: uuid(),
    code: z.string(),
    name: z.string(),
    /** `@packio/dieline` style key (or alias); null when the engine does not draw this pattern. */
    dielineKey: z.string().nullable(),
    /** The pattern's size limits (`pattern.min_* / max_*`), mm; null where none is set. */
    rules: z.object({
      minLengthMm: z.number().nullable(),
      maxLengthMm: z.number().nullable(),
      minWidthMm: z.number().nullable(),
      maxWidthMm: z.number().nullable(),
      minHeightMm: z.number().nullable(),
      maxHeightMm: z.number().nullable(),
      lengthMustExceedWidth: z.boolean(),
    }),
    /** Materials this pattern is made from (by `designerMaterial.id`); empty = any. */
    materialIds: z.array(uuid()),
    standardSizes: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        lengthMm: z.number(),
        widthMm: z.number(),
        heightMm: z.number().nullable(),
      }),
    ),
  })
  .meta({ id: "DesignerPatternDto" });

export const designerTemplate = z
  .object({
    id: uuid(),
    semiDesignId: uuid(),
    name: z.string(),
    sizeCode: z.string().nullable(),
    dielineKey: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    /** The palette the semi-design offers (`semi_design_colours`). */
    colours: z.array(z.string()),
  })
  .meta({ id: "DesignerTemplateDto" });

export const designerFont = z
  .object({ family: z.string(), fileUrl: z.string().nullable(), licenceNote: z.string().nullable() })
  .meta({ id: "DesignerFontDto" });

export const designerCatalog = z
  .object({
    product: designProduct.nullable(),
    patterns: z.array(designerPattern),
    materials: z.array(designerMaterial),
    templates: z.array(designerTemplate),
    /** Brand and print colours offered as swatches, `#RRGGBB`. */
    colours: z.array(z.object({ hex: z.string(), name: z.string() })),
    fonts: z.array(designerFont),
    /** Artwork rules from settings (D-070), for the checks panel and the print file. */
    rules: z.object({ bleedMm: z.number(), safeMarginMm: z.number(), minDpi: z.number().int() }),
  })
  .meta({ id: "DesignerCatalogDto" });

export const designerTemplateDetail = designerTemplate
  .extend({ document: designDocument })
  .meta({ id: "DesignerTemplateDetailDto" });

/* ------------------------------------------------------------------------------------ sharing */

export const designShare = z
  .object({
    /** Opaque, unguessable; the public page is `/design/shared/{token}`. */
    token: z.string(),
    createdAt: dateTime(),
    /** Null when the link does not expire. */
    expiresAt: dateTime().nullable(),
  })
  .meta({ id: "DesignShareDto" });

export const sharedDesign = z
  .object({
    name: z.string(),
    styleId: z.string().nullable(),
    document: designDocument,
    /** Signed URLs for the document's image assets, as on `storeDesign.assets`. */
    assets: z.array(z.object({ id: uuid(), url: z.string() })),
    sharedAt: dateTime(),
  })
  .meta({ id: "SharedDesignDto" });

/* ---------------------------------------------------------------------------------- requests */

export const storeDesignRequests = {
  "POST /v1/store/designs/{designId}/actions/duplicate": request({
    request: "store.designs",
    summary: "Copy a design (its current document and assets) under a new name, unlinked",
    body: z.object({ name: designName }),
    response: storeDesign,
    status: 201,
    idempotent: true,
  }),
  "POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore": request({
    request: "store.designs",
    summary: "Make an old version current again, as a new version (history is never rewritten)",
    response: storeDesign,
    concurrency: true,
  }),
  "POST /v1/store/designs/actions/import": request({
    request: "store.designs",
    summary: "One-time import of designs kept in this browser before sign-in; replays by localId are no-ops",
    body: z.object({
      designs: z
        .array(
          z.object({
            localId: z.string().min(1).max(64),
            name: designName,
            document: designDocument,
            createdAt: dateTime(),
            updatedAt: dateTime(),
          }),
        )
        .min(1)
        .max(50),
    }),
    response: z
      .object({
        imported: z.array(z.object({ localId: z.string(), designId: uuid() })),
        skipped: z.array(z.object({ localId: z.string(), reason: z.string() })),
      })
      .meta({ id: "DesignImportResultDto" }),
    idempotent: true,
  }),
  "POST /v1/store/designs/{designId}/actions/share": request({
    request: "store.design-share",
    summary:
      "Create (or return the live) view-only link to the design's current version; the viewer needs no account and cannot edit",
    body: z.object({ expiresInDays: z.number().int().min(1).max(365).nullable().optional() }),
    response: designShare,
    idempotent: true,
  }),
  "DELETE /v1/store/designs/{designId}/share": request({
    request: "store.design-share",
    summary: "Revoke the design's view link; the old link answers 404 from then on",
    status: 204,
  }),
  "GET /v1/store/shared-designs/{token}": request({
    request: "store.design-share",
    summary: "A shared design, read-only, for anyone with the link (the version current when it is opened)",
    response: sharedDesign,
    public: true,
  }),
  "GET /v1/store/designer/catalog": request({
    request: "store.designer-catalog",
    summary:
      "What the designer draws from: patterns with dieline keys and limits, materials with caliper, templates, colours, fonts, artwork rules",
    decisions: ["D-070"],
    query: z.object({ product: z.string().optional() }),
    response: designerCatalog,
    public: true,
  }),
  "GET /v1/store/designer/templates/{templateId}": request({
    request: "store.designer-catalog",
    summary: "A semi-design template as a designer document, to start a design from",
    response: designerTemplateDetail,
    public: true,
  }),
} as const;
