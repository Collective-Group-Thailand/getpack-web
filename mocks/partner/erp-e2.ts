/**
 * getpack Factory ERP E1.1 + E2 (getpack-api v0.45.0; D-333 – D-342) for `pnpm dev:mock` and the e2e, on top of the
 * E1 engine (`erp.ts`): supplier links and price history, purchase requests, supplier invoices and payments,
 * recipes, production orders, planning and MRP — the rules that change what a screen shows (permissions,
 * statuses and `nextActions`, the 3-way match, reservations as held quantities). A mock is a fake engine and
 * does its sums in numbers; the screens never do. All data obviously fake.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { mockId, paginate, problem } from "../support";
import { pageQuery } from "./billing";
import { erpMock, type ErpMockItem, type ErpMockState } from "./erp";
import { permissionsOf } from "./personas";
import type { Own } from "./support";

type Link = Schemas["ErpItemSupplierDto"];
type Price = Schemas["ErpPriceRecordDto"];
type Pr = Omit<Schemas["ErpPurchaseRequestDto"], "nextActions">;
type Invoice = Omit<Schemas["ErpSupplierInvoiceDto"], "nextActions" | "overdue" | "outstanding">;
type Payment = Omit<Schemas["ErpSupplierPaymentDto"], "nextActions">;
type Recipe = Schemas["ErpRecipeDto"];
type Mo = Omit<Schemas["ErpProductionOrderDto"], "nextActions" | "late" | "short" | "progressPct">;

interface E2 {
  links: Link[];
  prices: Price[];
  prs: Pr[];
  invoices: Invoice[];
  payments: Payment[];
  recipes: Recipe[];
  mos: Mo[];
  seq: number;
}

const { BASE, scope, number, body, notFound, now, today, m2, q3, c6, r2 } = erpMock;
const states = new Map<string, E2>();
const e2Of = (factoryId: string): E2 => {
  let s = states.get(factoryId);
  if (!s) {
    s = { links: [], prices: [], prs: [], invoices: [], payments: [], recipes: [], mos: [], seq: 0 };
    states.set(factoryId, s);
  }
  return s;
};
const ctx = (request: Request, factoryId: unknown, permission?: string) => {
  const ok = scope(request, factoryId, permission);
  if (ok instanceof Response) return ok;
  return { ...ok, e2: e2Of(String(factoryId)) };
};
const actionsOf = (who: Own["who"], rules: [string, string, boolean, boolean?][]) => {
  const perms = permissionsOf(who);
  return rules
    .filter(([, permission, when]) => when && perms.includes(permission))
    .map(([key, , , irreversible]) => ({ key, irreversible: irreversible ?? false, disabledReason: null }));
};
const itemRef = (i: ErpMockItem) => ({ id: i.id, sku: i.sku, name: i.name, kind: i.kind, baseUnit: i.baseUnit });
const ref = (p: { id: string; code: string; name: string }) => ({ id: p.id, code: p.code, name: p.name });
const STATS = {
  minBaseUnitPrice: null,
  avgBaseUnitPrice: null,
  maxBaseUnitPrice: null,
  purchases: 0,
  changePct: null,
  onTimePct: null,
  avgLeadDays: null,
};

/** E2.1 sourcing fields of a supplier link (getpack-api v0.46.0, D-346 – D-351): pending, no breaks, no score yet. */
const SOURCING = {
  approval: "pending" as const,
  approvalNote: null,
  approvedAt: null as string | null,
  approvedBy: null as string | null,
  reviewOn: null,
  priceBreaks: [],
  breaksValidUntil: null,
  score: {
    receipts: 0,
    deliveredValue: "0.00",
    acceptedValue: "0.00",
    rejectedLines: 0,
    qualityPct: null,
    onTimePct: null,
    score: null,
    grade: null,
    ncrs: 0,
  },
};

/** E3 fields of an operation (D-352 – D-354): not planned, not started. */
export const OPERATION_E3 = {
  scheduledStart: null as string | null,
  scheduledEnd: null as string | null,
  locked: false,
  startedAt: null as string | null,
  finishedAt: null as string | null,
  pausedMinutes: 0,
  actualMinutes: null as number | null,
  pauseReason: null as string | null,
  milestone: null,
  milestoneSync: "none" as const,
  milestoneSyncError: null,
};

/** An item's links; the default supplier is linked on first read, as the API links it on first use. */
function linksOf(erp: ErpMockState, e2: E2, item: ErpMockItem): Link[] {
  if (
    item.defaultSupplier &&
    !e2.links.some((l) => l.item.id === item.id && l.supplier.id === item.defaultSupplier!.id)
  ) {
    const factor = Number(item.purchaseFactor);
    e2.links.push({
      id: mockId("eis", (e2.seq += 1)),
      item: itemRef(item),
      supplier: item.defaultSupplier,
      supplierSku: null,
      supplierName: null,
      purchaseUnit: item.purchaseUnit ?? item.baseUnit,
      purchaseFactor: c6(factor),
      minOrderQty: null,
      leadTimeDays: item.leadTimeDays,
      lastPrice: item.lastPurchasePrice,
      lastBaseUnitPrice: item.lastPurchasePrice ? c6(Number(item.lastPurchasePrice) / factor) : null,
      lastPricedOn: item.lastPurchasePrice ? today() : null,
      lastPurchasedOn: null,
      quoteValidUntil: null,
      preferred: true,
      cheapest: false,
      note: null,
      status: "active",
      stats: { ...STATS },
      ...SOURCING,
      approval: "approved",
      approvedAt: now(),
      approvedBy: "เจ้าของ (ทดสอบ)",
      version: 1,
    });
  }
  const mine = e2.links.filter((l) => l.item.id === item.id);
  const active = mine.filter((l) => l.status === "active" && l.lastBaseUnitPrice);
  const best = Math.min(...active.map((l) => Number(l.lastBaseUnitPrice)));
  for (const l of mine)
    l.cheapest = l.status === "active" && !!l.lastBaseUnitPrice && Number(l.lastBaseUnitPrice) === best;
  void erp;
  return mine.sort((a, b) => Number(b.preferred) - Number(a.preferred));
}

function prDto(pr: Pr, who: Own["who"]): Schemas["ErpPurchaseRequestDto"] {
  const open = ["draft", "submitted", "approved"].includes(pr.status);
  return {
    ...pr,
    nextActions: actionsOf(who, [
      ["erp_pr.edit", "factory_procurement.request", pr.status === "draft"],
      ["erp_pr.submit", "factory_procurement.request", pr.status === "draft"],
      ["erp_pr.approve", "factory_procurement.approve", pr.status === "submitted"],
      ["erp_pr.reject", "factory_procurement.approve", pr.status === "submitted", true],
      ["erp_pr.convert", "factory_procurement.manage", pr.status === "approved"],
      ["erp_pr.cancel", "factory_procurement.request", open, true],
    ]),
  };
}

