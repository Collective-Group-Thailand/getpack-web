/**
 * Packio Factory ERP E1 (packio-api v0.44.0; D-316 – D-327) for `pnpm dev:mock` and the e2e: per factory,
 * suppliers and customers, warehouses, items, a stock ledger at moving average cost, purchase orders and
 * goods receipts — the rules of the real API (factory-scoped 404, permissions, idempotent posts, ETags,
 * no negative stock, over-receipt tolerance, numbering `<PREFIX>-YYMM-NNNN`). A mock is a fake engine, so it
 * does its sums in numbers; the screens never do. All data obviously fake.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { matchesQuery, mockId, paginate, problem } from "../support";
import { pageQuery } from "./billing";
import { canPartner, permissionsOf } from "./personas";
import { type Own, once, own } from "./support";

type Partner = Schemas["ErpTradingPartnerDto"];
type Warehouse = Schemas["ErpWarehouseDto"];
type Item = Omit<Schemas["ErpItemDto"], "stock">;
type Movement = Schemas["ErpStockMovementDto"];
type Po = Omit<Schemas["ErpPurchaseOrderDto"], "nextActions" | "late">;
type Gr = Schemas["ErpGoodsReceiptDto"];
type Unit = Schemas["ErpItemDto"]["baseUnit"];

interface Balance {
  onHand: number;
  value: number;
}

interface Erp {
  settings: {
    disabledModules: string[];
    allowNegativeStock: boolean;
    overReceiptPct: number;
    priceTolerancePct: number;
    requireRequestApproval: boolean;
    priceAlertPct: number;
    quoteExpiryDays: number;
    supplierApproval: "off" | "warn" | "enforce";
    prefixes: Record<string, string>;
    version: number;
  };
  partners: Partner[];
  warehouses: Warehouse[];
  items: Item[];
  balances: Map<string, Balance>;
  movements: Movement[];
  pos: Po[];
  grs: Gr[];
  series: Map<string, number>;
  seq: number;
}

const MODULES = [
  "inventory",
  "procurement",
  "partners",
  "planning",
  "floor",
  "sales",
  "accounting",
  "maintenance",
  "documents",
] as const;
const PREFIX: Record<string, string> = {
  po: "PO",
  gr: "GR",
  adj: "ADJ",
  trf: "TRF",
  iss: "ISS",
  pr: "PR",
  ap: "AP",
  pv: "PV",
  mo: "MO",
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
const q3 = (n: number) => r3(n).toFixed(3);
const m2 = (n: number) => r2(n).toFixed(2);
const c6 = (n: number) => r6(n).toFixed(6);
const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const now = () => `${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;
const etag = (id: string, version: number) => `"${id}:${version}"`;
const invalid = (path: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code: "invalid", message }]);
const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้");

const states = new Map<string, Erp>();

/** The three stock actions' bodies, read loosely (the API validates them). */
interface StockBody {
  kind?: string;
  warehouseId?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  reason?: string | null;
  reference?: string | null;
  lines?: { itemId: string; quantity: string; unitCost?: string; lotNo?: string | null }[];
}

function seed(): Erp {
  const erp: Erp = {
    settings: {
      disabledModules: [],
      allowNegativeStock: false,
      overReceiptPct: 10,
      priceTolerancePct: 2,
      requireRequestApproval: true,
      priceAlertPct: 5,
      quoteExpiryDays: 7,
      supplierApproval: "warn",
      prefixes: {},
      version: 1,
    },
    partners: [],
    warehouses: [],
    items: [],
    balances: new Map(),
    movements: [],
    pos: [],
    grs: [],
    series: new Map(),
    seq: 0,
  };
  const id = (ns: string) => mockId(ns, (erp.seq += 1));
  const partner = (code: string, kind: Partner["kind"], name: string, days: number): Partner => ({
    id: id("etp"),
    code,
    kind,
    name,
    taxId: null,
    branchCode: null,
    entityType: "juristic",
    salesperson: null,
    contactName: "คุณทดสอบ (ข้อมูลจำลอง)",
    phone: "020000000",
    email: null,
    address: "99 ถนนทดสอบ กรุงเทพฯ 10000 (ข้อมูลจำลอง)",
    paymentTermDays: days,
    creditLimit: null,
    note: null,
    status: "active",
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  });
  const paper = partner("S0001", "supplier", "บจก. กระดาษทดสอบ (ข้อมูลจำลอง)", 30);
  const ink = partner("S0002", "supplier", "หจก. หมึกพิมพ์ทดสอบ (ข้อมูลจำลอง)", 30);
  erp.partners.push(paper, ink, partner("C0001", "customer", "บจก. ลูกค้าตรงทดสอบ (ข้อมูลจำลอง)", 30));
  const main: Warehouse = {
    id: id("ewh"),
    code: "MAIN",
    name: "คลังหลัก",
    isDefault: true,
    status: "active",
    version: 1,
  };
  erp.warehouses.push(main, {
    id: id("ewh"),
    code: "LINE",
    name: "คลังหน้าเครื่อง",
    isDefault: false,
    status: "active",
    version: 1,
  });
  const item = (
    sku: string,
    name: string,
    kind: Item["kind"],
    baseUnit: Unit,
    purchase: [Unit, number] | null,
    supplier: Partner,
    reorderPoint: number,
    reorderQty: number,
    opening: number,
    cost: number,
  ) => {
    const it: Item = {
      id: id("eit"),
      sku,
      name: `${name} (ข้อมูลจำลอง)`,
      kind,
      material: null,
      baseUnit,
      purchaseUnit: purchase?.[0] ?? null,
      purchaseFactor: c6(purchase?.[1] ?? 1),
      reorderPoint: q3(reorderPoint),
      reorderQty: q3(reorderQty),
      leadTimeDays: 7,
      defaultSupplier: { id: supplier.id, code: supplier.code, name: supplier.name },
      trackLots: false,
      lastPurchasePrice: c6(cost * (purchase?.[1] ?? 1)),
      note: null,
      status: "active",
      version: 1,
    };
    erp.items.push(it);
    post(
      erp,
      it,
      main,
      "opening",
      opening,
      cost,
      { type: "adjustment", id: "0192f3a0-7c1e-7d2a-9b1f-0000000ee001", no: "ADJ-2610-0001" },
      "ยอดยกมา",
      null,
      "เจ้าของโรงงาน ตัวอย่าง (ข้อมูลจำลอง)",
    );
  };
  item(
    "KA-350",
    "กระดาษคราฟท์ 350 แกรม 31×43 นิ้ว",
    "raw_material",
    "sheet",
    ["ream", 500],
    paper,
    5000,
    10000,
    12500,
    2.85,
  );
  item("ART-300", "กระดาษอาร์ตการ์ด 300 แกรม", "raw_material", "sheet", ["ream", 500], paper, 4000, 10000, 3000, 3.4);
  item("INK-K", "หมึกออฟเซ็ต สีดำ", "consumable", "kg", null, ink, 20, 50, 35, 320);
  item("GLUE-PVA", "กาวน้ำ PVA", "consumable", "kg", null, ink, 40, 100, 18, 85);
  erp.series.set("adj:2610", 1);
  return erp;
}

