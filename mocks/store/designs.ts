/**
 * The customer's designs (F4 Part C): list, create, get, save, delete, versions and assets at their
 * published paths (`store.designs.*`, U-F0.2); duplicate, restore, import, sharing, the designer's
 * catalogue and templates are still CONTRACT-REQUEST (store.designs, store.design-share,
 * store.designer-catalog). One store serves both: its rows keep the request's shape, and the
 * published handlers answer `DesignDocumentDto` from them.
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
import type { z } from "zod";

import { REQUESTS, type RequestKey } from "@/lib/api/requests/registry";
import type { designDocument, storeDesign } from "@/lib/api/requests/store-designs";
import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { fileDataUrl, files } from "../admin/platform";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { customerOf } from "./customers";
import { ownerIdOf } from "./owner";

type StoreDesign = z.infer<typeof storeDesign>;
type DesignDocument = z.infer<typeof designDocument>;

interface Version {
  versionNo: number;
  kind: "autosave" | "manual" | "restore" | "import";
  savedAt: string;
  label: string | null;
  document: DesignDocument;
}

interface Row {
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
/** View links: token → design id, and each design's live token. // CONTRACT-REQUEST store.design-share */
const shares = new Map<string, { designId: string; createdAt: string; expiresAt: string | null }>();
const shareOf = new Map<string, string>();
let counter = 0;

const etagOf = (design: StoreDesign) => `"v${design.versionNo}"`;

/** Answers with the design and its ETag, the body checked against the request like `mockRequest` does. */
function withEtag(key: RequestKey, design: StoreDesign, status = 200): Response {
  const schema = REQUESTS[key].response;
  const checked = schema?.safeParse(design);
  if (schema && !checked?.success) {
    console.error(`[mock drift] ${key}`, checked?.error.issues.slice(0, 5));
    return problem(500, "mock.drift", `The mock for ${key} returned a shape its request does not describe.`);
  }
  return HttpResponse.json(design, { status, headers: { ETag: etagOf(design) } });
}

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