const PAYABLE = ["matched", "approved", "partially_paid"];
const OPEN_AP = ["matched", "variance", "approved", "partially_paid"];
function invoiceSummary(inv: Invoice): Schemas["ErpSupplierInvoiceSummaryDto"] {
  const outstanding = inv.status === "cancelled" ? 0 : Number(inv.payableAmount) - Number(inv.paidAmount);
  return {
    id: inv.id,
    docNo: inv.docNo,
    supplier: inv.supplier,
    invoiceNo: inv.invoiceNo,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    overdue: OPEN_AP.includes(inv.status) && outstanding > 0 && inv.dueDate < today(),
    total: inv.total,
    payableAmount: inv.payableAmount,
    outstanding: m2(outstanding),
    status: inv.status,
    currency: "THB",
  };
}
function invoiceDto(inv: Invoice, who: Own["who"]): Schemas["ErpSupplierInvoiceDto"] {
  const s = invoiceSummary(inv);
  return {
    ...inv,
    overdue: s.overdue,
    outstanding: s.outstanding,
    nextActions: actionsOf(who, [
      ["erp_ap.approve", "factory_ap.approve", inv.status === "variance"],
      ["erp_ap.pay", "factory_ap.manage", PAYABLE.includes(inv.status)],
      ["erp_ap.cancel", "factory_ap.manage", OPEN_AP.includes(inv.status) && inv.paidAmount === "0.00", true],
    ]),
  };
}
const paymentDto = (p: Payment, who: Own["who"]): Schemas["ErpSupplierPaymentDto"] => ({
  ...p,
  nextActions: actionsOf(who, [["erp_pay.reverse", "factory_ap.manage", !p.reverses && !p.reversedBy, true]]),
});

const OPEN_MO = ["planned", "released", "in_progress"];
const RUNNING = ["released", "in_progress"];
function moSummary(mo: Mo): Schemas["ErpProductionOrderSummaryDto"] {
  const done = mo.operations.filter((o) => o.status === "done" || o.status === "skipped").length;
  return {
    id: mo.id,
    moNo: mo.moNo,
    source: mo.source,
    title: mo.title,
    item: mo.item,
    quantity: mo.quantity,
    unit: mo.unit,
    dueOn: mo.dueOn,
    priority: mo.priority,
    status: mo.status,
    late: OPEN_MO.includes(mo.status) && !!mo.dueOn && mo.dueOn < today(),
    progressPct: mo.operations.length
      ? ((done * 100) / mo.operations.length).toFixed(2)
      : mo.status === "completed"
        ? "100.00"
        : "0.00",
    short: RUNNING.includes(mo.status) && mo.materials.some((m) => m.shortQty !== "0.000"),
  };
}
function moDto(mo: Mo, who: Own["who"]): Schemas["ErpProductionOrderDto"] {
  const issued = mo.materials.some((m) => m.issuedQty !== "0.000");
  return {
    ...mo,
    ...moSummary(mo),
    nextActions: actionsOf(who, [
      ["erp_mo.edit", "factory_planning.manage", OPEN_MO.includes(mo.status)],
      ["erp_mo.release", "factory_planning.manage", mo.status === "planned"],
      [
        "erp_mo.issue",
        "factory_inventory.manage",
        RUNNING.includes(mo.status) && mo.materials.some((m) => Number(m.requiredQty) > Number(m.issuedQty)),
      ],
      ["erp_mo.return", "factory_inventory.manage", RUNNING.includes(mo.status) && issued],
      ["erp_mo.complete", "factory_planning.manage", RUNNING.includes(mo.status), true],
      ["erp_mo.cancel", "factory_planning.manage", OPEN_MO.includes(mo.status) && !issued, true],
    ]),
  };
}
const shortOf = (m: Mo["materials"][number]) =>
  Math.max(0, Number(m.requiredQty) - Number(m.issuedQty) - Number(m.reservedQty));

const withEtag = <T extends { id: string; version: number }>(b: T, status = 200) =>
  HttpResponse.json(b, { status, headers: { ETag: `"${b.id}:${b.version}"` } });