function state(factoryId: string): Erp {
  let erp = states.get(factoryId);
  if (!erp) {
    erp = seed();
    states.set(factoryId, erp);
  }
  return erp;
}

function number(erp: Erp, type: string, at = today()): string {
  const period = `${at.slice(2, 4)}${at.slice(5, 7)}`;
  const key = `${type}:${period}`;
  const n = (erp.series.get(key) ?? 0) + 1;
  erp.series.set(key, n);
  return `${erp.settings.prefixes[type] ?? PREFIX[type]}-${period}-${String(n).padStart(4, "0")}`;
}

function post(
  erp: Erp,
  item: Item,
  warehouse: Warehouse,
  kind: Movement["kind"],
  quantity: number,
  unitCost: number | null,
  source: { type: Movement["sourceType"]; id: string; no: string },
  reason: string | null,
  lotNo: string | null,
  by: string,
): Movement {
  const key = `${item.id}:${warehouse.id}`;
  const before = erp.balances.get(key) ?? { onHand: 0, value: 0 };
  const avg = before.onHand > 0 ? before.value / before.onHand : 0;
  const factor = Number(item.purchaseFactor);
  const fallback = item.lastPurchasePrice ? Number(item.lastPurchasePrice) / factor : 0;
  const cost = quantity > 0 ? (unitCost ?? (avg > 0 ? avg : fallback)) : avg;
  const onHand = r3(before.onHand + quantity);
  const value = onHand === 0 ? -before.value : r2(quantity * cost);
  const after = {
    onHand,
    value: onHand === 0 ? 0 : quantity > 0 && before.onHand <= 0 ? r2(onHand * cost) : r2(before.value + value),
  };
  erp.balances.set(key, after);
  const movement: Movement = {
    id: mockId("emv", (erp.seq += 1)),
    occurredAt: now(),
    kind,
    item: { id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit },
    warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name },
    quantity: q3(quantity),
    unitCost: c6(cost),
    value: m2(value),
    balanceAfter: q3(onHand),
    lotNo,
    documentNo: source.no,
    sourceType: source.type,
    sourceId: source.id,
    reason,
    by,
  };
  erp.movements.unshift(movement);
  return movement;
}

const totals = (erp: Erp, item: Item) => {
  let onHand = 0;
  let value = 0;
  for (const w of erp.warehouses) {
    const b = erp.balances.get(`${item.id}:${w.id}`);
    if (b) {
      onHand += b.onHand;
      value += b.value;
    }
  }
  return { onHand: r3(onHand), value: r2(value) };
};

const onOrder = (erp: Erp, item: Item) =>
  r3(
    erp.pos
      .filter((po) => po.status === "issued" || po.status === "partially_received")
      .flatMap((po) => po.lines)
      .filter((line) => line.item.id === item.id)
      .reduce((a, line) => a + Math.max(Number(line.quantity) - Number(line.receivedQty), 0) * Number(line.factor), 0),
  );

function itemDto(erp: Erp, item: Item): Schemas["ErpItemDto"] {
  const t = totals(erp, item);
  const ordered = onOrder(erp, item);
  return {
    ...item,
    stock: {
      onHand: q3(t.onHand),
      reserved: "0.000",
      onOrder: q3(ordered),
      available: q3(t.onHand),
      avgCost: c6(t.onHand > 0 ? t.value / t.onHand : 0),
      value: m2(t.value),
      low: item.reorderPoint !== null && t.onHand + ordered <= Number(item.reorderPoint),
    },
  };
}

const late = (po: Po) =>
  (po.status === "issued" || po.status === "partially_received") && !!po.expectedOn && po.expectedOn < today();

function poDto(po: Po, who: Own["who"]): Schemas["ErpPurchaseOrderDto"] {
  const can = (p: string) => permissionsOf(who).includes(p);
  const actions: Schemas["ErpPurchaseOrderDto"]["nextActions"] = [];
  const add = (key: string, permission: string, when: boolean, irreversible = false) => {
    if (when && can(permission)) actions.push({ key, irreversible, disabledReason: null });
  };
  add("erp_po.edit", "factory_procurement.manage", po.status === "draft");
  add("erp_po.issue", "factory_procurement.approve", po.status === "draft", true);
  add("erp_po.receive", "factory_inventory.manage", po.status === "issued" || po.status === "partially_received");
  add("erp_po.close", "factory_procurement.manage", po.status === "partially_received");
  add("erp_po.cancel", "factory_procurement.manage", po.status === "draft" || po.status === "issued", true);
  return { ...po, late: late(po), nextActions: actions };
}

function poSummary(po: Po): Schemas["ErpPurchaseOrderSummaryDto"] {
  const ordered = po.lines.reduce((a, l) => a + Number(l.quantity), 0);
  const received = po.lines.reduce((a, l) => a + Math.min(Number(l.receivedQty), Number(l.quantity)), 0);
  return {
    id: po.id,
    poNo: po.poNo,
    status: po.status,
    supplier: po.supplier,
    orderedOn: po.orderedOn,
    expectedOn: po.expectedOn,
    late: late(po),
    total: po.total,
    currency: "THB",
    lineCount: po.lines.length,
    receivedPct: ordered ? ((received * 100) / ordered).toFixed(2) : "0.00",
  };
}

