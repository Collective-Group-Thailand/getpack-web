/**
 * CONTRACT-REQUEST store.designs, store.design-assets, store.designer-catalog (F4 Part C).
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

import { HttpResponse } from "msw";
import type { z } from "zod";

import { REQUESTS, type RequestKey } from "@/lib/api/requests/registry";
import type { designDocument, storeDesign } from "@/lib/api/requests/store-designs";

import { catalogueRows } from "../admin/catalogue";
import { orders } from "../admin/commerce";
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
}

const designs = new Map<string, Row>();
const byIdempotencyKey = new Map<string, string>();
const importedLocalIds = new Map<string, string>();
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

function summaryFields(design: StoreDesign) {
  return { ...design, styleId: styleOf(design.document) };
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
  };
  designs.set(design.id, row);
  return row;
}

/** The design, as the back office sees it (a customer's document is read-only there). */
export function storeDesignForStaff(id: string) {
  return designs.get(id)?.design ?? null;
}

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
  mockRequest("GET /v1/store/designs", ({ query, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = ownerIdOf(customer);
    const rows = [...designs.values()]
      .filter((row) => row.owner === owner)
      .map((row) => row.design)
      .filter((design) => (query.linked === "linked" ? design.link : query.linked === "unlinked" ? !design.link : true))
      .filter((design) => matchesQuery(query.q, design.name))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const pageOf = paginate(rows, query);
    return {
      ...pageOf,
      data: pageOf.data.map(({ id, name, styleId, thumbnailUrl, product, link, versionNo, createdAt, updatedAt }) => ({
        id,
        name,
        styleId,
        thumbnailUrl,
        product,
        link,
        versionNo,
        createdAt,
        updatedAt,
      })),
    };
  }),

  mockRequest("POST /v1/store/designs", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const owner = ownerIdOf(customer);
    const key = `${owner}:${request.headers.get("idempotency-key")}`;
    const replay = byIdempotencyKey.get(key);
    if (replay && designs.has(replay)) return withEtag("POST /v1/store/designs", designs.get(replay)!.design, 201);

    let link: StoreDesign["link"] = null;
    if (body.link) {
      const order = orders.find((candidate) => candidate.id === body.link!.orderId && candidate.customer.id === owner);
      if (!order) return problem(404, "order.not_found", "ไม่พบคำสั่งซื้อนี้");
      link = {
        orderId: order.id,
        orderCode: order.orderCode,
        itemId: body.link.itemId,
        itemName: order.parts[0]?.name ?? order.orderCode,
      };
    }
    let document = body.document;
    if (body.templateId) {
      const template = TEMPLATES.find((candidate) => candidate.id === body.templateId);
      if (!template) return problem(404, "template.not_found", "ไม่พบเทมเพลตนี้");
      document = { ...template.document, spec: { ...template.document.spec, ...body.document.spec } };
    }
    const row = create(owner, {
      name: body.name,
      document,
      source: body.source,
      product: productOf(body.catalogProductSlug),
      link,
      patternId: body.patternId ?? null,
      materialId: body.materialId ?? null,
    });
    byIdempotencyKey.set(key, row.design.id);
    return withEtag("POST /v1/store/designs", summaryFields(row.design), 201);
  }),

  mockRequest("GET /v1/store/designs/{designId}", ({ params, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    return withEtag("GET /v1/store/designs/{designId}", row.design);
  }),

  mockRequest("PUT /v1/store/designs/{designId}", ({ params, body, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const stale = checkMatch(request, row);
    if (stale) return stale;
    saveVersion(row, body.kind, body.document);
    row.design = {
      ...row.design,
      name: body.name,
      ...(body.patternId !== undefined ? { patternId: body.patternId } : {}),
      ...(body.materialId !== undefined ? { materialId: body.materialId } : {}),
      ...(body.thumbnailFileId ? { thumbnailUrl: fileDataUrl(body.thumbnailFileId) } : {}),
    };
    return withEtag("PUT /v1/store/designs/{designId}", row.design);
  }),

  mockRequest("DELETE /v1/store/designs/{designId}", ({ params, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    if (row.design.link) return problem(409, "design.linked", "แบบนี้ผูกกับคำสั่งซื้อแล้ว ลบไม่ได้");
    designs.delete(params.designId);
    return undefined as never;
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
    });
    copy.design.assets = [...row.design.assets];
    return withEtag("POST /v1/store/designs/{designId}/actions/duplicate", copy.design, 201);
  }),

  mockRequest("GET /v1/store/designs/{designId}/versions", ({ params, query, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const start = query.cursor ? Number(query.cursor) : 0;
    const limit = query.limit ?? 20;
    const slice = row.versions.slice(start, start + limit);
    return {
      data: slice.map(({ document: _document, ...version }) => {
        void _document;
        return { ...version, thumbnailUrl: null };
      }),
      meta: { nextCursor: start + limit < row.versions.length ? String(start + limit) : null },
    };
  }),

  mockRequest("GET /v1/store/designs/{designId}/versions/{versionNo}", ({ params, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const version = row.versions.find((candidate) => candidate.versionNo === Number(params.versionNo));
    if (!version) return problem(404, "design.version_not_found", "ไม่พบเวอร์ชันนี้");
    return { ...version, thumbnailUrl: null };
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

  mockRequest("POST /v1/store/designs/{designId}/assets", ({ params, body, request }) => {
    const row = rowOf(request, params.designId);
    if (row instanceof Response) return row;
    const file = files.get(body.fileId);
    if (!file) return problem(404, "file.not_found", "ไม่พบไฟล์นี้");
    const asset = {
      id: mockId("das", row.design.assets.length + 1 + counter * 100),
      fileId: body.fileId,
      url: fileDataUrl(file.id) ?? `data:text/plain,${encodeURIComponent(file.originalName)}`,
      mimeType: file.mimeType,
      widthPx: body.widthPx ?? null,
      heightPx: body.heightPx ?? null,
      sizeBytes: file.sizeBytes,
      createdAt: bangkokIso(),
    };
    row.design.assets.push(asset);
    return asset;
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