export const erpE2Handlers = [
  // ----------------------------------------------------------------------------- supplier prices
  http.get(`${BASE}/items/:itemId/suppliers`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    const item = ok.erp.items.find((i) => i.id === params.itemId);
    return item ? HttpResponse.json(linksOf(ok.erp, ok.e2, item)) : notFound();
  }),
  http.post(`${BASE}/items/:itemId/suppliers`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.manage");
    if (ok instanceof Response) return ok;
    const item = ok.erp.items.find((i) => i.id === params.itemId);
    if (!item) return notFound();
    const b = (await body<Schemas["ErpCreateItemSupplierDto"]>(request)) as Schemas["ErpCreateItemSupplierDto"];
    const supplier = ok.erp.partners.find((p) => p.id === b.supplierId);
    if (!supplier) return notFound();
    if (linksOf(ok.erp, ok.e2, item).some((l) => l.supplier.id === supplier.id))
      return problem(409, "erp.supplier_linked", `${supplier.name} อยู่ในรายชื่อผู้ขายของสินค้านี้แล้ว`);
    const unit = (b.purchaseUnit ?? item.purchaseUnit ?? item.baseUnit) as Link["purchaseUnit"];
    const factor = unit === item.baseUnit ? 1 : Number(b.purchaseFactor ?? item.purchaseFactor);
    if (b.preferred) for (const l of ok.e2.links) if (l.item.id === item.id) l.preferred = false;
    const link: Link = {
      id: mockId("eis", (ok.e2.seq += 1)),
      item: itemRef(item),
      supplier: ref(supplier),
      supplierSku: b.supplierSku ?? null,
      supplierName: b.supplierName ?? null,
      purchaseUnit: unit,
      purchaseFactor: c6(factor),
      minOrderQty: b.minOrderQty ? q3(Number(b.minOrderQty)) : null,
      leadTimeDays: b.leadTimeDays ?? null,
      lastPrice: b.price ? c6(Number(b.price)) : null,
      lastBaseUnitPrice: b.price ? c6(Number(b.price) / factor) : null,
      lastPricedOn: b.price ? today() : null,
      lastPurchasedOn: null,
      quoteValidUntil: b.validUntil ?? null,
      preferred: b.preferred ?? false,
      cheapest: false,
      note: b.note ?? null,
      status: "active",
      stats: { ...STATS },
      ...SOURCING,
      version: 1,
    };
    ok.e2.links.push(link);
    linksOf(ok.erp, ok.e2, item);
    return withEtag(link, 201);
  }),
  http.patch(`${BASE}/items/:itemId/suppliers/:linkId`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.manage");
    if (ok instanceof Response) return ok;
    const link = ok.e2.links.find((l) => l.id === params.linkId && l.item.id === params.itemId);
    if (!link) return notFound();
    const b = await body<Schemas["ErpUpdateItemSupplierDto"]>(request);
    if (b.preferred) for (const l of ok.e2.links) if (l.item.id === link.item.id) l.preferred = l.id === link.id;
    if (b.preferred === false) link.preferred = false;
    if (b.status) {
      link.status = b.status;
      if (b.status === "archived") link.preferred = false;
    }
    if (b.supplierSku !== undefined) link.supplierSku = b.supplierSku;
    if (b.minOrderQty !== undefined) link.minOrderQty = b.minOrderQty ? q3(Number(b.minOrderQty)) : null;
    if (b.leadTimeDays !== undefined) link.leadTimeDays = b.leadTimeDays;
    link.version += 1;
    return withEtag(link);
  }),
  http.get(`${BASE}/items/:itemId/prices`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_inventory.read");
    if (ok instanceof Response) return ok;
    const rows = ok.e2.prices.filter((p) => p.item.id === params.itemId);
    return HttpResponse.json(paginate(rows, pageQuery(new URL(request.url))));
  }),
  http.post(`${BASE}/items/:itemId/prices`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.manage");
    if (ok instanceof Response) return ok;
    const item = ok.erp.items.find((i) => i.id === params.itemId);
    if (!item) return notFound();
    const b = (await body<Schemas["ErpRecordPriceDto"]>(request)) as Schemas["ErpRecordPriceDto"];
    const link = linksOf(ok.erp, ok.e2, item).find((l) => l.supplier.id === b.supplierId);
    const supplier = ok.erp.partners.find((p) => p.id === b.supplierId);
    if (!supplier) return notFound();
    const unit = (b.unit ?? link?.purchaseUnit ?? item.baseUnit) as Price["unit"];
    const factor = link && unit === link.purchaseUnit ? Number(link.purchaseFactor) : 1;
    const record: Price = {
      id: mockId("epr", (ok.e2.seq += 1)),
      item: itemRef(item),
      supplier: ref(supplier),
      source: b.source,
      unit,
      factor: c6(factor),
      unitPrice: c6(Number(b.unitPrice)),
      baseUnitPrice: c6(Number(b.unitPrice) / factor),
      quantity: b.quantity ? q3(Number(b.quantity)) : null,
      pricedOn: b.pricedOn ?? today(),
      validUntil: b.validUntil ?? null,
      documentNo: b.documentNo ?? null,
      sourceId: null,
      note: b.note ?? null,
      by: ok.who.displayName,
      createdAt: now(),
    };
    ok.e2.prices.unshift(record);
    if (link) {
      link.lastPrice = c6(Number(b.unitPrice) * (Number(link.purchaseFactor) / factor));
      link.lastBaseUnitPrice = record.baseUnitPrice;
      link.lastPricedOn = record.pricedOn;
      if (b.validUntil) link.quoteValidUntil = b.validUntil;
    }
    return HttpResponse.json(record, { status: 201 });
  }),
  http.get(`${BASE}/partners/:partnerId/items`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_trading_partners.read");
    if (ok instanceof Response) return ok;
    for (const item of ok.erp.items) linksOf(ok.erp, ok.e2, item);
    return HttpResponse.json(ok.e2.links.filter((l) => l.supplier.id === params.partnerId));
  }),

  // ---------------------------------------------------------------------------- purchase requests
  http.get(`${BASE}/purchase-requests`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    const status = new URL(request.url).searchParams.get("status");
    const rows = ok.e2.prs.filter((pr) =>
      status === "open" ? ["submitted", "approved"].includes(pr.status) : !status || pr.status === status,
    );
    return HttpResponse.json(
      paginate(
        rows.map(
          ({
            note: _n,
            submittedAt: _s,
            decidedAt: _d,
            decidedBy: _b,
            decisionNote: _x,
            lines,
            version: _v,
            ...rest
          }) => ({
            ...rest,
            lineCount: lines.length,
          }),
        ),
        pageQuery(new URL(request.url)),
      ),
    );
  }),
  http.post(`${BASE}/purchase-requests`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.request");
    if (ok instanceof Response) return ok;
    const b = (await body<Schemas["ErpSavePurchaseRequestDto"]>(request)) as Schemas["ErpSavePurchaseRequestDto"];
    const pr = buildPr(ok, b, "manual");
    if (pr instanceof Response) return pr;
    ok.e2.prs.unshift(pr);
    return withEtag(prDto(pr, ok.who), 201);
  }),
  http.get(`${BASE}/purchase-requests/:prId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    const pr = ok.e2.prs.find((p) => p.id === params.prId);
    return pr ? withEtag(prDto(pr, ok.who)) : notFound();
  }),
  http.put(`${BASE}/purchase-requests/:prId`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.request");
    if (ok instanceof Response) return ok;
    const i = ok.e2.prs.findIndex((p) => p.id === params.prId);
    if (i < 0) return notFound();
    if (ok.e2.prs[i]!.status !== "draft") return problem(409, "erp.invalid_status", "แก้ได้เฉพาะร่าง");
    const b = (await body<Schemas["ErpSavePurchaseRequestDto"]>(request)) as Schemas["ErpSavePurchaseRequestDto"];
    const next = buildPr(ok, b, ok.e2.prs[i]!.source, ok.e2.prs[i]!);
    if (next instanceof Response) return next;
    ok.e2.prs[i] = next;
    return withEtag(prDto(next, ok.who));
  }),
  ...(["submit", "approve", "reject", "cancel"] as const).map((action) =>
    http.post(`${BASE}/purchase-requests/:prId/actions/${action}`, async ({ request, params }) => {
      const permission =
        action === "approve" || action === "reject" ? "factory_procurement.approve" : "factory_procurement.request";
      const ok = ctx(request, params.factoryId, permission);
      if (ok instanceof Response) return ok;
      const pr = ok.e2.prs.find((p) => p.id === params.prId);
      if (!pr) return notFound();
      const b = await body<{ reason?: string; note?: string }>(request);
      const from: Record<string, string[]> = {
        submit: ["draft"],
        approve: ["submitted"],
        reject: ["submitted"],
        cancel: ["draft", "submitted", "approved"],
      };
      if (!from[action]!.includes(pr.status)) return problem(409, "erp.invalid_status", `อยู่ในสถานะ ${pr.status}`);
      if (action === "submit") {
        pr.submittedAt = now();
        pr.status = permissionsOf(ok.who).includes("factory_procurement.approve") ? "approved" : "submitted";
      } else {
        pr.status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
        pr.decidedAt = now();
        pr.decidedBy = ok.who.displayName;
        pr.decisionNote = b.reason ?? b.note ?? null;
      }
      pr.version += 1;
      return withEtag(prDto(pr, ok.who));
    }),
  ),
  http.post(`${BASE}/purchase-requests/:prId/actions/convert`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.manage");
    if (ok instanceof Response) return ok;
    const pr = ok.e2.prs.find((p) => p.id === params.prId);
    if (!pr) return notFound();
    if (pr.status !== "approved") return problem(409, "erp.invalid_status", `อยู่ในสถานะ ${pr.status}`);
    const bySupplier = new Map<string, Pr["lines"]>();
    const skipped: Schemas["ErpItemRefDto"][] = [];
    for (const line of pr.lines) {
      const item = ok.erp.items.find((i) => i.id === line.item.id)!;
      const supplier = line.supplier ?? linksOf(ok.erp, ok.e2, item).find((l) => l.preferred)?.supplier;
      if (!supplier) skipped.push(line.item);
      else bySupplier.set(supplier.id, [...(bySupplier.get(supplier.id) ?? []), line]);
    }
    const created: Schemas["ErpPurchaseOrderSummaryDto"][] = [];
    for (const [supplierId, lines] of bySupplier) {
      const po = erpMock.draftPo(ok.erp, {
        supplierId,
        note: `จากใบขอซื้อ ${pr.prNo}`,
        lines: lines.map((line) => {
          const item = ok.erp.items.find((i) => i.id === line.item.id)!;
          const factor = Number(item.purchaseFactor);
          return {
            itemId: item.id,
            quantity: String(Math.max(1, Math.ceil(Number(line.quantity) / factor))),
            unitPrice: item.lastPurchasePrice ?? "0",
          };
        }),
      });
      if (po instanceof Response) return po;
      ok.erp.pos.unshift(po);
      lines.forEach((line) => (line.purchaseOrder = { id: po.id, code: "", name: "" }));
      created.push(erpMock.poSummary(po));
    }
    if (!skipped.length) pr.status = "ordered";
    pr.version += 1;
    return HttpResponse.json({ created, skipped } satisfies Schemas["ErpDraftFromReorderResultDto"], { status: 201 });
  }),

  // ---------------------------------------------------------------------------------- payables
  http.get(`${BASE}/supplier-invoices/aging`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.read");
    if (ok instanceof Response) return ok;
    const zero = () => ({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0 });
    const totals = zero();
    let soon = 0;
    const per = new Map<string, { supplier: Invoice["supplier"]; invoices: number; b: ReturnType<typeof zero> }>();
    const t = today();
    for (const inv of ok.e2.invoices.filter((i) => OPEN_AP.includes(i.status))) {
      const open = Number(inv.payableAmount) - Number(inv.paidAmount);
      if (open <= 0) continue;
      const days = Math.round((Date.parse(t) - Date.parse(inv.dueDate)) / 86_400_000);
      const bucket =
        days <= 0 ? "current" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "over90";
      totals[bucket] += open;
      if (days <= 0 && days >= -7) soon += open;
      const row = per.get(inv.supplier.id) ?? { supplier: inv.supplier, invoices: 0, b: zero() };
      row.invoices += 1;
      row.b[bucket] += open;
      per.set(inv.supplier.id, row);
    }
    const dto = (b: ReturnType<typeof zero>) => ({
      current: m2(b.current),
      d1_30: m2(b.d1_30),
      d31_60: m2(b.d31_60),
      d61_90: m2(b.d61_90),
      over90: m2(b.over90),
      total: m2(b.current + b.d1_30 + b.d31_60 + b.d61_90 + b.over90),
    });
    return HttpResponse.json({
      asOf: t,
      currency: "THB",
      dueSoon: m2(soon),
      totals: dto(totals),
      suppliers: [...per.values()].map((r) => ({ supplier: r.supplier, invoices: r.invoices, buckets: dto(r.b) })),
    } satisfies Schemas["ErpApAgingDto"]);
  }),
  http.get(`${BASE}/supplier-invoices`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.read");
    if (ok instanceof Response) return ok;
    const q = new URL(request.url).searchParams;
    const rows = ok.e2.invoices
      .map(invoiceSummary)
      .filter((i) =>
        q.get("status") === "open" ? OPEN_AP.includes(i.status) : !q.get("status") || i.status === q.get("status"),
      )
      .filter((i) => (q.get("overdue") === "true" ? i.overdue : true))
      .filter((i) => !q.get("supplierId") || i.supplier.id === q.get("supplierId"));
    return HttpResponse.json(paginate(rows, pageQuery(new URL(request.url))));
  }),
  http.post(`${BASE}/supplier-invoices`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.manage");
    if (ok instanceof Response) return ok;
    const b = (await body<Schemas["ErpCreateSupplierInvoiceDto"]>(request)) as Schemas["ErpCreateSupplierInvoiceDto"];
    const supplier = ok.erp.partners.find((p) => p.id === b.supplierId);
    if (!supplier) return notFound();
    if (
      ok.e2.invoices.some(
        (i) => i.supplier.id === supplier.id && i.invoiceNo === b.invoiceNo && i.status !== "cancelled",
      )
    )
      return problem(409, "erp.invoice_duplicate", `ใบแจ้งหนี้ ${b.invoiceNo} บันทึกไว้แล้ว`);
    const po = b.purchaseOrderId ? ok.erp.pos.find((p) => p.id === b.purchaseOrderId) : undefined;
    const settings = ok.erp.settings;
    const lines = (b.lines ?? []).map((l, i) => {
      const poLine = po?.lines.find((x) => x.id === l.purchaseOrderLineId);
      const qty = Number(l.quantity);
      const price = Number(l.unitPrice);
      let variance: Schemas["ErpSupplierInvoiceLineDto"]["variance"] = "unordered";
      if (poLine) {
        const ordered = (Number(poLine.unitPrice) * (100 - Number(poLine.discountPct))) / 100;
        const priceOff = Math.abs(price - ordered) > (ordered * settings.priceTolerancePct) / 100;
        const qtyOff = qty > Number(poLine.receivedQty);
        variance = priceOff && qtyOff ? "price_quantity" : priceOff ? "price" : qtyOff ? "quantity" : null;
      }
      return {
        lineNo: i + 1,
        purchaseOrderLineId: poLine?.id ?? null,
        item: poLine?.item ?? null,
        description: l.description ?? poLine?.item.name ?? "",
        quantity: q3(qty),
        unitPrice: c6(price),
        amount: m2(qty * price),
        receivedQty: poLine ? poLine.receivedQty : null,
        orderedPrice: poLine ? c6((Number(poLine.unitPrice) * (100 - Number(poLine.discountPct))) / 100) : null,
        variance,
      };
    });
    const sum = r2(lines.reduce((a, l) => a + Number(l.amount), 0));
    const mode = (b.vatMode ?? "exclusive") as Invoice["vatMode"];
    const rate = Number(b.vatRatePct ?? 7);
    const vat = mode === "none" ? 0 : mode === "exclusive" ? r2((sum * rate) / 100) : r2((sum * rate) / (100 + rate));
    const subtotal = mode === "inclusive" ? sum - vat : sum;
    const total = mode === "inclusive" ? sum : sum + vat;
    const wht = r2((subtotal * Number(b.whtRatePct ?? 0)) / 100);
    const off = lines.filter((l) => l.variance);
    const due =
      b.dueDate ??
      new Date(Date.parse(b.invoiceDate) + supplier.paymentTermDays * 86_400_000).toISOString().slice(0, 10);
    const inv: Invoice = {
      id: mockId("eap", (ok.e2.seq += 1)),
      docNo: number(ok.erp, "ap", b.invoiceDate),
      supplier: ref(supplier),
      invoiceNo: b.invoiceNo,
      invoiceDate: b.invoiceDate,
      dueDate: due,
      total: m2(total),
      payableAmount: m2(total - wht),
      status: off.length ? "variance" : "matched",
      currency: "THB",
      purchaseOrder: po ? { id: po.id, code: po.poNo ?? "", name: po.poNo ?? "" } : null,
      taxInvoiceNo: b.taxInvoiceNo ?? null,
      vatMode: mode,
      vatRatePct: rate.toFixed(4),
      subtotal: m2(subtotal),
      vatAmount: m2(vat),
      whtRatePct: Number(b.whtRatePct ?? 0).toFixed(4),
      whtAmount: m2(wht),
      paidAmount: "0.00",
      matchNote: off.length ? off.map((l) => `#${l.lineNo} ${l.variance}`).join(" · ") : null,
      note: b.note ?? null,
      fileId: null,
      approvedAt: null,
      approvedBy: null,
      cancelReason: null,
      createdAt: now(),
      lines,
      payments: [],
      version: 1,
    };
    ok.e2.invoices.unshift(inv);
    return withEtag(invoiceDto(inv, ok.who), 201);
  }),
  http.get(`${BASE}/supplier-invoices/:invoiceId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.read");
    if (ok instanceof Response) return ok;
    const inv = ok.e2.invoices.find((i) => i.id === params.invoiceId);
    return inv ? withEtag(invoiceDto(inv, ok.who)) : notFound();
  }),
  ...(["approve", "cancel"] as const).map((action) =>
    http.post(`${BASE}/supplier-invoices/:invoiceId/actions/${action}`, async ({ request, params }) => {
      const ok = ctx(request, params.factoryId, action === "approve" ? "factory_ap.approve" : "factory_ap.manage");
      if (ok instanceof Response) return ok;
      const inv = ok.e2.invoices.find((i) => i.id === params.invoiceId);
      if (!inv) return notFound();
      const b = await body<{ reason?: string; note?: string }>(request);
      if (action === "approve") {
        if (inv.status !== "variance") return problem(409, "erp.invalid_status", `อยู่ในสถานะ ${inv.status}`);
        inv.status = "approved";
        inv.approvedAt = now();
        inv.approvedBy = ok.who.displayName;
        if (b.note) inv.note = b.note;
      } else {
        if (!OPEN_AP.includes(inv.status) || inv.paidAmount !== "0.00")
          return problem(409, "erp.invalid_status", `อยู่ในสถานะ ${inv.status}`);
        inv.status = "cancelled";
        inv.cancelReason = b.reason ?? null;
      }
      inv.version += 1;
      return withEtag(invoiceDto(inv, ok.who));
    }),
  ),
  http.get(`${BASE}/supplier-payments`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(
      paginate(
        ok.e2.payments.map((p) => paymentDto(p, ok.who)),
        pageQuery(new URL(request.url)),
      ),
    );
  }),
  http.post(`${BASE}/supplier-payments`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.manage");
    if (ok instanceof Response) return ok;
    const b = (await body<Schemas["ErpCreateSupplierPaymentDto"]>(request)) as Schemas["ErpCreateSupplierPaymentDto"];
    const supplier = ok.erp.partners.find((p) => p.id === b.supplierId);
    if (!supplier) return notFound();
    let total = 0;
    const allocations: Payment["allocations"] = [];
    for (const a of b.allocations ?? []) {
      const inv = ok.e2.invoices.find((i) => i.id === a.supplierInvoiceId);
      if (!inv) return notFound();
      if (!PAYABLE.includes(inv.status)) return problem(409, "erp.invoice_not_payable", `${inv.docNo} ยังจ่ายไม่ได้`);
      const open = Number(inv.payableAmount) - Number(inv.paidAmount);
      const amount = Number(a.amount);
      if (amount > open + 0.001) return problem(422, "erp.overpayment", `${inv.docNo} ค้างจ่าย ${m2(open)} บาท`);
      total += amount;
      const paid = Number(inv.paidAmount) + amount;
      inv.paidAmount = m2(paid);
      inv.status = paid >= Number(inv.payableAmount) - 0.001 ? "paid" : "partially_paid";
      allocations.push({ invoice: { id: inv.id, code: inv.docNo, name: inv.invoiceNo }, amount: m2(amount) });
    }
    const payment: Payment = {
      id: mockId("epv", (ok.e2.seq += 1)),
      paymentNo: number(ok.erp, "pv", b.paidOn ?? today()),
      supplier: ref(supplier),
      paidOn: b.paidOn ?? today(),
      method: b.method,
      reference: b.reference ?? null,
      amount: m2(total),
      currency: "THB",
      note: b.note ?? null,
      reverses: null,
      reversedBy: null,
      allocations,
      by: ok.who.displayName,
      createdAt: now(),
    };
    for (const a of allocations)
      ok.e2.invoices
        .find((i) => i.id === a.invoice.id)!
        .payments.push({
          id: payment.id,
          paymentNo: payment.paymentNo,
          paidOn: payment.paidOn,
          amount: a.amount,
        });
    ok.e2.payments.unshift(payment);
    return HttpResponse.json(paymentDto(payment, ok.who), { status: 201 });
  }),
  http.get(`${BASE}/supplier-payments/:paymentId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.read");
    if (ok instanceof Response) return ok;
    const p = ok.e2.payments.find((x) => x.id === params.paymentId);
    return p ? HttpResponse.json(paymentDto(p, ok.who)) : notFound();
  }),
  http.post(`${BASE}/supplier-payments/:paymentId/actions/reverse`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.manage");
    if (ok instanceof Response) return ok;
    const p = ok.e2.payments.find((x) => x.id === params.paymentId);
    if (!p) return notFound();
    if (p.reverses || p.reversedBy) return problem(409, "erp.invalid_status", "กลับรายการแล้ว");
    const b = await body<{ reason?: string }>(request);
    const reversal: Payment = {
      ...p,
      id: mockId("epv", (ok.e2.seq += 1)),
      paymentNo: number(ok.erp, "pv"),
      paidOn: today(),
      amount: m2(-Number(p.amount)),
      note: b.reason ?? null,
      reverses: { id: p.id, code: p.paymentNo, name: p.paymentNo },
      reversedBy: null,
      allocations: p.allocations.map((a) => ({ ...a, amount: m2(-Number(a.amount)) })),
      createdAt: now(),
    };
    p.reversedBy = { id: reversal.id, code: reversal.paymentNo, name: reversal.paymentNo };
    for (const a of p.allocations) {
      const inv = ok.e2.invoices.find((i) => i.id === a.invoice.id)!;
      const paid = Number(inv.paidAmount) - Number(a.amount);
      inv.paidAmount = m2(Math.max(0, paid));
      inv.status = paid > 0 ? "partially_paid" : inv.approvedAt ? "approved" : "matched";
    }
    ok.e2.payments.unshift(reversal);
    return HttpResponse.json(paymentDto(reversal, ok.who), { status: 201 });
  }),

  // ------------------------------------------------------------------------------------ recipes
  http.get(`${BASE}/recipes`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(paginate(ok.e2.recipes, pageQuery(new URL(request.url))));
  }),
  http.post(`${BASE}/recipes`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.manage");
    if (ok instanceof Response) return ok;
    const b = (await body<Schemas["ErpSaveRecipeDto"]>(request)) as Schemas["ErpSaveRecipeDto"];
    const recipe = buildRecipe(ok.erp, b, mockId("erc", (ok.e2.seq += 1)), 1);
    if (recipe instanceof Response) return recipe;
    ok.e2.recipes.unshift(recipe);
    return withEtag(recipe, 201);
  }),
  http.get(`${BASE}/recipes/:recipeId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const r = ok.e2.recipes.find((x) => x.id === params.recipeId);
    return r ? withEtag(r) : notFound();
  }),
  http.put(`${BASE}/recipes/:recipeId`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.manage");
    if (ok instanceof Response) return ok;
    const i = ok.e2.recipes.findIndex((x) => x.id === params.recipeId);
    if (i < 0) return notFound();
    const b = (await body<Schemas["ErpSaveRecipeDto"]>(request)) as Schemas["ErpSaveRecipeDto"];
    const recipe = buildRecipe(ok.erp, b, ok.e2.recipes[i]!.id, ok.e2.recipes[i]!.version + 1);
    if (recipe instanceof Response) return recipe;
    ok.e2.recipes[i] = recipe;
    return withEtag(recipe);
  }),

  // ------------------------------------------------------------------------- production orders
  http.get(`${BASE}/production-orders`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const status = new URL(request.url).searchParams.get("status");
    const rows = ok.e2.mos.filter((m) =>
      status === "open" ? OPEN_MO.includes(m.status) : !status || m.status === status,
    );
    return HttpResponse.json(paginate(rows.map(moSummary), pageQuery(new URL(request.url))));
  }),
  http.post(`${BASE}/production-orders`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.manage");
    if (ok instanceof Response) return ok;
    const b = (await body<Schemas["ErpCreateProductionOrderDto"]>(request)) as Schemas["ErpCreateProductionOrderDto"];
    const item = ok.erp.items.find((i) => i.id === b.itemId);
    if (!item) return notFound();
    const qty = Number(b.quantity);
    const recipe = b.recipeId
      ? ok.e2.recipes.find((r) => r.id === b.recipeId)
      : ok.e2.recipes.find((r) => r.item.id === item.id && r.status === "active");
    const warehouse = ok.erp.warehouses.find((w) => (b.warehouseId ? w.id === b.warehouseId : w.isDefault))!;
    const mo: Mo = {
      id: mockId("emo", (ok.e2.seq += 1)),
      moNo: number(ok.erp, "mo"),
      source: b.source as Mo["source"],
      title: b.title ?? item.name,
      item: itemRef(item),
      quantity: q3(qty),
      unit: item.baseUnit,
      dueOn: b.dueOn ?? null,
      priority: b.priority ?? 0,
      status: "planned",
      job: null,
      recipe: recipe ? { id: recipe.id, code: recipe.item.sku, name: recipe.name } : null,
      plannedStartOn: b.plannedStartOn ?? null,
      warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name },
      goodQty: "0.000",
      scrapQty: "0.000",
      materialCost: "0.00",
      unitCost: null,
      note: b.note ?? null,
      releasedAt: null,
      completedAt: null,
      cancelReason: null,
      createdAt: now(),
      materials: (recipe?.materials ?? []).map((m, i) => {
        const need =
          Math.ceil(((Number(m.quantity) * qty) / Number(recipe!.batchQty) / (1 - Number(m.scrapPct) / 100)) * 1000) /
          1000;
        return {
          id: mockId("emm", (ok.e2.seq += 1) * 10 + i),
          lineNo: i + 1,
          item: m.item,
          requiredQty: q3(need),
          reservedQty: "0.000",
          issuedQty: "0.000",
          remainingQty: q3(need),
          shortQty: q3(need),
          origin: "recipe",
          note: null,
        };
      }),
      operations: (recipe?.operations ?? []).map((o, i) => ({
        id: mockId("emp", (ok.e2.seq += 1) * 10 + i),
        seq: o.seq,
        name: o.name,
        machine: o.machine,
        plannedMinutes: o.setupMinutes + (o.runRatePerHour ? Math.ceil((qty * 60) / Number(o.runRatePerHour)) : 0),
        ...OPERATION_E3,
        status: "pending",
        goodQty: "0.000",
        scrapQty: "0.000",
      })),
      version: 1,
    };
    ok.e2.mos.unshift(mo);
    return withEtag(moDto(mo, ok.who), 201);
  }),
  http.get(`${BASE}/production-orders/:moId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const mo = ok.e2.mos.find((m) => m.id === params.moId);
    return mo ? withEtag(moDto(mo, ok.who)) : notFound();
  }),
  ...(["release", "issue", "return", "complete", "cancel"] as const).map((action) =>
    http.post(`${BASE}/production-orders/:moId/actions/${action}`, async ({ request, params }) => {
      const permission =
        action === "issue" || action === "return" ? "factory_inventory.manage" : "factory_planning.manage";
      const ok = ctx(request, params.factoryId, permission);
      if (ok instanceof Response) return ok;
      const mo = ok.e2.mos.find((m) => m.id === params.moId);
      if (!mo) return notFound();
      const b = await body<{
        goodQty?: string;
        scrapQty?: string;
        reason?: string;
        lines?: { materialId: string; quantity: string }[];
      }>(request);
      const stale = () => problem(409, "erp.invalid_status", `อยู่ในสถานะ ${mo.status}`);
      const free = (itemId: string) => {
        const item = ok.erp.items.find((i) => i.id === itemId)!;
        const held = ok.e2.mos
          .filter((m) => RUNNING.includes(m.status))
          .flatMap((m) => m.materials)
          .filter((m) => m.item.id === itemId)
          .reduce((a, m) => a + Number(m.reservedQty), 0);
        return erpMock.totals(ok.erp, item).onHand - held;
      };
      const settle = (m: Mo["materials"][number]) => {
        m.remainingQty = q3(Math.max(0, Number(m.requiredQty) - Number(m.issuedQty)));
        m.shortQty = q3(shortOf(m));
      };
      if (action === "release") {
        if (mo.status !== "planned") return stale();
        for (const m of mo.materials) {
          m.reservedQty = q3(Math.max(0, Math.min(Number(m.requiredQty), free(m.item.id))));
          settle(m);
        }
        mo.status = "released";
        mo.releasedAt = now();
      } else if (action === "issue" || action === "return") {
        if (!RUNNING.includes(mo.status)) return stale();
        const warehouse = ok.erp.warehouses.find((w) => w.id === mo.warehouse.id)!;
        const lines = b.lines?.length
          ? b.lines.map((l) => ({ m: mo.materials.find((x) => x.id === l.materialId)!, qty: Number(l.quantity) }))
          : mo.materials.map((m) => ({ m, qty: Number(m.requiredQty) - Number(m.issuedQty) })).filter((x) => x.qty > 0);
        if (!lines.length) return problem(422, "erp.nothing_to_issue", "เบิกครบแล้ว");
        let cost = Number(mo.materialCost);
        for (const { m, qty } of lines) {
          const item = ok.erp.items.find((i) => i.id === m.item.id)!;
          const signed = action === "issue" ? -qty : qty;
          const mv = erpMock.post(
            ok.erp,
            item,
            warehouse,
            action === "issue" ? "production_issue" : "production_return",
            signed,
            null,
            { type: "production_order", id: mo.id, no: mo.moNo },
            b.reason ?? null,
            null,
            ok.who.displayName,
          );
          cost -= Number(mv.value);
          m.issuedQty = q3(Number(m.issuedQty) + (action === "issue" ? qty : -qty));
          if (action === "issue") m.reservedQty = q3(Math.max(0, Number(m.reservedQty) - qty));
          settle(m);
        }
        mo.materialCost = m2(cost);
        mo.status = "in_progress";
      } else if (action === "complete") {
        if (!RUNNING.includes(mo.status)) return stale();
        const good = Number(b.goodQty ?? mo.quantity);
        for (const m of mo.materials) {
          m.reservedQty = "0.000";
          settle(m);
        }
        mo.goodQty = q3(good);
        mo.scrapQty = q3(Number(b.scrapQty ?? 0));
        mo.unitCost = good > 0 ? c6(Number(mo.materialCost) / good) : null;
        mo.status = "completed";
        mo.completedAt = now();
      } else {
        if (!OPEN_MO.includes(mo.status)) return stale();
        if (mo.materials.some((m) => m.issuedQty !== "0.000"))
          return problem(409, "erp.materials_issued", "คืนวัตถุดิบก่อน");
        for (const m of mo.materials) m.reservedQty = "0.000";
        mo.status = "cancelled";
        mo.cancelReason = b.reason ?? null;
      }
      mo.version += 1;
      return withEtag(moDto(mo, ok.who));
    }),
  ),
  ...(["start", "finish", "skip", "pause", "resume"] as const).map((action) =>
    http.post(
      `${BASE}/production-orders/:moId/operations/:operationId/actions/${action}`,
      async ({ request, params }) => {
        const ok = ctx(request, params.factoryId, "factory_production.record");
        if (ok instanceof Response) return ok;
        const mo = ok.e2.mos.find((m) => m.id === params.moId);
        const op = mo?.operations.find((o) => o.id === params.operationId);
        if (!mo || !op) return notFound();
        if (!RUNNING.includes(mo.status)) return problem(409, "erp.invalid_status", `อยู่ในสถานะ ${mo.status}`);
        const b = await body<Schemas["ErpFinishOperationDto"] & Partial<Schemas["ErpPauseOperationDto"]>>(request);
        // E3 (D-353): pause with a reason and resume; a step that mirrors a getpack milestone is never skipped.
        if (action === "skip" && op.milestone) return problem(409, "erp.invalid_status", "ขั้นตอนนี้ข้ามไม่ได้");
        if (action === "pause" && op.status !== "in_progress")
          return problem(409, "erp.invalid_status", "ยังไม่ได้เริ่ม");
        if (action === "resume" && op.status !== "paused") return problem(409, "erp.invalid_status", "ไม่ได้หยุดอยู่");
        if (action === "start" && op.status !== "pending") return problem(409, "erp.invalid_status", "เริ่มไปแล้ว");
        op.status =
          action === "start" || action === "resume"
            ? "in_progress"
            : action === "pause"
              ? "paused"
              : action === "finish"
                ? "done"
                : "skipped";
        if (action === "start") op.startedAt = now();
        if (action === "pause") op.pauseReason = b.reason ?? "other";
        if (action === "resume") op.pauseReason = null;
        if (action === "finish" || action === "skip") op.finishedAt = now();
        if (action === "finish") {
          op.goodQty = q3(Number(b.goodQty ?? mo.quantity));
          op.scrapQty = q3(Number(b.scrapQty ?? 0));
        }
        mo.status = "in_progress";
        mo.version += 1;
        return withEtag(moDto(mo, ok.who));
      },
    ),
  ),

  // ---------------------------------------------------------------------------------- planning
  http.get(`${BASE}/planning/overview`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const open = ok.e2.mos.filter((m) => OPEN_MO.includes(m.status));
    const soon = new Date(Date.parse(today()) + 7 * 86_400_000).toISOString().slice(0, 10);
    return HttpResponse.json({
      planned: open.filter((m) => m.status === "planned").length,
      released: open.filter((m) => m.status === "released").length,
      inProgress: open.filter((m) => m.status === "in_progress").length,
      late: open.filter((m) => m.dueOn && m.dueOn < today()).length,
      dueThisWeek: open.filter((m) => m.dueOn && m.dueOn >= today() && m.dueOn <= soon).length,
      shortItems: new Set(open.flatMap((m) => m.materials.filter((x) => shortOf(x) > 0).map((x) => x.item.id))).size,
      machines: MACHINES.map((machine) => {
        const ops = open
          .flatMap((m) => m.operations)
          .filter((o) => o.machine?.id === machine.id && o.status !== "done" && o.status !== "skipped");
        return { machine, operations: ops.length, plannedMinutes: ops.reduce((a, o) => a + o.plannedMinutes, 0) };
      }),
    } satisfies Schemas["ErpPlanningOverviewDto"]);
  }),
  http.get(`${BASE}/planning/queue`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const machine = new URL(request.url).searchParams.get("machineId");
    const items = ok.e2.mos
      .filter((m) => RUNNING.includes(m.status))
      .flatMap((m) =>
        m.operations
          .filter(
            (o) =>
              (o.status === "pending" || o.status === "in_progress" || o.status === "paused") &&
              (!machine || o.machine?.id === machine),
          )
          .map((operation) => ({ operation, order: moSummary(m) })),
      );
    return HttpResponse.json(items satisfies Schemas["ErpOperationQueueItemDto"][]);
  }),
  http.get(`${BASE}/planning/mrp`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(mrpRows(ok));
  }),
  http.post(`${BASE}/planning/mrp/actions/request`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.request");
    if (ok instanceof Response) return ok;
    const b = await body<{ itemIds: string[] }>(request);
    const rows = mrpRows(ok).filter((r) => b.itemIds?.includes(r.item.id));
    if (!rows.length) return problem(422, "erp.nothing_to_request", "ไม่มีรายการขาด");
    const pr = buildPr(
      ok,
      {
        note: "สร้างจาก MRP (วัตถุดิบไม่พอผลิต)",
        lines: rows.map((r) => ({ itemId: r.item.id, quantity: r.toOrderQty })),
      },
      "mrp",
    );
    if (pr instanceof Response) return pr;
    ok.e2.prs.unshift(pr);
    return HttpResponse.json(prDto(pr, ok.who), { status: 201 });
  }),
];

