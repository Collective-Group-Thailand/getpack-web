/**
 * The customer's designs (F4 Part C), all at their published paths: list, create, get, save, delete,
 * versions and assets (U-F0.2), and duplicate, restore, import, sharing (D-226), the designer's
 * catalogue and its templates (U-B0.1). The rows keep a mock-only model, answered as
 * `DesignDocumentDto` on the way out (`toDto`).
 *
 * A stateful designs store: every save is a version, the version number is the ETag, and a save
 * with a stale `If-Match` answers `412 concurrency.stale` — so the designer's autosave and its
 * conflict dialog run against the same rules the API will enforce. The catalogue slice is built
 * from the back office's own catalogue rows (`../admin/catalogue`), so a material an admin adds
 * appears in the designer, with its id matching the configurator's material option.
 *
 * Calipers are obviously fake where the seed has none: `gsm × 1.3 µm` for paper and board, a
 * fixed caliper per flute code for corrugated. The real API reads `materials.micron`.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { apply as applyPatch, type JsonValue, type PatchOperation } from "@/features/designer/lib/json-patch";

import { catalogueRows } from "../admin/catalogue";
import { fileDataUrl, files } from "../admin/platform";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { customerOf } from "./customers";
import { ownerIdOf } from "./owner";

/** The designer's document as the rows keep it: the opaque `{ spec, content }` and its schema version. */
interface DesignDocument {
  schemaVersion: number;
  spec: Record<string, unknown>;
  content: Record<string, unknown>;
}

/** The mock-only design row (what the API's `designs` table holds, as far as the mock needs). */
interface StoreDesign {
  id: string;
  name: string;
  styleId: string | null;
  thumbnailUrl: string | null;
  product: { slug: string; name: string; productTypeCode: string } | null;
  link: { orderId: string; orderCode: string; itemId: string; itemName: string } | null;
  versionNo: number;
  createdAt: string;
  updatedAt: string;
  source: "blank" | "product" | "order_item" | "template" | "import" | "copy";
  document: DesignDocument;
  patternId: string | null;
  materialId: string | null;
  assets: {
    id: string;
    fileId: string;
    url: string;
    mimeType: string;
    widthPx: number | null;
    heightPx: number | null;
    sizeBytes: number;
    createdAt: string;
  }[];
}

interface Version {
  versionNo: number;
  kind: "autosave" | "manual" | "restore" | "import";
  savedAt: string;
  label: string | null;
  document: DesignDocument;
  /** D-275: the box and calculator spec the version was saved with (the studio prices it). */
  box?: StudioBox | null;
}

/** The studio fields of a design (D-275), as the save bodies send them. */
export interface StudioBox {
  patternId?: string;
  materialId?: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  measurementBasis?: Schemas["MeasurementBasis"];
  printMethod?: Schemas["PrintMethod"];
  printSides?: Schemas["PrintSides"];
  finishes?: string[];
  styleVariantCode?: string;
  spec?: Record<string, unknown>;
}

const BOX_KEYS = [
  "patternId",
  "materialId",
  "lengthMm",
  "widthMm",
  "heightMm",
  "measurementBasis",
  "printMethod",
  "printSides",
  "finishes",
  "styleVariantCode",
  "spec",
] as const;