function saveVersion(row: Row, kind: Version["kind"], document: DesignDocument, label: string | null = null) {
  const versionNo = row.design.versionNo + 1;
  const savedAt = bangkokIso();
  row.versions.unshift({ versionNo, kind, savedAt, label, document });
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
    nextActions: input.link ? [{ key: "design.submit_for_print" }] : [],
  };
  const row: Row = {
    owner,
    design,
    versions: [{ versionNo: 1, kind: "manual", savedAt: now, label: null, document: input.document }],
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

/* ---------------------------------------------------------------------------- published */

const sizeOfDocument = (document: DesignDocument) => {
  const values = (document.spec.values ?? {}) as Record<string, unknown>;
  const mm = (key: string) => (typeof values[key] === "number" ? (values[key] as number) : null);
  return { lengthMm: mm("length"), widthMm: mm("width"), heightMm: mm("height") };
};

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

const withDesignEtag = (row: Row, status = 200) =>
  HttpResponse.json(toDto(row), { status, headers: { ETag: etagOf(row.design) } });

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

function designerCatalog(productSlug: string | undefined) {
  const live = (rows: Record<string, unknown>[]) =>
    rows.filter((row) => row.status !== "archived" && row.status !== "draft");
  const materials = [
    ...live(catalogueRows("materials")).map((row) => {
      const gsm = typeof row.gsm === "number" ? row.gsm : null;
      const micron = typeof row.micron === "number" ? row.micron : gsm ? gsm * 1.3 : 100;
      const kind =
        row.kind === "film" || row.kind === "foil" ? "flexible" : row.kind === "label_stock" ? "label" : "paperboard";
      return {
        id: String(row.id),
        code: String(row.code),
        nameTh: String(row.nameTh),
        nameEn: row.nameEn ? String(row.nameEn) : null,
        kind: kind as "paperboard" | "flexible" | "label",
        caliperMm: Math.round(micron) / 1000,
        flute: null,
        allowances: null,
        swatchHex: row.paperGroup === "kraft" ? "#c8a47e" : "#fbfaf6",
        printable: true,
        isFoodGrade: row.isFoodGrade === true,
      };
    }),
    ...live(catalogueRows("fluteTypes")).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      nameTh: String(row.name),
      nameEn: `${String(row.code)} flute`,
      kind: "corrugated" as const,
      caliperMm: FLUTE_CALIPER[String(row.code)] ?? 3,
      flute: String(row.code),
      allowances: {
        panel: typeof row.colA === "number" ? row.colA : null,
        flap: typeof row.colC === "number" ? row.colC : null,
        depth: typeof row.colDd === "number" ? row.colDd : null,
      },
      swatchHex: "#c9a57a",
      printable: true,
      isFoodGrade: false,
    })),
  ];
  const patterns = live(catalogueRows("patterns")).map((row) => {
    const c = (row.constraints ?? {}) as Record<string, unknown>;
    const n = (key: string) => (typeof c[key] === "number" ? (c[key] as number) : null);
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      dielineKey: row.dielineKey ? String(row.dielineKey) : null,
      rules: {
        minLengthMm: n("minL"),
        maxLengthMm: n("maxL"),
        minWidthMm: n("minW"),
        maxWidthMm: n("maxW"),
        minHeightMm: n("minD"),
        maxHeightMm: n("maxD"),
        lengthMustExceedWidth: false,
      },
      materialIds: [],
      standardSizes: [],
    };
  });
  return {
    product: productOf(productSlug),
    patterns,
    materials,
    templates: TEMPLATES.map(({ document: _document, ...template }) => {
      void _document;
      return template;
    }),
    colours: [
      { hex: "#0f5f58", name: "Packio teal" },
      { hex: "#1f2933", name: "Ink" },
      { hex: "#ffffff", name: "White" },
      { hex: "#e8b04b", name: "Mustard" },
      { hex: "#d9534f", name: "Coral" },
      { hex: "#3b5ba5", name: "Blue" },
    ],
    fonts: [
      { family: "Noto Sans Thai", fileUrl: null, licenceNote: "SIL OFL 1.1" },
      { family: "Anuphan", fileUrl: null, licenceNote: "SIL OFL 1.1" },
    ],
    // Mirrors the artwork rules the artwork page shows (settings, D-070).
    rules: { bleedMm: 3, safeMarginMm: 3, minDpi: 300 },
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
  // CONTRACT-REQUEST store.design-share
  mockRequest("POST /v1/store/designs/{designId}/actions/share", ({ params, body, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const live = shareOf.get(row.design.id);
    const current = live ? shares.get(live) : undefined;
    if (live && current && (!current.expiresAt || current.expiresAt > new Date().toISOString())) {
      return { token: live, createdAt: current.createdAt, expiresAt: current.expiresAt };
    }
    const token = crypto.randomUUID().replace(/-/g, "");
    const createdAt = new Date().toISOString();
    const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString() : null;
    shares.set(token, { designId: row.design.id, createdAt, expiresAt });
    shareOf.set(row.design.id, token);
    return { token, createdAt, expiresAt };
  }),

  mockRequest("DELETE /v1/store/designs/{designId}/share", ({ params, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const token = shareOf.get(row.design.id);
    if (token) shares.delete(token);
    shareOf.delete(row.design.id);
    return undefined as never;
  }),

  mockRequest("GET /v1/store/shared-designs/{token}", ({ params }) => {
    const share = shares.get(params.token);
    const row = share ? designs.get(share.designId) : undefined;
    if (!share || !row || (share.expiresAt && share.expiresAt < new Date().toISOString())) {
      return problem(404, "design.share_not_found", "ลิงก์นี้ไม่มีอยู่หรือหมดอายุแล้ว");
    }
    return {
      name: row.design.name,
      styleId: row.design.styleId,
      document: row.design.document,
      assets: row.design.assets.map((a) => ({ id: a.id, url: a.url })),
      sharedAt: share.createdAt,
    };
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
    saveVersion(row, "manual", document);
    if (body.title) row.design = { ...row.design, name: body.title };
    if (body.thumbnailFileId) {
      row.thumbnailFileId = body.thumbnailFileId;
      row.design = { ...row.design, thumbnailUrl: fileDataUrl(body.thumbnailFileId) };
    }
    return withDesignEtag(row);
  }),

  // store.designs.delete (published): a soft delete — an order keeps the version it used.
  http.delete("*/v1/store/designs/:designId", ({ params, request }) => {
    const row = rowOf(request, String(params.designId));
    if (row instanceof Response) return row;
    designs.delete(row.design.id);
    return new HttpResponse(null, { status: 204 });
  }),

  mockRequest("POST /v1/store/designs/{designId}/actions/duplicate", ({ params, body, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const copy = create(row.owner, {
      name: body.name,
      document: structuredClone(row.design.document),
      source: "copy",
      product: row.design.product,
      patternId: row.design.patternId,
      materialId: row.design.materialId,
      catalogProductId: row.catalogProductId,
      semiDesignTemplateId: row.semiDesignTemplateId,
    });
    copy.design.assets = [...row.design.assets];
    return withEtag("POST /v1/store/designs/{designId}/actions/duplicate", copy.design, 201);
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
    } satisfies Schemas["DesignVersionDto"]);
  }),

  mockRequest("POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore", ({ params, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const stale = checkMatch(request, row);
    if (stale) return stale;
    const version = row.versions.find((candidate) => candidate.versionNo === Number(params.versionNo));
    if (!version) return problem(404, "design.version_not_found", "ไม่พบเวอร์ชันนี้");
    saveVersion(row, "restore", structuredClone(version.document), `คืนค่าจากเวอร์ชัน ${version.versionNo}`);
    return withEtag("POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore", row.design);
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

  mockRequest("POST /v1/store/designs/actions/import", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = ownerIdOf(customer);
    const imported: { localId: string; designId: string }[] = [];
    const skipped: { localId: string; reason: string }[] = [];
    for (const item of body.designs) {
      const key = `${owner}:${item.localId}`;
      const already = importedLocalIds.get(key);
      if (already) {
        imported.push({ localId: item.localId, designId: already });
        continue;
      }
      if (typeof item.document.spec !== "object") {
        skipped.push({ localId: item.localId, reason: "unreadable" });
        continue;
      }
      const row = create(owner, { name: item.name, document: item.document, source: "import" });
      row.design.createdAt = item.createdAt;
      row.versions[0]!.kind = "import";
      importedLocalIds.set(key, row.design.id);
      imported.push({ localId: item.localId, designId: row.design.id });
    }
    return { imported, skipped };
  }),

  mockRequest("GET /v1/store/designer/catalog", ({ query }) => designerCatalog(query.product)),

  mockRequest("GET /v1/store/designer/templates/{templateId}", ({ params }) => {
    const template = TEMPLATES.find((candidate) => candidate.id === params.templateId);
    return template ?? problem(404, "template.not_found", "ไม่พบเทมเพลตนี้");
  }),
];