const MACHINES = [
  { id: mockId("emc", 1), name: "เครื่องพิมพ์ออฟเซ็ต 4 สี (จำลอง)" },
  { id: mockId("emc", 2), name: "เครื่องไดคัท (จำลอง)" },
];

type Ctx = Own & { erp: ErpMockState; e2: E2 };

function buildPr(
  ok: Ctx,
  b: Partial<Schemas["ErpSavePurchaseRequestDto"]>,
  source: Pr["source"],
  current?: Pr,
): Pr | Response {
  const lines: Pr["lines"] = [];
  for (const [i, l] of (b.lines ?? []).entries()) {
    const item = ok.erp.items.find((x) => x.id === l.itemId);
    if (!item) return notFound();
    const cost = item.lastPurchasePrice ? Number(item.lastPurchasePrice) / Number(item.purchaseFactor) : null;
    lines.push({
      id: mockId("eprl", (ok.e2.seq += 1)),
      lineNo: i + 1,
      item: itemRef(item),
      quantity: q3(Number(l.quantity)),
      supplier: null,
      estimatedUnitCost: cost === null ? null : c6(cost),
      estimatedAmount: cost === null ? null : m2(cost * Number(l.quantity)),
      neededBy: l.neededBy ?? null,
      note: l.note ?? null,
      purchaseOrder: null,
    });
  }
  const total = lines.reduce((a, l) => a + Number(l.estimatedAmount ?? 0), 0);
  return {
    id: current?.id ?? mockId("epq", (ok.e2.seq += 1)),
    prNo: current?.prNo ?? number(ok.erp, "pr"),
    status: "draft",
    source,
    neededBy: b.neededBy ?? null,
    estimatedTotal: m2(total),
    currency: "THB",
    lineCount: lines.length,
    requestedBy: ok.who.displayName,
    createdAt: current?.createdAt ?? now(),
    note: b.note ?? null,
    submittedAt: null,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    lines,
    version: (current?.version ?? 0) + 1,
  };
}