const withEtag = <T extends { id: string; version: number }>(body: T, status = 200) =>
  HttpResponse.json(body, { status, headers: { ETag: etag(body.id, body.version) } });

function ifMatch(request: Request, current: string): Response | null {
  const match = request.headers.get("if-match");
  if (!match) return problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
  if (match !== "*" && match !== current) return problem(412, "concurrency.stale", "มีคนแก้ข้อมูลนี้ไปก่อนแล้ว");
  return null;
}

async function body<T>(request: Request): Promise<Partial<T>> {
  return (await request
    .clone()
    .json()
    .catch(() => ({}))) as Partial<T>;
}

const BASE = "*/v1/partner/factories/:factoryId/erp";

/** A draft purchase order from a save body (`POST /purchase-orders`, purchase requests in erp-e2). */
function draftPo(erp: Erp, b: Schemas["ErpSavePurchaseOrderDto"]): Po | Response {
  const supplier = erp.partners.find((p) => p.id === b.supplierId);
  if (!supplier) return notFound();
  const lines = linesOf(erp, b.lines ?? []);
  if (lines instanceof Response) return lines;
  const mode = (b.vatMode ?? "exclusive") as Po["vatMode"];
  const rate = Number(b.vatRatePct ?? 7);
  return {
    id: mockId("epo", (erp.seq += 1)),
    poNo: null,
    status: "draft",
    supplier: { id: supplier.id, code: supplier.code, name: supplier.name },
    orderedOn: b.orderedOn ?? today(),
    expectedOn: b.expectedOn ?? null,
    vatMode: mode,
    vatRatePct: rate.toFixed(4),
    ...totalsOf(lines, mode, rate),
    currency: "THB",
    supplierRef: b.supplierRef ?? null,
    deliverTo: b.deliverTo ?? null,
    note: b.note ?? null,
    issuedAt: null,
    closedAt: null,
    cancelReason: null,
    lines,
    receipts: [],
    warnings: [],
    version: 1,
  };
}

function scope(request: Request, factoryId: unknown, permission?: string): Response | (Own & { erp: Erp }) {
  const ok = own(request, factoryId, permission);
  if (ok instanceof Response) return ok;
  return { ...ok, erp: state(String(factoryId)) };
}

function totalsOf(lines: { amount: string }[], mode: Po["vatMode"], rate: number) {
  const sum = r2(lines.reduce((a, l) => a + Number(l.amount), 0));
  if (mode === "none") return { subtotal: m2(sum), vatAmount: "0.00", total: m2(sum) };
  if (mode === "exclusive") {
    const vat = r2((sum * rate) / 100);
    return { subtotal: m2(sum), vatAmount: m2(vat), total: m2(sum + vat) };
  }
  const vat = r2((sum * rate) / (100 + rate));
  return { subtotal: m2(sum - vat), vatAmount: m2(vat), total: m2(sum) };
}

function linesOf(erp: Erp, input: Schemas["ErpSavePurchaseOrderDto"]["lines"]): Po["lines"] | Response {
  const out: Po["lines"] = [];
  for (const [index, line] of input.entries()) {
    const item = erp.items.find((i) => i.id === line.itemId);
    if (!item) return notFound();
    const unit = (line.unit ?? item.purchaseUnit ?? item.baseUnit) as Unit;
    if (unit !== item.baseUnit && unit !== item.purchaseUnit)
      return problem(422, "erp.unit_not_allowed", `${item.name} ใช้หน่วยนี้ไม่ได้`);
    const factor = unit === item.baseUnit ? 1 : Number(item.purchaseFactor);
    const quantity = Number(line.quantity);
    const price = Number(line.unitPrice);
    const discount = Number(line.discountPct ?? 0);
    out.push({
      id: mockId("epl", index + 1 + erp.seq * 100),
      lineNo: index + 1,
      item: { id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit },
      description: line.description ?? null,
      quantity: q3(quantity),
      unit,
      factor: c6(factor),
      unitPrice: c6(price),
      discountPct: discount.toFixed(4),
      amount: m2((quantity * price * (100 - discount)) / 100),
      receivedQty: "0.000",
      remainingQty: q3(quantity),
    });
  }
  return out;
}