/** The studio fields a body sends, or `null` when it sends none (the plain designer). */
function boxFrom(body: Record<string, unknown>): StudioBox | null {
  const box = Object.fromEntries(BOX_KEYS.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  return "spec" in box || "printSides" in box || "lengthMm" in box ? (box as StudioBox) : null;
}

export interface Row {
  /** The current box (D-275); a version saved without studio fields keeps the one before. */
  box: StudioBox | null;
  owner: string;
  design: StoreDesign;
  versions: Version[];
  /** What the published design carries and the request's shape does not. */
  catalogProductId: string;
  semiDesignTemplateId: string | null;
  thumbnailFileId: string | null;
}

const designs = new Map<string, Row>();
const importedLocalIds = new Map<string, string>();
/** View links (D-226): token → design id, and each design's live token. */
const shares = new Map<string, { designId: string; createdAt: string; expiresAt: string | null }>();
const shareOf = new Map<string, string>();
/** Studio share links (D-285): many per design, each with its scope; token → link. */
export interface StudioLink {
  id: string;
  designId: string;
  scope: Schemas["ShareScope"];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
const studioLinks = new Map<string, StudioLink>();
let linkSeq = 1;
let counter = 0;
/** `configurations.share_link_days` (D-185, D-226). */
const SHARE_LINK_DAYS = 15;

const etagOf = (design: StoreDesign) => `"v${design.versionNo}"`;

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "design.not_found", "ไม่พบแบบนี้");

function rowOf(request: Request, designId: string): Row | Response {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const row = designs.get(designId);
  // Another customer's design is not visible, not forbidden (api-conventions §3: 404).
  if (!row || row.owner !== ownerIdOf(customer)) return notFound();
  return row;
}

function checkMatch(request: Request, row: Row): Response | null {
  const match = request.headers.get("if-match");
  if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
  if (match !== etagOf(row.design)) {
    return problem(412, "concurrency.stale", "แบบนี้ถูกบันทึกจากที่อื่นหลังจากที่คุณเปิด");
  }
  return null;
}

const styleOf = (document: DesignDocument): string | null =>
  typeof document.spec.styleId === "string"
    ? document.spec.styleId
    : typeof document.spec.style === "string"
      ? document.spec.style
      : null;

/** The catalogue product with this id, as the request's shape names it (by slug). */
function productOfId(id: string | null): StoreDesign["product"] {
  const row = id ? catalogueRows("catalogProducts").find((candidate) => String(candidate.id) === id) : undefined;
  return row ? productOf(String(row.slug)) : null;
}

/**
 * The catalogue product a published design names (`DesignProductRefDto`), by id. A design on an id
 * the catalogue does not hold keeps the id, named by the request's shape it was saved under.
 */
export function designProductRefOf(
  id: string,
  fallback: StoreDesign["product"] = null,
): Schemas["DesignProductRefDto"] {
  const row = catalogueRows("catalogProducts").find((candidate) => String(candidate.id) === id);
  const product = row ? productOf(String(row.slug)) : fallback;
  return {
    id,
    slug: product?.slug ?? "",
    nameTh: String(row?.nameTh ?? product?.name ?? ""),
    nameEn: String(row?.nameEn ?? row?.nameTh ?? product?.name ?? ""),
    productTypeCode: product?.productTypeCode ?? "",
  };
}

function productOf(slug: string | undefined): StoreDesign["product"] {
  if (!slug) return null;
  const product = catalogueRows("catalogProducts").find((row) => row.slug === slug);
  const type = product ? catalogueRows("productTypes").find((row) => row.id === product.productTypeId) : undefined;
  return product
    ? { slug, name: String(product.nameTh ?? slug), productTypeCode: String(type?.code ?? "folding_carton") }
    : { slug, name: slug, productTypeCode: "folding_carton" };
}

function saveVersion(
  row: Row,
  kind: Version["kind"],
  document: DesignDocument,
  label: string | null = null,
  box: StudioBox | null = null,
) {
  const versionNo = row.design.versionNo + 1;
  const savedAt = bangkokIso();
  if (box) row.box = { ...row.box, ...box };
  row.versions.unshift({ versionNo, kind, savedAt, label, document, box: row.box });
  row.design = { ...row.design, document, versionNo, updatedAt: savedAt, styleId: styleOf(document) };
}

function create(
  owner: string,
  input: {
    name: string;
    document: DesignDocument;
    source: StoreDesign["source"];
    product?: StoreDesign["product"];
    link?: StoreDesign["link"];
    patternId?: string | null;
    materialId?: string | null;
    catalogProductId?: string | null;
    semiDesignTemplateId?: string | null;
    box?: StudioBox | null;
  },
): Row {
  counter += 1;
  const now = bangkokIso();
  const design: StoreDesign = {
    id: mockId("dsg", counter),
    name: input.name,
    styleId: styleOf(input.document),
    thumbnailUrl: null,
    product: input.product ?? null,
    link: input.link ?? null,
    versionNo: 1,
    createdAt: now,
    updatedAt: now,
    source: input.source,
    document: input.document,
    patternId: input.patternId ?? null,
    materialId: input.materialId ?? null,
    assets: [],
  };
  const row: Row = {
    box: input.box ?? null,
    owner,
    design,
    versions: [{ versionNo: 1, kind: "manual", savedAt: now, label: null, document: input.document, box: input.box }],
    // A browser design imported by the (requested) import names no product; the mock files it under
    // the first one, since the published design always has one.
    catalogProductId: input.catalogProductId ?? String(catalogueRows("catalogProducts")[0]?.id ?? mockId("cpr", 1)),
    semiDesignTemplateId: input.semiDesignTemplateId ?? null,
    thumbnailFileId: null,
  };
  designs.set(design.id, row);
  return row;
}

/** A customer's design as the back office reads it (`admin.designs.get`): the published DTO. */
export function storeDesignDtoForStaff(id: string): Schemas["DesignDocumentDto"] | null {
  const row = designs.get(id);
  return row ? toDto(row) : null;
}

/** Whose design it is (the owning customer's id), for the back office's `owner` (admin.designs.get). */
export function storeDesignOwnerForStaff(id: string): string | null {
  return designs.get(id)?.owner ?? null;
}

/* ---------------------------------------------------------------------------- published */

const sizeOfDocument = (document: DesignDocument) => {
  const values = (document.spec.values ?? {}) as Record<string, unknown>;
  const mm = (key: string) => (typeof values[key] === "number" ? (values[key] as number) : null);
  return { lengthMm: mm("length"), widthMm: mm("width"), heightMm: mm("height") };
};

/** D-276: the version the latest order locked, per design (set by the checkout mock). */
const locks = new Map<string, Schemas["DesignLockDto"]>();
export function lockDesign(designId: string, lock: Schemas["DesignLockDto"]): void {
  locks.set(designId, lock);
}

/** A design as `store.designs` answers it: the document opaque, its schema version beside it. */
function toDto(row: Row, withDocument = true): Schemas["DesignDocumentDto"] {
  const { design } = row;
  const share = shares.get(shareOf.get(design.id) ?? "");
  return {
    id: design.id,
    title: design.name,
    catalogProductId: row.catalogProductId,
    product: designProductRefOf(row.catalogProductId, design.product),
    patternId: design.patternId,
    materialId: design.materialId,
    semiDesignTemplateId: row.semiDesignTemplateId,
    ...sizeOfDocument(design.document),
    // U4.B1 studio fields (D-275, D-276).
    measurementBasis: "internal",
    styleVariantCode: null,
    printMethod: null,
    printSides: null,
    finishes: [],
    spec: null,
    // D-278: the print check runs on the API's worker; the mock never has, so nothing is counted yet.
    hasIssues: null,
    issueCount: null,
    issueSummary: [],
    ...studioFieldsOf(row.box),
    lock: locks.get(design.id) ?? null,
    document: withDocument ? { spec: design.document.spec, content: design.document.content } : null,
    schemaVersion: design.document.schemaVersion,
    versionNo: design.versionNo,
    thumbnailFileId: row.thumbnailFileId,
    thumbnailUrl: design.thumbnailUrl,
    assets: design.assets.map((asset) => ({
      id: asset.id,
      fileId: asset.fileId,
      kind: "image" as const,
      url: asset.url,
      urlExpiresAt: null,
      mimeType: asset.mimeType,
      widthPx: asset.widthPx,
      heightPx: asset.heightPx,
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt,
    })),
    orders: design.link ? [{ orderId: design.link.orderId, orderCode: design.link.orderCode }] : [],
    // The live view link; one made without an expiry has no published state (D-226 links expire).
    share: share?.expiresAt ? { sharedAt: share.createdAt, expiresAt: share.expiresAt } : null,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
  };
}

function studioFieldsOf(
  box: StudioBox | null,
): Partial<Omit<Schemas["DesignDocumentDto"], "hasIssues" | "issueCount" | "issueSummary">> {
  if (!box) return {};
  return {
    ...(box.patternId ? { patternId: box.patternId } : {}),
    ...(box.materialId ? { materialId: box.materialId } : {}),
    ...(box.lengthMm ? { lengthMm: box.lengthMm } : {}),
    ...(box.widthMm ? { widthMm: box.widthMm } : {}),
    ...(box.heightMm ? { heightMm: box.heightMm } : {}),
    ...(box.measurementBasis ? { measurementBasis: box.measurementBasis } : {}),
    ...(box.printMethod ? { printMethod: box.printMethod } : {}),
    ...(box.printSides ? { printSides: box.printSides } : {}),
    ...(box.finishes ? { finishes: box.finishes } : {}),
    ...(box.styleVariantCode ? { styleVariantCode: box.styleVariantCode } : {}),
    ...(box.spec ? { spec: box.spec } : {}),
  };
}

/** A new studio share link; the token is answered once (`store.studio.createShareLink`). */
export function addStudioLink(designId: string, scope: Schemas["ShareScope"]): StudioLink & { token: string } {
  const n = linkSeq++;
  // 43 base64url characters, as packio-api's (32 random bytes).
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const link: StudioLink = {
    id: `0192f3a0-7c1e-7d2a-9b1f-${String(0xfb00 + n).padStart(12, "0")}`,
    designId,
    scope,
    createdAt: bangkokIso(),
    expiresAt: bangkokIso(SHARE_LINK_DAYS * 24 * 60),
    revokedAt: null,
  };
  studioLinks.set(token, link);
  return { ...link, token };
}

export function studioLinksOf(designId: string): StudioLink[] {
  return [...studioLinks.values()].filter((link) => link.designId === designId);
}

/** A live studio link by its token (not revoked, not expired). */
export function studioLinkOf(token: string): StudioLink | null {
  const link = studioLinks.get(token);
  return link && !link.revokedAt && link.expiresAt > bangkokIso() ? link : null;
}

/** A design row by id, whoever owns it (behind a share link). */
export function designById(designId: string): Row | undefined {
  return designs.get(designId);
}

/** The signed-in customer's design row (the studio mocks price and check it), or the problem to answer. */
export function designRowFor(request: Request, designId: string) {
  return rowOf(request, designId);
}

/** A version of the design (the current one without a number): its number, document and box. */
export function versionOf(row: Row, versionNo?: number) {
  const version = versionNo === undefined ? row.versions[0] : row.versions.find((v) => v.versionNo === versionNo);
  return version ? { versionNo: version.versionNo, document: version.document, box: version.box ?? null } : null;
}

/** The box a version of the design was saved with (the current one without a number). */
export function versionBoxOf(row: Row, versionNo?: number): { versionNo: number; box: StudioBox | null } | null {
  const version = versionNo === undefined ? row.versions[0] : row.versions.find((v) => v.versionNo === versionNo);
  return version ? { versionNo: version.versionNo, box: version.box ?? null } : null;
}

const withDesignEtag = (row: Row, status = 200) =>
  HttpResponse.json(toDto(row), { status, headers: { ETag: etagOf(row.design) } });

/** `patchDocument`'s rules, for the owner and for an edit link (`store.studio.editShared`). */
export async function patchRow(request: Request, row: Row): Promise<Response> {
  const stale = checkMatch(request, row);
  if (stale) return stale;
  const body = (await request.json()) as Schemas["PatchDesignDocumentDto"];
  if (JSON.stringify(body.operations ?? []).length > 256 * 1024)
    return problem(413, "designs.patch_too_large", "การแก้ไขครั้งนี้ใหญ่เกินไป");
  let next: JsonValue;
  try {
    next = applyPatch(
      { spec: row.design.document.spec, content: row.design.document.content } as unknown as JsonValue,
      body.operations as PatchOperation[],
    );
  } catch (error) {
    return problem(422, "designs.patch_failed", "แก้ไขแบบไม่สำเร็จ", [
      { path: "operations", code: "patch", message: (error as Error).message },
    ]);
  }
  const document = documentFrom({
    document: next,
    schemaVersion: body.schemaVersion ?? row.design.document.schemaVersion,
  });
  if (!document) return problem(422, "designs.patch_failed", "เอกสารแบบไม่ถูกต้อง");
  saveVersion(row, body.kind ?? "autosave", document, body.label ?? null, body.spec ? { spec: body.spec } : null);
  return withDesignEtag(row);
}

/** The published body's document, back in the request's shape the rows keep. */
function documentFrom(body: { document?: unknown; schemaVersion?: number | null }): DesignDocument | null {
  const document = body.document as { spec?: unknown; content?: unknown } | undefined;
  if (!document || typeof document.spec !== "object" || typeof document.content !== "object") return null;
  return {
    schemaVersion: body.schemaVersion ?? 2,
    spec: document.spec as DesignDocument["spec"],
    content: document.content as DesignDocument["content"],
  };
}

const fakeSha = (versionNo: number, id: string) =>
  `${id.replace(/-/g, "").slice(-8)}${String(versionNo).padStart(4, "0")}`.padEnd(64, "0");

/* ------------------------------------------------------------------------------ catalogue */

const FLUTE_CALIPER: Record<string, number> = { E: 1.6, B: 3, C: 4, F: 1.2, BC: 6.5, EB: 4.6 };

/** `DesignerCatalogDto` for one catalogue product, from the back office's own rows. */
function designerCatalog(productSlug: string): Schemas["DesignerCatalogDto"] | null {
  const product = catalogueRows("catalogProducts").find((row) => row.slug === productSlug);
  if (!product) return null;
  const live = (rows: Record<string, unknown>[]) =>
    rows.filter((row) => row.status !== "archived" && row.status !== "draft");
  const flutes = live(catalogueRows("fluteTypes"));
  const materials: Schemas["DesignerMaterialDto"][] = [
    ...live(catalogueRows("materials")).map((row) => {
      const gsm = typeof row.gsm === "number" ? row.gsm : null;
      return {
        id: String(row.id),
        code: String(row.code),
        nameTh: String(row.nameTh),
        nameEn: row.nameEn ? String(row.nameEn) : String(row.nameTh),
        kind: String(row.kind ?? "paper"),
        micron: typeof row.micron === "number" ? row.micron : gsm ? Math.round(gsm * 1.3) : 100,
        flute: null,
      };
    }),
    ...flutes.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      nameTh: String(row.name),
      nameEn: `${String(row.code)} flute`,
      kind: "corrugated",
      micron: (FLUTE_CALIPER[String(row.code)] ?? 3) * 1000,
      flute: {
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        layers: String(row.code).length > 1 ? 5 : 3,
        allowanceAMm: typeof row.colA === "number" ? row.colA : null,
        allowanceCMm: typeof row.colC === "number" ? row.colC : null,
        allowanceDdMm: typeof row.colDd === "number" ? row.colDd : null,
      },
    })),
  ];
  const patterns: Schemas["DesignerPatternDto"][] = live(catalogueRows("patterns")).map((row) => {
    const c = (row.constraints ?? {}) as Record<string, unknown>;
    const n = (key: string) => (typeof c[key] === "number" ? (c[key] as number) : null);
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      dielineKey: row.dielineKey ? String(row.dielineKey) : null,
      fluteTypeIds: [],
      rules: {
        minLMm: n("minL"),
        maxLMm: n("maxL"),
        minWMm: n("minW"),
        maxWMm: n("maxW"),
        minHMm: n("minD"),
        maxHMm: n("maxD"),
        lengthMustExceedWidth: false,
        lengthMustExceedHeight: false,
        widthMustExceedHeight: false,
      },
    };
  });
  return {
    product: designProductRefOf(String(product.id)),
    patterns,
    materials,
    templates: TEMPLATES.map((template) => toTemplate(template, String(product.id))),
    fonts: [
      { id: mockId("fnt", 1), name: "Noto Sans Thai", url: "/fonts/noto-sans-thai.woff2" },
      { id: mockId("fnt", 2), name: "Anuphan", url: "/fonts/anuphan.woff2" },
    ],
    // Mirrors the artwork rules the artwork page shows (settings, D-070).
    rules: {
      bleedMm: "3",
      safeZoneMm: "3",
      minEffectivePpi: 300,
      colourMode: "cmyk",
      assetAccept: ["image/png", "image/jpeg", "image/svg+xml"],
      assetMaxBytes: 20 * 1024 * 1024,
      assetPurpose: "design_asset",
    },
  };
}