function buildRecipe(
  erp: ErpMockState,
  b: Schemas["ErpSaveRecipeDto"],
  id: string,
  version: number,
): Recipe | Response {
  const product = erp.items.find((i) => i.id === b.itemId);
  if (!product) return notFound();
  const materials: Recipe["materials"] = [];
  for (const [i, m] of (b.materials ?? []).entries()) {
    const item = erp.items.find((x) => x.id === m.itemId);
    if (!item) return notFound();
    materials.push({
      lineNo: i + 1,
      item: itemRef(item),
      quantity: Number(m.quantity).toFixed(6),
      scrapPct: Number(m.scrapPct ?? 0).toFixed(4),
    });
  }
  return {
    id,
    item: itemRef(product),
    name: b.name,
    batchQty: q3(Number(b.batchQty ?? 1)),
    note: b.note ?? null,
    status: (b.status ?? "active") as Recipe["status"],
    materials,
    operations: (b.operations ?? []).map((o, i) => ({
      seq: (i + 1) * 10,
      name: o.name,
      machine: MACHINES.find((m) => m.id === o.machineId) ?? null,
      setupMinutes: o.setupMinutes ?? 0,
      runRatePerHour: o.runRatePerHour ? q3(Number(o.runRatePerHour)) : null,
    })),
    version,
  };
}