export const erpHandlers = [
  // ----------------------------------------------------------------------------------- settings
  http.get(`${BASE}/settings`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    const s = ok.erp.settings;
    return HttpResponse.json(
      {
        modules: MODULES.filter((m) => !s.disabledModules.includes(m)),
        allowNegativeStock: s.allowNegativeStock,
        overReceiptPct: s.overReceiptPct.toFixed(4),
        priceTolerancePct: s.priceTolerancePct.toFixed(4),
        requireRequestApproval: s.requireRequestApproval,
        priceAlertPct: s.priceAlertPct.toFixed(4),
        quoteExpiryDays: s.quoteExpiryDays,
        supplierApproval: s.supplierApproval,
        prefixes: { ...PREFIX, ...s.prefixes },
        vatRegistered: true,
        quoteValidDays: 30,
        documentLogoFileId: null,
        documentFooter: null,
        bankDetails: null,
        signatoryName: null,
        labourRatePerHour: "120.00",
        overheadPct: "15.0000",
        dailySummary: true,
        oeeAlertPct: "50.0000",
        version: s.version,
      } satisfies Schemas["ErpSettingsDto"],
      { headers: { ETag: etag("erp-settings", s.version) } },
    );
  }),
  http.patch(`${BASE}/settings`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_erp.configure");
    if (ok instanceof Response) return ok;
    const s = ok.erp.settings;
    const stale = ifMatch(request, etag("erp-settings", s.version));
    if (stale) return stale;
    const b = await body<Schemas["UpdateErpSettingsDto"]>(request);
    if (b.modules) s.disabledModules = MODULES.filter((m) => !b.modules!.includes(m));
    if (b.allowNegativeStock !== undefined) s.allowNegativeStock = b.allowNegativeStock;
    if (b.overReceiptPct !== undefined) s.overReceiptPct = Number(b.overReceiptPct);
    if (b.priceTolerancePct !== undefined) s.priceTolerancePct = Number(b.priceTolerancePct);
    if (b.requireRequestApproval !== undefined) s.requireRequestApproval = b.requireRequestApproval;
    if (b.priceAlertPct !== undefined) s.priceAlertPct = Number(b.priceAlertPct);
    if (b.quoteExpiryDays !== undefined) s.quoteExpiryDays = b.quoteExpiryDays;
    if (b.supplierApproval !== undefined) s.supplierApproval = b.supplierApproval;
    if (b.prefixes) s.prefixes = { ...s.prefixes, ...b.prefixes };
    s.version += 1;
    return HttpResponse.json(
      {
        modules: MODULES.filter((m) => !s.disabledModules.includes(m)),
        allowNegativeStock: s.allowNegativeStock,
        overReceiptPct: s.overReceiptPct.toFixed(4),
        priceTolerancePct: s.priceTolerancePct.toFixed(4),
        requireRequestApproval: s.requireRequestApproval,
        priceAlertPct: s.priceAlertPct.toFixed(4),
        quoteExpiryDays: s.quoteExpiryDays,
        supplierApproval: s.supplierApproval,
        prefixes: { ...PREFIX, ...s.prefixes },
        vatRegistered: true,
        quoteValidDays: 30,
        documentLogoFileId: null,
        documentFooter: null,
        bankDetails: null,
        signatoryName: null,
        labourRatePerHour: "120.00",
        overheadPct: "15.0000",
        dailySummary: true,
        oeeAlertPct: "50.0000",
        version: s.version,
      } satisfies Schemas["ErpSettingsDto"],
      { headers: { ETag: etag("erp-settings", s.version) } },
    );
  }),

  // ---------------------------------------------------------------------------- trading partners
  http.get(`${BASE}/partners`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_trading_partners.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status") ?? "active";
    const q = url.searchParams.get("q") ?? undefined;
    const rows = ok.erp.partners.filter(
      (p) =>
        p.status === status &&
        (!role || p.kind === role || p.kind === "both") &&
        matchesQuery(q, p.name, p.code, p.taxId, p.phone, p.contactName),
    );
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.post(`${BASE}/partners`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_trading_partners.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpCreateTradingPartnerDto"]>(request);
    if (!b.name?.trim()) return invalid("name", "ใส่ชื่อ");
    const kind = (b.kind ?? "supplier") as Partner["kind"];
    const prefix = { supplier: "S", customer: "C", both: "P" }[kind];
    const code =
      b.code ??
      `${prefix}${String(ok.erp.partners.filter((p) => p.code.startsWith(prefix)).length + 1).padStart(4, "0")}`;
    if (ok.erp.partners.some((p) => p.code === code)) return problem(409, "erp.code_taken", `รหัส ${code} มีอยู่แล้ว`);
    const partner: Partner = {
      id: mockId("etp", (ok.erp.seq += 1)),
      code,
      kind,
      name: b.name.trim(),
      taxId: b.taxId ?? null,
      branchCode: b.branchCode ?? (b.taxId ? "00000" : null),
      entityType: b.entityType ?? "juristic",
      salesperson: null,
      contactName: b.contactName ?? null,
      phone: b.phone ?? null,
      email: b.email ?? null,
      address: b.address ?? null,
      paymentTermDays: b.paymentTermDays ?? 0,
      creditLimit: b.creditLimit ? m2(Number(b.creditLimit)) : null,
      note: b.note ?? null,
      status: "active",
      version: 1,
      createdAt: now(),
      updatedAt: now(),
    };
    ok.erp.partners.push(partner);
    return withEtag(partner, 201);
  }),
  http.get(`${BASE}/partners/:partnerId`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_trading_partners.read");
    if (ok instanceof Response) return ok;
    const partner = ok.erp.partners.find((p) => p.id === params.partnerId);
    return partner ? withEtag(partner) : notFound();
  }),
  http.patch(`${BASE}/partners/:partnerId`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_trading_partners.manage");
    if (ok instanceof Response) return ok;
    const partner = ok.erp.partners.find((p) => p.id === params.partnerId);
    if (!partner) return notFound();
    const stale = ifMatch(request, etag(partner.id, partner.version));
    if (stale) return stale;
    const b = await body<Schemas["ErpUpdateTradingPartnerDto"]>(request);
    Object.assign(partner, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)), {
      version: partner.version + 1,
      updatedAt: now(),
    });
    return withEtag(partner);
  }),

  // -------------------------------------------------------------------------------- warehouses
  http.get(`${BASE}/warehouses`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json([...ok.erp.warehouses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)));
  }),
  http.post(`${BASE}/warehouses`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpCreateWarehouseDto"]>(request);
    const code = (b.code ?? "").toUpperCase();
    if (ok.erp.warehouses.some((w) => w.code === code))
      return problem(409, "erp.code_taken", `รหัส ${code} มีอยู่แล้ว`);
    const warehouse: Warehouse = {
      id: mockId("ewh", (ok.erp.seq += 1)),
      code,
      name: b.name ?? code,
      isDefault: false,
      status: "active",
      version: 1,
    };
    ok.erp.warehouses.push(warehouse);
    return withEtag(warehouse, 201);
  }),
  http.patch(`${BASE}/warehouses/:warehouseId`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.manage");
    if (ok instanceof Response) return ok;
    const warehouse = ok.erp.warehouses.find((w) => w.id === params.warehouseId);
    if (!warehouse) return notFound();
    const stale = ifMatch(request, etag(warehouse.id, warehouse.version));
    if (stale) return stale;
    const b = await body<Schemas["ErpUpdateWarehouseDto"]>(request);
    if (b.isDefault) for (const w of ok.erp.warehouses) w.isDefault = w.id === warehouse.id;
    if (b.name) warehouse.name = b.name;
    if (b.status) warehouse.status = b.status;
    warehouse.version += 1;
    return withEtag(warehouse);
  }),

  // ------------------------------------------------------------------------------------- items
  http.get(`${BASE}/items`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const status = url.searchParams.get("status") ?? "active";
    const kind = url.searchParams.get("kind");
    let rows = ok.erp.items
      .filter((i) => i.status === status && (!kind || i.kind === kind) && matchesQuery(q, i.sku, i.name))
      .map((i) => itemDto(ok.erp, i));
    if (url.searchParams.get("low") === "true") rows = rows.filter((i) => i.stock.low);
    return HttpResponse.json(
      paginate(
        rows.sort((a, b) => a.sku.localeCompare(b.sku)),
        pageQuery(url),
      ),
    );
  }),
  http.post(`${BASE}/items`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["CreateErpItemDto"]>(request);
    const sku = (b.sku ?? "").toUpperCase();
    if (!sku || !b.name) return invalid("sku", "ใส่รหัสและชื่อสินค้า");
    if (ok.erp.items.some((i) => i.sku === sku)) return problem(409, "erp.sku_taken", `มีสินค้ารหัส ${sku} อยู่แล้ว`);
    const supplier = ok.erp.partners.find((p) => p.id === b.defaultSupplierId);
    const item: Item = {
      id: mockId("eit", (ok.erp.seq += 1)),
      sku,
      name: b.name,
      kind: (b.kind ?? "raw_material") as Item["kind"],
      material: null,
      baseUnit: (b.baseUnit ?? "pcs") as Unit,
      purchaseUnit: (b.purchaseUnit ?? null) as Unit | null,
      purchaseFactor: c6(b.purchaseUnit ? Number(b.purchaseFactor ?? 1) : 1),
      reorderPoint: b.reorderPoint ? q3(Number(b.reorderPoint)) : null,
      reorderQty: b.reorderQty ? q3(Number(b.reorderQty)) : null,
      leadTimeDays: b.leadTimeDays ?? null,
      defaultSupplier: supplier ? { id: supplier.id, code: supplier.code, name: supplier.name } : null,
      trackLots: b.trackLots ?? false,
      lastPurchasePrice: null,
      note: b.note ?? null,
      status: "active",
      version: 1,
    };
    ok.erp.items.push(item);
    return withEtag(itemDto(ok.erp, item), 201);
  }),
  http.get(`${BASE}/items/:itemId`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    const item = ok.erp.items.find((i) => i.id === params.itemId);
    return item ? withEtag(itemDto(ok.erp, item)) : notFound();
  }),
  http.patch(`${BASE}/items/:itemId`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.manage");
    if (ok instanceof Response) return ok;
    const item = ok.erp.items.find((i) => i.id === params.itemId);
    if (!item) return notFound();
    const stale = ifMatch(request, etag(item.id, item.version));
    if (stale) return stale;
    const b = await body<Schemas["UpdateErpItemDto"]>(request);
    if (b.name) item.name = b.name;
    if (b.kind) item.kind = b.kind;
    if (b.status) item.status = b.status;
    if (b.reorderPoint !== undefined) item.reorderPoint = b.reorderPoint === null ? null : q3(Number(b.reorderPoint));
    if (b.reorderQty !== undefined) item.reorderQty = b.reorderQty === null ? null : q3(Number(b.reorderQty));
    if (b.leadTimeDays !== undefined) item.leadTimeDays = b.leadTimeDays;
    if (b.trackLots !== undefined) item.trackLots = b.trackLots;
    if (b.note !== undefined) item.note = b.note;
    if (b.purchaseUnit !== undefined) {
      item.purchaseUnit = b.purchaseUnit;
      item.purchaseFactor = c6(b.purchaseUnit ? Number(b.purchaseFactor ?? item.purchaseFactor) : 1);
    }
    if (b.defaultSupplierId !== undefined) {
      const s = ok.erp.partners.find((p) => p.id === b.defaultSupplierId);
      item.defaultSupplier = s ? { id: s.id, code: s.code, name: s.name } : null;
    }
    item.version += 1;
    return withEtag(itemDto(ok.erp, item));
  }),

  // ------------------------------------------------------------------------------------- stock
  http.get(`${BASE}/stock/overview`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    const items = ok.erp.items.filter((i) => i.status === "active").map((i) => itemDto(ok.erp, i));
    const open = ok.erp.pos.filter((p) => p.status === "issued" || p.status === "partially_received");
    return HttpResponse.json({
      items: items.length,
      low: items.filter((i) => i.stock.low).length,
      negative: items.filter((i) => i.stock.onHand.startsWith("-")).length,
      value: m2(items.reduce((a, i) => a + Number(i.stock.value), 0)),
      currency: "THB",
      openPurchaseOrders: open.length,
      latePurchaseOrders: open.filter(late).length,
    } satisfies Schemas["ErpStockOverviewDto"]);
  }),
  http.get(`${BASE}/stock`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const rows: Schemas["ErpStockBalanceDto"][] = [];
    for (const item of ok.erp.items.filter((i) => i.status === "active" && matchesQuery(q, i.sku, i.name))) {
      const dto = itemDto(ok.erp, item);
      for (const w of ok.erp.warehouses) {
        const b = ok.erp.balances.get(`${item.id}:${w.id}`);
        if (!b) continue;
        rows.push({
          item: { id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit },
          warehouse: { id: w.id, code: w.code, name: w.name },
          onHand: q3(b.onHand),
          reserved: "0.000",
          available: q3(b.onHand),
          avgCost: c6(b.onHand > 0 ? b.value / b.onHand : 0),
          value: m2(b.value),
          reorderPoint: item.reorderPoint,
          low: dto.stock.low,
        });
      }
    }
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.get(`${BASE}/stock/movements`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const itemId = url.searchParams.get("itemId");
    const rows = ok.erp.movements.filter(
      (m) => (!itemId || m.item.id === itemId) && matchesQuery(q, m.documentNo, m.lotNo, m.item.name, m.item.sku),
    );
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.get(`${BASE}/stock/reorder`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    const rows: Schemas["ErpReorderSuggestionDto"][] = [];
    for (const item of ok.erp.items.filter((i) => i.status === "active" && i.reorderPoint !== null)) {
      const t = totals(ok.erp, item);
      const ordered = onOrder(ok.erp, item);
      const point = Number(item.reorderPoint);
      if (t.onHand + ordered > point) continue;
      const factor = Number(item.purchaseFactor);
      const wanted = Math.max(Number(item.reorderQty ?? 0), point - t.onHand - ordered);
      const units = Math.max(1, Math.ceil(wanted / factor));
      rows.push({
        item: { id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit },
        supplier: item.defaultSupplier,
        available: q3(t.onHand),
        onOrder: q3(ordered),
        reorderPoint: q3(point),
        toOrderQty: q3(units * factor),
        toOrderPurchaseQty: q3(units),
        purchaseUnit: item.purchaseUnit ?? item.baseUnit,
        lastPurchasePrice: item.lastPurchasePrice,
        needBy: null,
      });
    }
    return HttpResponse.json(rows);
  }),
  ...(["adjust", "issue", "transfer"] as const).map((action) =>
    http.post(`${BASE}/stock/actions/${action}`, async ({ request, params }) => {
      const ok = scope(
        request,
        params.factoryId,
        action === "adjust" ? "factory_inventory.adjust" : "factory_inventory.manage",
      );
      if (ok instanceof Response) return ok;
      return once(request, `erp-${action}:${String(params.factoryId)}`, async () => {
        const b = await body<StockBody>(request);
        const erp = ok.erp;
        const main = erp.warehouses.find((w) => w.isDefault)!;
        const wh = (id: string | undefined) => (id ? erp.warehouses.find((w) => w.id === id) : main);
        const kind = action === "transfer" ? "transfer" : (b.kind ?? (action === "adjust" ? "count" : "issue"));
        if ((kind === "count" || kind === "adjustment") && !b.reason) return invalid("reason", "ใส่เหตุผล");
        const from = wh(action === "transfer" ? b.fromWarehouseId : b.warehouseId);
        const to = action === "transfer" ? wh(b.toWarehouseId) : undefined;
        if (!from || (action === "transfer" && !to)) return notFound();
        if (action === "transfer" && from.id === to!.id) return problem(422, "erp.same_warehouse", "คลังซ้ำกัน");
        const lines = b.lines ?? [];
        for (const line of lines) {
          const item = erp.items.find((i) => i.id === line.itemId);
          if (!item) return notFound();
          const out =
            kind === "issue" || kind === "transfer"
              ? Number(line.quantity)
              : kind === "adjustment"
                ? -Number(line.quantity)
                : 0;
          const have = erp.balances.get(`${item.id}:${from.id}`)?.onHand ?? 0;
          if (out > 0 && have < out && !erp.settings.allowNegativeStock)
            return problem(409, "erp.stock_insufficient", `${item.name} มีพอใช้ ${have} ไม่พอสำหรับ ${out}`);
        }
        const type = action === "transfer" ? "transfer" : action === "issue" ? "issue" : "adjustment";
        const prefix = action === "transfer" ? "trf" : action === "issue" ? "iss" : "adj";
        const id = mockId("esd", (erp.seq += 1));
        const changes = lines
          .map((line) => {
            const item = erp.items.find((i) => i.id === line.itemId)!;
            const have = erp.balances.get(`${item.id}:${from.id}`)?.onHand ?? 0;
            const quantity = kind === "count" ? r3(Number(line.quantity) - have) : Number(line.quantity);
            return { item, quantity, line };
          })
          .filter((c) => c.quantity !== 0);
        if (!changes.length)
          return HttpResponse.json({ id, documentNo: null, movements: [] } satisfies Schemas["ErpStockPostingDto"]);
        const no = number(erp, prefix);
        const by = ok.who.displayName;
        const reason = [b.reference, b.reason].filter(Boolean).join(" · ") || null;
        const movements: Movement[] = [];
        for (const c of changes) {
          const lot = c.line.lotNo ?? null;
          if (action === "transfer") {
            const out = post(erp, c.item, from, "transfer_out", -c.quantity, null, { type, id, no }, reason, lot, by);
            movements.push(
              out,
              post(
                erp,
                c.item,
                to!,
                "transfer_in",
                c.quantity,
                Number(out.unitCost),
                { type, id, no },
                reason,
                lot,
                by,
              ),
            );
          } else {
            const signed = kind === "issue" ? -c.quantity : c.quantity;
            const cost = kind === "opening" && c.line.unitCost ? Number(c.line.unitCost) : null;
            movements.push(
              post(erp, c.item, from, kind as Movement["kind"], signed, cost, { type, id, no }, reason, lot, by),
            );
          }
        }
        return HttpResponse.json({ id, documentNo: no, movements } satisfies Schemas["ErpStockPostingDto"]);
      });
    }),
  ),

  // --------------------------------------------------------------------------- purchase orders
  http.get(`${BASE}/purchase-orders`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const supplierId = url.searchParams.get("supplierId");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = ok.erp.pos
      .filter(
        (po) =>
          (!status ||
            (status === "open"
              ? po.status === "issued" || po.status === "partially_received"
              : po.status === status)) &&
          (!supplierId || po.supplier.id === supplierId) &&
          matchesQuery(q, po.poNo, po.supplier.name, ...po.lines.map((l) => l.item.name)),
      )
      .map(poSummary);
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.post(`${BASE}/purchase-orders/actions/from-reorder`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpDraftFromReorderDto"]>(request);
    const created: Schemas["ErpPurchaseOrderSummaryDto"][] = [];
    const skipped: Schemas["ErpItemRefDto"][] = [];
    const bySupplier = new Map<string, Item[]>();
    for (const id of b.itemIds ?? []) {
      const item = ok.erp.items.find((i) => i.id === id);
      if (!item) return notFound();
      if (!item.defaultSupplier) {
        skipped.push({ id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit });
        continue;
      }
      bySupplier.set(item.defaultSupplier.id, [...(bySupplier.get(item.defaultSupplier.id) ?? []), item]);
    }
    for (const [supplierId, items] of bySupplier) {
      const supplier = ok.erp.partners.find((p) => p.id === supplierId)!;
      const lines = linesOf(
        ok.erp,
        items.map((item) => {
          const factor = Number(item.purchaseFactor);
          return {
            itemId: item.id,
            quantity: String(Math.max(1, Math.ceil(Number(item.reorderQty ?? factor) / factor))),
            unitPrice: item.lastPurchasePrice ?? "0",
          };
        }),
      ) as Po["lines"];
      const po: Po = {
        id: mockId("epo", (ok.erp.seq += 1)),
        poNo: null,
        status: "draft",
        supplier: { id: supplier.id, code: supplier.code, name: supplier.name },
        orderedOn: today(),
        expectedOn: null,
        vatMode: "exclusive",
        vatRatePct: "7.0000",
        ...totalsOf(lines, "exclusive", 7),
        currency: "THB",
        supplierRef: null,
        deliverTo: null,
        note: "สร้างจากรายการของใกล้หมด",
        issuedAt: null,
        closedAt: null,
        cancelReason: null,
        lines,
        receipts: [],
        warnings: [],
        version: 1,
      };
      ok.erp.pos.unshift(po);
      created.push(poSummary(po));
    }
    return HttpResponse.json({ created, skipped } satisfies Schemas["ErpDraftFromReorderResultDto"], { status: 201 });
  }),
  http.post(`${BASE}/purchase-orders`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.manage");
    if (ok instanceof Response) return ok;
    const b = (await body<Schemas["ErpSavePurchaseOrderDto"]>(request)) as Schemas["ErpSavePurchaseOrderDto"];
    const po = draftPo(ok.erp, b);
    if (po instanceof Response) return po;
    ok.erp.pos.unshift(po);
    return withEtag(poDto(po, ok.who), 201);
  }),
  http.get(`${BASE}/purchase-orders/:poId`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    const po = ok.erp.pos.find((p) => p.id === params.poId);
    return po ? withEtag(poDto(po, ok.who)) : notFound();
  }),
  http.put(`${BASE}/purchase-orders/:poId`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.manage");
    if (ok instanceof Response) return ok;
    const po = ok.erp.pos.find((p) => p.id === params.poId);
    if (!po) return notFound();
    const stale = ifMatch(request, etag(po.id, po.version));
    if (stale) return stale;
    if (po.status !== "draft") return problem(409, "erp.invalid_status", `เอกสารอยู่ในสถานะ ${po.status}`);
    const b = (await body<Schemas["ErpSavePurchaseOrderDto"]>(request)) as Schemas["ErpSavePurchaseOrderDto"];
    const supplier = ok.erp.partners.find((p) => p.id === b.supplierId);
    if (!supplier) return notFound();
    const lines = linesOf(ok.erp, b.lines ?? []);
    if (lines instanceof Response) return lines;
    const mode = (b.vatMode ?? "exclusive") as Po["vatMode"];
    const rate = Number(b.vatRatePct ?? 7);
    Object.assign(po, {
      supplier: { id: supplier.id, code: supplier.code, name: supplier.name },
      orderedOn: b.orderedOn ?? po.orderedOn,
      expectedOn: b.expectedOn ?? null,
      vatMode: mode,
      vatRatePct: rate.toFixed(4),
      ...totalsOf(lines, mode, rate),
      supplierRef: b.supplierRef ?? null,
      deliverTo: b.deliverTo ?? null,
      note: b.note ?? null,
      lines,
      version: po.version + 1,
    });
    return withEtag(poDto(po, ok.who));
  }),
  ...(["issue", "cancel", "close"] as const).map((action) =>
    http.post(`${BASE}/purchase-orders/:poId/actions/${action}`, async ({ request, params }) => {
      const ok = scope(
        request,
        params.factoryId,
        action === "issue" ? "factory_procurement.approve" : "factory_procurement.manage",
      );
      if (ok instanceof Response) return ok;
      return once(request, `erp-po-${action}:${String(params.poId)}`, async () => {
        const po = ok.erp.pos.find((p) => p.id === params.poId);
        if (!po) return notFound();
        const allowed =
          action === "issue"
            ? po.status === "draft"
            : action === "cancel"
              ? po.status === "draft" || po.status === "issued"
              : po.status === "partially_received";
        if (!allowed) return problem(409, "erp.invalid_status", `เอกสารอยู่ในสถานะ ${po.status}`);
        if (action === "issue") Object.assign(po, { status: "issued", poNo: number(ok.erp, "po"), issuedAt: now() });
        else {
          const b = await body<Schemas["ReasonDto"]>(request);
          Object.assign(po, {
            status: action === "cancel" ? "cancelled" : "closed",
            cancelReason: b.reason ?? null,
            closedAt: now(),
          });
        }
        po.version += 1;
        return withEtag(poDto(po, ok.who));
      });
    }),
  ),

  // ---------------------------------------------------------------------------- goods receipts
  http.get(`${BASE}/goods-receipts`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    return HttpResponse.json(
      paginate(
        ok.erp.grs.filter((g) => matchesQuery(q, g.grNo, g.deliveryNoteNo, g.supplier.name, g.purchaseOrder?.code)),
        pageQuery(url),
      ),
    );
  }),
  http.get(`${BASE}/goods-receipts/:grId`, ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    const gr = ok.erp.grs.find((g) => g.id === params.grId);
    return gr ? HttpResponse.json(gr) : notFound();
  }),
  http.post(`${BASE}/goods-receipts`, async ({ request, params }) => {
    const ok = scope(request, params.factoryId, "factory_inventory.manage");
    if (ok instanceof Response) return ok;
    return once(request, `erp-gr:${String(params.factoryId)}`, async () => {
      const erp = ok.erp;
      const b = (await body<Schemas["ErpCreateGoodsReceiptDto"]>(request)) as Schemas["ErpCreateGoodsReceiptDto"];
      const po = b.purchaseOrderId ? erp.pos.find((p) => p.id === b.purchaseOrderId) : undefined;
      if (b.purchaseOrderId && !po) return notFound();
      if (po && po.status !== "issued" && po.status !== "partially_received")
        return problem(409, "erp.invalid_status", `เอกสารอยู่ในสถานะ ${po.status}`);
      const supplier = po ? po.supplier : erp.partners.find((p) => p.id === b.supplierId);
      if (!supplier) return invalid("supplierId", "เลือกผู้ขาย");
      const warehouse = b.warehouseId
        ? erp.warehouses.find((w) => w.id === b.warehouseId)
        : erp.warehouses.find((w) => w.isDefault);
      if (!warehouse) return notFound();
      const lines: Gr["lines"] = [];
      for (const [index, line] of (b.lines ?? []).entries()) {
        const poLine = po?.lines.find((l) => l.id === line.purchaseOrderLineId);
        const item = erp.items.find((i) => i.id === (poLine?.item.id ?? line.itemId));
        if (!item) return notFound();
        const quantity = Number(line.quantity);
        if (poLine) {
          const max =
            (Number(poLine.quantity) * (100 + erp.settings.overReceiptPct)) / 100 - Number(poLine.receivedQty);
          if (quantity > max + 1e-9) return problem(422, "erp.over_receipt", `รับ ${item.name} ได้ไม่เกิน ${r3(max)}`);
        }
        const unit = (poLine?.unit ?? line.unit ?? item.purchaseUnit ?? item.baseUnit) as Unit;
        const factor = unit === item.baseUnit ? 1 : Number(item.purchaseFactor);
        const price = poLine
          ? (Number(poLine.unitPrice) * (100 - Number(poLine.discountPct))) / 100
          : Number(line.unitPrice ?? 0);
        lines.push({
          lineNo: index + 1,
          item: { id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit },
          quantity: q3(quantity),
          unit,
          baseQuantity: q3(quantity * factor),
          unitCost: c6(price / factor),
          amount: m2(quantity * price),
          lotNo: line.lotNo ?? null,
          // D-349: refused at inspection, recorded but not stocked nor received.
          rejectedQuantity: q3(Number(line.rejectedQuantity ?? 0)),
          rejectReason: Number(line.rejectedQuantity ?? 0) > 0 ? (line.rejectReason ?? null) : null,
          landedAmount: "0.00",
          landedUnitCost: c6(price / factor),
        });
        if (poLine) {
          poLine.receivedQty = q3(Number(poLine.receivedQty) + quantity);
          poLine.remainingQty = q3(Math.max(Number(poLine.quantity) - Number(poLine.receivedQty), 0));
        }
        if (unit === item.purchaseUnit || !item.purchaseUnit) item.lastPurchasePrice = c6(price);
      }
      const id = mockId("egr", (erp.seq += 1));
      const grNo = number(erp, "gr");
      // D-350: charges spread by value (or quantity) into the cost of what was accepted.
      const charges: Gr["charges"] = (b.charges ?? []).map((c, ci) => {
        const weights = lines.map((l) =>
          Number(l.baseQuantity) > 0 ? (c.allocation === "by_quantity" ? Number(l.baseQuantity) : Number(l.amount)) : 0,
        );
        const sum = weights.reduce((a, w) => a + w, 0) || 1;
        const split = weights.map((w) => Math.round((Number(c.amount) * w * 100) / sum) / 100);
        lines.forEach((l, i) => {
          l.landedAmount = m2(Number(l.landedAmount) + split[i]!);
          l.landedUnitCost =
            Number(l.baseQuantity) > 0
              ? c6(Number(l.unitCost) + Number(l.landedAmount) / Number(l.baseQuantity))
              : l.unitCost;
        });
        const partner = c.partnerId ? erp.partners.find((p) => p.id === c.partnerId) : undefined;
        return {
          id: mockId("elc", (erp.seq += 1) * 10 + ci),
          kind: c.kind,
          description: c.description ?? null,
          amount: m2(Number(c.amount)),
          allocation: c.allocation ?? "by_value",
          partner: partner ? { id: partner.id, code: partner.code, name: partner.name } : null,
          reference: c.reference ?? null,
          atReceipt: true,
          absorbed: m2(Number(c.amount)),
          notAbsorbed: "0.00",
          by: ok.who.displayName,
          createdAt: now(),
          lines: lines.map((l, i) => ({ lineNo: l.lineNo, amount: m2(split[i]!), absorbed: m2(split[i]!) })),
        };
      });
      for (const line of lines) {
        if (!(Number(line.baseQuantity) > 0)) continue;
        const item = erp.items.find((i) => i.id === line.item.id)!;
        post(
          erp,
          item,
          warehouse,
          "receipt",
          Number(line.baseQuantity),
          Number(line.landedUnitCost),
          { type: "goods_receipt", id, no: grNo },
          b.deliveryNoteNo ? `ใบส่งของ ${b.deliveryNoteNo}` : null,
          line.lotNo,
          ok.who.displayName,
        );
      }
      const gr: Gr = {
        id,
        grNo,
        purchaseOrder: po ? { id: po.id, code: po.poNo ?? "", name: po.poNo ?? "" } : null,
        supplier,
        warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name },
        receivedOn: b.receivedOn ?? today(),
        deliveryNoteNo: b.deliveryNoteNo ?? null,
        note: b.note ?? null,
        total: m2(lines.reduce((a, l) => a + Number(l.amount), 0)),
        currency: "THB",
        by: ok.who.displayName,
        createdAt: now(),
        lines,
        chargesTotal: m2(charges.reduce((a, c) => a + Number(c.amount), 0)),
        charges,
        nextActions: canPartner(ok.who, "factory_procurement.manage")
          ? [{ key: "erp_gr.add_charge", irreversible: false, disabledReason: null }]
          : [],
      };
      erp.grs.unshift(gr);
      if (po) {
        po.receipts.push({ id: gr.id, grNo: gr.grNo, receivedOn: gr.receivedOn, total: gr.total });
        const complete = po.lines.every((l) => Number(l.receivedQty) >= Number(l.quantity));
        po.status = complete ? "received" : "partially_received";
        if (complete) po.closedAt = now();
        po.version += 1;
      }
      return HttpResponse.json(gr, { status: 201 });
    });
  }),
];

/** Starts every factory's ERP afresh (e2e between tests). */
export function resetErp(): void {
  states.clear();
}

export type ErpMockState = Erp;
export type ErpMockItem = Item;

/** The E1 engine for the E2 mocks (`erp-e2.ts`): its state and helpers, nothing duplicated. */
export const erpMock = {
  BASE,
  scope,
  number,
  ifMatch,
  body,
  notFound,
  invalid,
  post,
  draftPo,
  poSummary,
  totals,
  now,
  today,
  m2,
  q3,
  c6,
  r2,
  r3,
};