type MockTemplate = (typeof TEMPLATES)[number];

/** A template as the catalogue lists it (`DesignerTemplateDto`): no document, its size and palette. */
function toTemplate(template: MockTemplate, _productId: string): Schemas["DesignerTemplateDto"] {
  void _productId;
  const values = (template.document.spec.values ?? {}) as Record<string, number>;
  return {
    id: template.id,
    semiDesignId: template.semiDesignId,
    name: template.name,
    sizeCode: template.sizeCode,
    thumbnailUrl: template.thumbnailUrl,
    colours: template.colours,
    fontIds: [],
    hasDesign: true,
    lengthMm: values.length ?? 0,
    widthMm: values.width ?? 0,
    heightMm: values.height ?? 0,
  };
}

const doc = (
  styleId: string,
  values: Record<string, number>,
  elements: unknown[],
  pattern: Record<string, unknown>,
): DesignDocument => ({
  schemaVersion: 2,
  spec: { specVersion: 2, styleId, values, material: { caliperMm: 0.45, kind: "paperboard" }, materialId: null },
  content: { elements, pattern },
});

const TEMPLATES = [
  {
    id: mockId("dtp", 1),
    semiDesignId: mockId("sdn", 1),
    name: "มินิมอล ขาว-ดำ",
    sizeCode: "M",
    dielineKey: "tuck-end",
    thumbnailUrl: null,
    colours: ["#1f2933", "#ffffff"],
    document: doc(
      "tuck-end",
      { length: 70, width: 40, height: 150 },
      [
        {
          id: "t1",
          type: "text",
          x: 32,
          y: 150,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          text: "BRAND",
          fontSize: 9,
          fontFamily: "Noto Sans Thai",
          fontStyle: "bold",
          fill: "#1f2933",
          align: "left",
        },
        {
          id: "r1",
          type: "rect",
          x: 20,
          y: 190,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          width: 72,
          height: 2,
          fill: "#1f2933",
          stroke: "#000000",
          strokeWidth: 0,
          cornerRadius: 0,
        },
      ],
      { kind: "none", color: "#1f2933", background: "#ffffff", size: 12 },
    ),
  },
  {
    id: mockId("dtp", 2),
    semiDesignId: mockId("sdn", 2),
    name: "ลายจุดพาสเทล",
    sizeCode: "M",
    dielineKey: "rsc",
    thumbnailUrl: null,
    colours: ["#e8b04b", "#fff7e6"],
    document: doc("rsc", { length: 250, width: 180, height: 120 }, [], {
      kind: "dots",
      color: "#e8b04b",
      background: "#fff7e6",
      size: 14,
    }),
  },
];