function mrpRows(ok: Ctx): Schemas["ErpMrpRowDto"][] {
  const need = new Map<string, { required: number; reserved: number; due: string | null; orders: number }>();
  for (const mo of ok.e2.mos.filter((m) => OPEN_MO.includes(m.status)))
    for (const m of mo.materials) {
      const open = Number(m.requiredQty) - Number(m.issuedQty);
      if (open <= 0) continue;
      const row = need.get(m.item.id) ?? { required: 0, reserved: 0, due: null, orders: 0 };
      row.required += open;
      row.reserved += Number(m.reservedQty);
      row.orders += 1;
      if (mo.dueOn && (!row.due || mo.dueOn < row.due)) row.due = mo.dueOn;
      need.set(m.item.id, row);
    }
  const out: Schemas["ErpMrpRowDto"][] = [];
  for (const [itemId, row] of need) {
    const item = ok.erp.items.find((i) => i.id === itemId)!;
    const held = ok.e2.mos
      .filter((m) => RUNNING.includes(m.status))
      .flatMap((m) => m.materials)
      .filter((m) => m.item.id === itemId)
      .reduce((a, m) => a + Number(m.reservedQty), 0);
    const free = Math.max(0, erpMock.totals(ok.erp, item).onHand - held);
    const asked = ok.e2.prs
      .filter((p) => ["draft", "submitted", "approved"].includes(p.status))
      .flatMap((p) => p.lines)
      .filter((l) => l.item.id === itemId && !l.purchaseOrder)
      .reduce((a, l) => a + Number(l.quantity), 0);
    const shortage = row.required - row.reserved - free - asked;
    if (shortage <= 0) continue;
    const factor = Number(item.purchaseFactor);
    const units = Math.max(1, Math.ceil(shortage / factor));
    out.push({
      item: itemRef(item),
      required: q3(row.required),
      reserved: q3(row.reserved),
      available: q3(free),
      onOrder: q3(asked),
      shortage: q3(shortage),
      toOrderQty: q3(units * factor),
      toOrderPurchaseQty: q3(units),
      purchaseUnit: item.purchaseUnit ?? item.baseUnit,
      supplier: item.defaultSupplier,
      unitPrice: item.lastPurchasePrice,
      neededBy: row.due,
      orders: row.orders,
    });
  }
  return out;
}

/** What the E3 mock (machines, kiosk, schedule) reads of E2's production orders. */
export const erpE2Mock = {
  e2Of: (factoryId: string) => e2Of(factoryId),
  moSummary: (mo: Mo) => moSummary(mo),
  machines: () => MACHINES,
  running: (status: string) => RUNNING.includes(status),
};

export function resetErpE2(): void {
  states.clear();
}