/* ------------------------------------------------------------------------------- handlers */

export const storeDesignHandlers = [
  // store.designs.share (D-226): a new view-only link; sharing again replaces the previous one.
  http.post("*/v1/store/designs/:designId/actions/share", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    const previous = shareOf.get(row.design.id);
    if (previous) shares.delete(previous);
    // 43 characters of base64url, as the API's tokens are.
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "").slice(0, 43);
    const createdAt = bangkokIso();
    const expiresAt = bangkokIso(SHARE_LINK_DAYS * 24 * 60);
    shares.set(token, { designId: row.design.id, createdAt, expiresAt });
    shareOf.set(row.design.id, token);
    return HttpResponse.json(
      {
        shareToken: token,
        sharePath: `/v1/store/shared-designs/${token}`,
        sharedAt: createdAt,
        expiresAt,
      } satisfies Schemas["ShareDesignResultDto"],
      { status: 201 },
    );
  }),

  // store.designs.unshare: the link stops opening at once; 404 when not shared.
  http.delete("*/v1/store/designs/:designId/share", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    const token = shareOf.get(row.design.id);
    if (!token) return problem(404, "http.not_found", "แบบนี้ไม่ได้แชร์อยู่");
    shares.delete(token);
    shareOf.delete(row.design.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // store.designs.getShared (public): the current version, never its owner; 404 once revoked or expired.
  // A studio link (D-285) carries its scope; comment and edit links need a signed-in user.
  http.get("*/v1/store/shared-designs/:token", ({ params, request }) => {
    const link = studioLinkOf(String(params.token));
    const share = link
      ? { designId: link.designId, createdAt: link.createdAt, expiresAt: link.expiresAt }
      : shares.get(String(params.token));
    const row = share ? designs.get(share.designId) : undefined;
    if (!share || !row || (share.expiresAt && share.expiresAt < bangkokIso()))
      return problem(404, "http.not_found", "ลิงก์นี้ไม่มีอยู่หรือหมดอายุแล้ว");
    if (link && link.scope !== "view" && !customerOf(request)) return unauthenticated();
    const dto = toDto(row);
    return HttpResponse.json(
      {
        title: dto.title,
        product: dto.product,
        dielineKey: row.design.styleId,
        document: dto.document,
        schemaVersion: dto.schemaVersion,
        versionNo: dto.versionNo,
        lengthMm: dto.lengthMm,
        widthMm: dto.widthMm,
        heightMm: dto.heightMm,
        measurementBasis: dto.measurementBasis,
        scope: link?.scope ?? "view",
        thumbnailUrl: dto.thumbnailUrl,
        assets: dto.assets,
        sharedAt: share.createdAt,
        expiresAt: share.expiresAt ?? bangkokIso(SHARE_LINK_DAYS * 24 * 60),
      } satisfies Schemas["SharedDesignDto"],
      link?.scope === "edit" ? { headers: { ETag: etagOf(row.design) } } : undefined,
    );
  }),

  // store.designs.list (published, U-F0.2): newest first; bodies are left out of a list.
  http.get("*/v1/store/designs", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = ownerIdOf(customer);
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const rows = [...designs.values()]
      .filter((row) => row.owner === owner)
      .filter((row) => matchesQuery(query.q, row.design.name))
      // `linked`: used by an order — in the mock, locked by one (D-276).
      .filter((row) =>
        query.linked === "linked"
          ? locks.has(row.design.id)
          : query.linked === "unlinked"
            ? !locks.has(row.design.id)
            : true,
      )
      .sort((a, b) => b.design.updatedAt.localeCompare(a.design.updatedAt))
      .map((row) => toDto(row, false));
    return HttpResponse.json(paginate(rows, { page: Number(query.page ?? 1), perPage: Number(query.perPage ?? 25) }));
  }),

  // store.designs.create (published, U-F0.2): the product is required, by id.
  http.post("*/v1/store/designs", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = ownerIdOf(customer);
    const body = (await request.json()) as Schemas["CreateDesignDto"];
    if (!body.catalogProductId || !body.title?.trim())
      return problem(422, "validation.failed", "ต้องระบุสินค้าและชื่อแบบ", [
        { path: "catalogProductId", code: "required", message: "required" },
      ]);
    let document = documentFrom(body);
    const template = body.semiDesignTemplateId
      ? TEMPLATES.find(
          (candidate) =>
            candidate.semiDesignId === body.semiDesignTemplateId || candidate.id === body.semiDesignTemplateId,
        )
      : undefined;
    if (body.semiDesignTemplateId && !template) return problem(404, "http.not_found", "ไม่พบเทมเพลตนี้");
    if (template) document = { ...template.document, spec: { ...template.document.spec, ...(document?.spec ?? {}) } };
    if (!document) return problem(409, "designs.template_without_design", "ต้องมีแบบหรือเทมเพลตให้เริ่ม");
    const row = create(owner, {
      name: body.title,
      document,
      source: template ? "template" : "product",
      product: productOfId(body.catalogProductId),
      patternId: body.patternId ?? null,
      materialId: body.materialId ?? null,
      catalogProductId: body.catalogProductId,
      semiDesignTemplateId: template?.semiDesignId ?? null,
      box: boxFrom(body as unknown as Record<string, unknown>),
    });
    return withDesignEtag(row, 201);
  }),

  http.get("*/v1/store/designs/:designId", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    return row instanceof Response ? row : withDesignEtag(row);
  }),

  // store.designs.save (published, U-F0.2): every save is a new version, under If-Match.
  http.put("*/v1/store/designs/:designId", async ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    const stale = checkMatch(request, row);
    if (stale) return stale;
    const body = (await request.json()) as Schemas["SaveDesignDto"];
    const document = documentFrom(body);
    if (!document) return problem(422, "validation.failed", "เอกสารแบบไม่ถูกต้อง");
    saveVersion(
      row,
      body.kind ?? "manual",
      document,
      body.label ?? null,
      boxFrom(body as unknown as Record<string, unknown>),
    );
    if (body.title) row.design = { ...row.design, name: body.title };
    if (body.materialId) row.design = { ...row.design, materialId: body.materialId };
    if (body.patternId) row.design = { ...row.design, patternId: body.patternId };
    if (body.thumbnailFileId) {
      row.thumbnailFileId = body.thumbnailFileId;
      row.design = { ...row.design, thumbnailUrl: fileDataUrl(body.thumbnailFileId) };
    }
    return withDesignEtag(row);
  }),

  // store.designs.patchDocument (U4.B1, D-276): JSON Patch on the current document, under If-Match.
  http.patch("*/v1/store/designs/:designId/document", async ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    return patchRow(request, row);
  }),

  // store.designs.delete (published): a soft delete — an order keeps the version it used.
  http.delete("*/v1/store/designs/:designId", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    designs.delete(row.design.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // store.designs.duplicate: the current version and the assets, under a new title, unlinked.
  http.post("*/v1/store/designs/:designId/actions/duplicate", async ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    const body = (await request.json().catch(() => null)) as Schemas["DuplicateDesignDto"] | null;
    if (!body?.title?.trim()) return problem(422, "validation.failed", "กรุณาตั้งชื่อแบบ");
    const copy = create(row.owner, {
      name: body.title,
      document: structuredClone(row.design.document),
      source: "copy",
      product: row.design.product,
      patternId: row.design.patternId,
      materialId: row.design.materialId,
      catalogProductId: row.catalogProductId,
      semiDesignTemplateId: row.semiDesignTemplateId,
      box: row.box,
    });
    copy.design.assets = [...row.design.assets];
    return withDesignEtag(copy, 201);
  }),

  // store.designs.listVersions / getVersion (published, U-F0.2): bodies only on the one version.
  http.get("*/v1/store/designs/:designId/versions", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    return HttpResponse.json(
      row.versions.map((version) => ({
        versionNo: version.versionNo,
        createdAt: version.savedAt,
        schemaVersion: version.document.schemaVersion,
        contentSha256: fakeSha(version.versionNo, row.design.id),
        document: null,
        kind: version.kind,
        label: version.label,
        // The versions keep no thumbnail of their own.
        thumbnailFileId: null,
        thumbnailUrl: null,
        box: null,
        spec: null,
      })) satisfies Schemas["DesignVersionDto"][],
    );
  }),

  http.get("*/v1/store/designs/:designId/versions/:versionNo", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    const version = row.versions.find((candidate) => candidate.versionNo === Number(params.versionNo));
    if (!version) return problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
    return HttpResponse.json({
      versionNo: version.versionNo,
      createdAt: version.savedAt,
      schemaVersion: version.document.schemaVersion,
      contentSha256: fakeSha(version.versionNo, row.design.id),
      document: { spec: version.document.spec, content: version.document.content },
      kind: version.kind,
      label: version.label,
      thumbnailFileId: null,
      thumbnailUrl: null,
      box: null,
      spec: null,
    } satisfies Schemas["DesignVersionDto"]);
  }),

  // store.designs.restoreVersion: a new version (kind `restore`), under If-Match.
  http.post("*/v1/store/designs/:designId/versions/:versionNo/actions/restore", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    const stale = checkMatch(request, row);
    if (stale) return stale;
    const version = row.versions.find((candidate) => candidate.versionNo === Number(params.versionNo));
    if (!version) return problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
    row.box = version.box ?? null;
    saveVersion(row, "restore", structuredClone(version.document), `คืนค่าจากเวอร์ชัน ${version.versionNo}`);
    return withDesignEtag(row);
  }),

  // store.designs.addAsset (published, U-F0.2): answers with the whole design.
  http.post("*/v1/store/designs/:designId/assets", async ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    const body = (await request.json()) as Schemas["AddDesignAssetDto"];
    const file = files.get(body.fileId);
    if (!file) return problem(404, "http.not_found", "ไม่พบไฟล์นี้");
    row.design.assets.push({
      id: mockId("das", row.design.assets.length + 1 + counter * 100),
      fileId: body.fileId,
      url: fileDataUrl(file.id) ?? `data:text/plain,${encodeURIComponent(file.originalName)}`,
      mimeType: file.mimeType,
      widthPx: null,
      heightPx: null,
      sizeBytes: file.sizeBytes,
      createdAt: bangkokIso(),
    });
    return HttpResponse.json(toDto(row), { status: 201 });
  }),

  // store.designs.import: the browser's designs, each as version 1; a row without a product is skipped.
  http.post("*/v1/store/designs/actions/import", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = ownerIdOf(customer);
    const body = (await request.json().catch(() => null)) as Schemas["ImportDesignsDto"] | null;
    if (!body?.designs) return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง");
    const imported: Schemas["ImportedDesignDto"][] = [];
    const skipped: Schemas["SkippedDesignDto"][] = [];
    for (const item of body.designs) {
      const key = `${owner}:${item.localId}`;
      const already = importedLocalIds.get(key);
      if (already) {
        if (designs.has(already)) imported.push({ localId: item.localId, designId: already });
        else skipped.push({ localId: item.localId, reason: "deleted" });
        continue;
      }
      const product = item.catalogProductId ? productOfId(item.catalogProductId) : null;
      const document = documentFrom(item);
      if (!product || !document) {
        skipped.push({ localId: item.localId, reason: "product_not_found" });
        continue;
      }
      const row = create(owner, {
        name: item.title,
        document,
        source: "import",
        product,
        catalogProductId: item.catalogProductId,
      });
      row.versions[0]!.kind = "import";
      importedLocalIds.set(key, row.design.id);
      imported.push({ localId: item.localId, designId: row.design.id });
    }
    return HttpResponse.json({ imported, skipped } satisfies Schemas["ImportDesignsResultDto"]);
  }),

  // store.designer.getCatalog (public): one product's styles, boards, templates, fonts and rules.
  http.get("*/v1/store/designer/catalog", ({ request }) => {
    const product = new URL(request.url).searchParams.get("product");
    if (!product)
      return problem(422, "validation.failed", "ต้องระบุสินค้า", [
        { path: "product", code: "required", message: "required" },
      ]);
    const catalog = designerCatalog(product);
    return catalog ? HttpResponse.json(catalog) : problem(404, "http.not_found", "ไม่พบสินค้านี้");
  }),

  // store.designer.getTemplate (public): one template with the document a design starts from.
  http.get("*/v1/store/designer/templates/:templateId", ({ params }) => {
    const template = TEMPLATES.find((candidate) => candidate.id === params.templateId);
    if (!template) return problem(404, "http.not_found", "ไม่พบเทมเพลตนี้");
    const productId = String(catalogueRows("catalogProducts")[0]?.id ?? mockId("cpr", 1));
    return HttpResponse.json({
      ...toTemplate(template, productId),
      product: designProductRefOf(productId),
      document: { spec: template.document.spec, content: template.document.content },
      schemaVersion: template.document.schemaVersion,
    } satisfies Schemas["DesignerTemplateDetailDto"]);
  }),
];

/** An owner's designs, latest change first, each with the order that locked it (the launchpad, D-297). */
export function designsOwnedBy(owner: string): (Row & { lockedByOrderCode: string | null })[] {
  return [...designs.values()]
    .filter((row) => row.owner === owner)
    .sort((a, b) => b.design.updatedAt.localeCompare(a.design.updatedAt))
    .map((row) => ({ ...row, lockedByOrderCode: locks.get(row.design.id)?.orderCode ?? null }));
}
