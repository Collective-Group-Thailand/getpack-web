/**
 * getpack Factory ERP E4 (getpack-api v0.47.0; D-359 – D-371) for `pnpm dev:mock` and the e2e: leads and deals, a
 * quotation sent with a customer link and accepted there, the sales order, a delivery note that ships it, the
 * invoice and its receipt, the aging and the month's tax reports. Kept per factory, on top of E1's customers and
 * items. A mock is a fake engine and does its sums in numbers; the screens never do. All data obviously fake.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { mockId, paginate, problem } from "../support";
import { pageQuery } from "./billing";
import { erpMock } from "./erp";
import { PARTNER_PERSONAS, permissionsOf } from "./personas";
import type { Own } from "./support";

type Line = Schemas["ErpSalesLineDto"];
type Quote = Omit<Schemas["ErpQuotationDto"], "nextActions" | "revisions" | "linkActive"> & { token: string | null };
type So = Omit<Schemas["ErpSalesOrderDto"], "nextActions" | "credit" | "deliveryNotes" | "invoices" | "deliveredPct" | "late">;
type Dn = Omit<Schemas["ErpDeliveryNoteDto"], "nextActions" | "invoiced">;
type Iv = Omit<Schemas["ErpSalesInvoiceDto"], "nextActions" | "openAmount" | "overdue" | "receipts" | "notes" | "deliveryNotes">;
type Rc = Omit<Schemas["ErpCustomerReceiptDto"], "nextActions">;
type Lead = Omit<Schemas["ErpLeadDto"], "nextActions" | "openActivities">;
type Opp = Omit<Schemas["ErpOpportunityDto"], "nextActions" | "weightedValue" | "quotations">;
type Activity = Omit<Schemas["ErpActivityDto"], "overdue">;

interface E4 {
  quotes: Quote[];
  sos: So[];
  dns: (Dn & { invoiceId: string | null })[];
  ivs: (Iv & { dnIds: string[] })[];
  rcs: Rc[];
  leads: Lead[];
  opps: Opp[];
  activities: Activity[];
  seq: number;
}

const { BASE, scope, number, body, notFound, invalid, now, today } = erpMock;
const states = new Map<string, E4>();
const m2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const PROBABILITY = { prospecting: 10, proposal: 40, negotiation: 70, won: 100, lost: 0 } as const;
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sales = () => PARTNER_PERSONAS.find((p) => p.key === "sales") ?? PARTNER_PERSONAS[0]!;
const person = () => ({ id: sales().id, name: sales().displayName });

function e4Of(factoryId: string): E4 {
  let s = states.get(factoryId);
  if (!s) {
    s = { quotes: [], sos: [], dns: [], ivs: [], rcs: [], leads: [], opps: [], activities: [], seq: 0 };
    s.leads.push({
      id: mockId("eld", 1),
      name: "ร้านกาแฟบ้านสวน (จำลอง)",
      contactName: "คุณสมศรี",
      phone: "080-000-0001",
      email: null,
      lineId: null,
      address: null,
      source: "facebook",
      stage: "contacted",
      expectedValue: "25000.00",
      lostReason: null,
      note: "สนใจแก้วกระดาษพิมพ์โลโก้",
      convertedAt: null,
      customer: null,
      salesperson: person(),
      createdAt: now(),
      version: 1,
    });
    states.set(factoryId, s);
  }
  return s;
}

const ctx = (request: Request, factoryId: unknown, permission?: string) => {
  const ok = scope(request, factoryId, permission);
  if (ok instanceof Response) return ok;
  return { ...ok, e4: e4Of(String(factoryId)) };
};
type Ctx = Exclude<ReturnType<typeof ctx>, Response>;
const actionsOf = (who: Own["who"], rules: [string, string, boolean][]) => {
  const perms = permissionsOf(who);
  return rules
    .filter(([, permission, when]) => when && perms.includes(permission))
    .map(([key]) => ({ key, irreversible: false, disabledReason: null }));
};
const etagged = <T extends { id: string; version: number }>(b: T, status = 200) =>
  HttpResponse.json(b, { status, headers: { ETag: `"${b.id}:${b.version}"` } });
const PDF = { url: "https://fake-s3.invalid/document.pdf", fileName: "document.pdf", expiresAt: now() };

function customerOf(ok: Ctx, id: string | undefined) {
  return ok.erp.partners.find((p) => p.id === id && p.kind !== "supplier");
}
const coded = (p: { id: string; code: string; name: string }) => ({ id: p.id, code: p.code, name: p.name });

function linesOf(ok: Ctx, input: Schemas["ErpSalesLineInput"][] | undefined): Line[] | Response {
  if (!input?.length) return invalid("lines", "ใส่อย่างน้อย 1 รายการ");
  const out: Line[] = [];
  for (const [i, l] of input.entries()) {
    const item = l.itemId ? ok.erp.items.find((x) => x.id === l.itemId) : undefined;
    if (l.itemId && !item) return notFound();
    const qty = Number(l.quantity);
    const price = Number(l.unitPrice);
    const disc = Number(l.discountPct ?? 0);
    out.push({
      id: mockId("esl", (ok.e4.seq += 1)),
      lineNo: i + 1,
      item: item ? { id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit } : null,
      description: l.description ?? item?.name ?? "",
      quantity: qty.toFixed(3),
      unit: (item?.baseUnit ?? l.unit ?? "pcs") as Line["unit"],
      unitPrice: price.toFixed(6),
      discountPct: disc.toFixed(4),
      amount: m2((qty * price * (100 - disc)) / 100),
    });
  }
  return out;
}
function totals(lines: { amount: string }[], mode: string) {
  const sum = lines.reduce((a, l) => a + Number(l.amount), 0);
  if (mode === "none") return { subtotal: m2(sum), vatAmount: "0.00", total: m2(sum), vatRatePct: "0.0000" };
  if (mode === "exclusive") return { subtotal: m2(sum), vatAmount: m2(sum * 0.07), total: m2(sum * 1.07), vatRatePct: "7.0000" };
  const vat = (sum * 7) / 107;
  return { subtotal: m2(sum - vat), vatAmount: m2(vat), total: m2(sum), vatRatePct: "7.0000" };
}

// --------------------------------------------------------------------------------------- views
const quoteView = (ok: Ctx, q: Quote): Schemas["ErpQuotationDto"] => {
  const rest: Omit<Quote, "token"> & { token?: string | null } = { ...q };
  delete rest.token;
  const open = q.status === "draft" || q.status === "sent";
  return {
    ...rest,
    linkActive: q.status === "sent" && !!q.token,
    revisions: [{ id: q.id, revision: q.revision, status: q.status, total: q.total }],
    nextActions: actionsOf(ok.who, [
      ["erp_quote.edit", "factory_sales.manage", q.status === "draft"],
      ["erp_quote.send", "factory_sales.manage", open],
      ["erp_quote.accept", "factory_sales.manage", q.status === "sent"],
      ["erp_quote.reject", "factory_sales.manage", q.status === "sent"],
      ["erp_quote.order", "factory_sales.manage", q.status === "accepted" && !q.salesOrder],
      ["erp_quote.cancel", "factory_sales.manage", open],
      ["erp_quote.pdf", "factory_sales.read", true],
    ]),
  };
};
const soView = (ok: Ctx, so: So): Schemas["ErpSalesOrderDto"] => {
  const ordered = so.lines.filter((l) => l.fulfilment !== "service").reduce((a, l) => a + Number(l.quantity), 0);
  const shipped = so.lines.filter((l) => l.fulfilment !== "service").reduce((a, l) => a + Number(l.deliveredQty), 0);
  const live = ["confirmed", "partially_delivered"].includes(so.status);
  return {
    ...so,
    credit: { limit: null, receivables: "0.00", openOrders: so.total, over: false },
    deliveredPct: ordered ? ((shipped / ordered) * 100).toFixed(1) : "0.0",
    late: false,
    deliveryNotes: ok.e4.dns
      .filter((d) => d.salesOrder.id === so.id)
      .map((d) => ({ id: d.id, doNo: d.doNo, deliverOn: d.deliverOn, status: d.status })),
    invoices: ok.e4.ivs
      .filter((i) => i.salesOrder?.id === so.id)
      .map((i) => ({ id: i.id, invoiceNo: i.invoiceNo, status: i.status, total: i.total })),
    nextActions: actionsOf(ok.who, [
      ["erp_so.confirm", "factory_sales.manage", so.status === "draft"],
      ["erp_so.deliver", "factory_delivery.manage", live && shipped < ordered],
      ["erp_so.invoice", "factory_receivables.manage", live || so.status === "delivered"],
      ["erp_so.edit", "factory_sales.manage", so.status === "draft"],
      ["erp_so.pdf", "factory_sales.read", so.status !== "draft"],
      ["erp_so.close", "factory_sales.manage", live],
      ["erp_so.cancel", "factory_sales.manage", so.status === "draft" || so.status === "confirmed"],
    ]),
  };
};
const dnView = (ok: Ctx, d: E4["dns"][number]): Schemas["ErpDeliveryNoteDto"] => {
  const { invoiceId, ...rest } = d;
  return {
    ...rest,
    invoiced: !!invoiceId,
    nextActions: actionsOf(ok.who, [
      ["erp_do.issue", "factory_delivery.manage", d.status === "draft"],
      ["erp_do.deliver", "factory_delivery.manage", d.status === "issued"],
      ["erp_do.invoice", "factory_receivables.manage", d.status !== "draft" && d.status !== "cancelled" && !invoiceId],
      ["erp_do.pdf", "factory_sales.read", d.status !== "draft"],
      ["erp_do.cancel", "factory_delivery.manage", d.status !== "cancelled" && !invoiceId],
    ]),
  };
};
const ivOpen = (ok: Ctx, iv: Iv) =>
  iv.status === "draft" || iv.status === "voided"
    ? 0
    : Number(iv.total) - ok.e4.rcs.filter((r) => r.status === "issued").flatMap((r) => r.allocations).filter((a) => a.invoice.id === iv.id).reduce((a, x) => a + Number(x.amount), 0);
const ivView = (ok: Ctx, iv: E4["ivs"][number]): Schemas["ErpSalesInvoiceDto"] => {
  const open = ivOpen(ok, iv);
  const { dnIds, ...rest } = iv;
  const live = iv.status === "issued" || iv.status === "partially_paid";
  return {
    ...rest,
    openAmount: m2(open),
    overdue: live && iv.dueDate < today(),
    deliveryNotes: ok.e4.dns
      .filter((d) => dnIds.includes(d.id))
      .map((d) => ({ id: d.id, doNo: d.doNo, deliverOn: d.deliverOn, status: d.status })),
    receipts: ok.e4.rcs
      .filter((r) => r.allocations.some((a) => a.invoice.id === iv.id))
      .map((r) => ({ id: r.id, receiptNo: r.receiptNo, receivedOn: r.receivedOn, status: r.status, amount: r.amount })),
    notes: [],
    nextActions: actionsOf(ok.who, [
      ["erp_iv.edit", "factory_receivables.manage", iv.status === "draft"],
      ["erp_iv.issue", "factory_receivables.manage", iv.status === "draft"],
      ["erp_iv.receive", "factory_receivables.manage", live && open > 0],
      ["erp_iv.credit", "factory_receivables.manage", live],
      ["erp_iv.debit", "factory_receivables.manage", live],
      ["erp_iv.void", "factory_receivables.manage", iv.status === "issued"],
      ["erp_iv.delete", "factory_receivables.manage", iv.status === "draft"],
      ["erp_iv.pdf", "factory_receivables.read", iv.status !== "draft"],
    ]),
  };
};
const ivSummary = (ok: Ctx, iv: E4["ivs"][number]): Schemas["ErpSalesInvoiceSummaryDto"] => {
  const v = ivView(ok, iv);
  return {
    id: v.id,
    invoiceNo: v.invoiceNo,
    form: v.form,
    isTaxInvoice: v.isTaxInvoice,
    customer: v.customer,
    issueDate: v.issueDate,
    dueDate: v.dueDate,
    total: v.total,
    openAmount: v.openAmount,
    overdue: v.overdue,
    status: v.status,
    salesperson: v.salesperson,
  };
};
const leadView = (ok: Ctx, l: Lead): Schemas["ErpLeadDto"] => {
  const open = ["new", "contacted", "qualified"].includes(l.stage);
  return {
    ...l,
    openActivities: ok.e4.activities.filter((a) => a.about.id === l.id && !a.doneAt).length,
    nextActions: actionsOf(ok.who, [
      ["erp_lead.convert", "factory_sales.manage", open],
      ["erp_lead.edit", "factory_sales.manage", open],
      ["erp_lead.lose", "factory_sales.manage", open],
    ]),
  };
};
const oppView = (ok: Ctx, o: Opp): Schemas["ErpOpportunityDto"] => {
  const open = ["prospecting", "proposal", "negotiation"].includes(o.stage);
  return {
    ...o,
    weightedValue: m2((Number(o.value) * o.probabilityPct) / 100),
    quotations: ok.e4.quotes.filter((q) => q.opportunity?.id === o.id).length,
    nextActions: actionsOf(ok.who, [
      ["erp_opportunity.quote", "factory_sales.manage", open && !!o.customer],
      ["erp_opportunity.edit", "factory_sales.manage", open],
      ["erp_opportunity.win", "factory_sales.manage", open],
      ["erp_opportunity.lose", "factory_sales.manage", open],
    ]),
  };
};
const activityView = (a: Activity): Schemas["ErpActivityDto"] => ({
  ...a,
  overdue: !a.doneAt && !!a.dueAt && a.dueAt < now(),
});

const find = <T extends { id: string }>(rows: T[], id: unknown) => rows.find((r) => r.id === id);
const listOf = <T,>(request: Request, rows: T[]) => HttpResponse.json(paginate(rows, pageQuery(new URL(request.url))));

export const erpE4Handlers = [
  // ------------------------------------------------------------------------------------ CRM
  http.get(`${BASE}/salespeople`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(
      PARTNER_PERSONAS.filter((p) => p.factoryId === ok.who.factoryId).map((p) => ({ id: p.id, name: p.displayName, roles: p.roles })),
    );
  }),
  http.get(`${BASE}/pipeline`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const open = ok.e4.opps.filter((o) => ["prospecting", "proposal", "negotiation"].includes(o.stage));
    const value = (rows: Opp[]) => m2(rows.reduce((a, o) => a + Number(o.value), 0));
    const weighted = (rows: Opp[]) => m2(rows.reduce((a, o) => a + (Number(o.value) * o.probabilityPct) / 100, 0));
    return HttpResponse.json({
      openValue: value(open),
      openWeighted: weighted(open),
      closingSoon: open.filter((o) => o.expectedCloseOn && o.expectedCloseOn <= addDays(today(), 30)).length,
      myDue: ok.e4.activities.filter((a) => !a.doneAt && a.assignee.id === ok.who.id).length,
      stages: (["prospecting", "proposal", "negotiation", "won", "lost"] as const).map((stage) => {
        const rows = ok.e4.opps.filter((o) => o.stage === stage);
        return { stage, count: rows.length, value: value(rows), weighted: weighted(rows) };
      }),
      salespeople: open.length ? [{ salesperson: person(), open: open.length, value: value(open), weighted: weighted(open) }] : [],
    } satisfies Schemas["ErpPipelineDto"]);
  }),
  http.get(`${BASE}/leads`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const stage = new URL(request.url).searchParams.get("stage");
    const rows = ok.e4.leads.filter((l) =>
      !stage ? true : stage === "open" ? ["new", "contacted", "qualified"].includes(l.stage) : l.stage === stage,
    );
    return listOf(request, rows.map((l) => leadView(ok, l)));
  }),
  http.post(`${BASE}/leads`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpSaveLeadDto"]>(request);
    if (!b.name?.trim()) return invalid("name", "ใส่ชื่อ");
    const lead: Lead = {
      id: mockId("eld", (ok.e4.seq += 1)),
      name: b.name.trim(),
      contactName: b.contactName ?? null,
      phone: b.phone ?? null,
      email: b.email ?? null,
      lineId: b.lineId ?? null,
      address: b.address ?? null,
      source: b.source ?? "other",
      stage: b.stage ?? "new",
      expectedValue: b.expectedValue ?? null,
      lostReason: null,
      note: b.note ?? null,
      convertedAt: null,
      customer: null,
      salesperson: person(),
      createdAt: now(),
      version: 1,
    };
    ok.e4.leads.unshift(lead);
    return etagged(leadView(ok, lead), 201);
  }),
  http.get(`${BASE}/leads/:leadId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const lead = find(ok.e4.leads, params.leadId);
    return lead ? etagged(leadView(ok, lead)) : notFound();
  }),
  http.post(`${BASE}/leads/:leadId/actions/lose`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const lead = find(ok.e4.leads, params.leadId);
    if (!lead) return notFound();
    lead.stage = "lost";
    lead.lostReason = (await body<{ reason: string }>(request)).reason ?? null;
    lead.version += 1;
    return HttpResponse.json(leadView(ok, lead));
  }),
  http.get(`${BASE}/opportunities`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const stage = url.searchParams.get("stage");
    const customerId = url.searchParams.get("customerId");
    const rows = ok.e4.opps.filter(
      (o) =>
        (!stage || (stage === "open" ? ["prospecting", "proposal", "negotiation"].includes(o.stage) : o.stage === stage)) &&
        (!customerId || o.customer?.id === customerId),
    );
    return listOf(request, rows.map((o) => oppView(ok, o)));
  }),
  http.post(`${BASE}/opportunities`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpSaveOpportunityDto"]>(request);
    if (!b.title?.trim()) return invalid("title", "ใส่ชื่อเรื่อง");
    const customer = customerOf(ok, b.customerId);
    const stage = b.stage ?? "prospecting";
    const o: Opp = {
      id: mockId("eop", (ok.e4.seq += 1)),
      title: b.title.trim(),
      customer: customer ? coded(customer) : null,
      lead: null,
      salesperson: person(),
      stage,
      value: m2(Number(b.value ?? 0)),
      probabilityPct: b.probabilityPct ?? PROBABILITY[stage],
      expectedCloseOn: b.expectedCloseOn ?? null,
      lostReason: null,
      note: b.note ?? null,
      wonAt: null,
      closedAt: null,
      createdAt: now(),
      version: 1,
    };
    ok.e4.opps.unshift(o);
    return etagged(oppView(ok, o), 201);
  }),
  http.get(`${BASE}/opportunities/:opportunityId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const o = find(ok.e4.opps, params.opportunityId);
    return o ? etagged(oppView(ok, o)) : notFound();
  }),
  http.post(`${BASE}/opportunities/:opportunityId/actions/:action`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const o = find(ok.e4.opps, params.opportunityId);
    if (!o) return notFound();
    const won = params.action === "win";
    o.stage = won ? "won" : "lost";
    o.probabilityPct = won ? 100 : 0;
    o.closedAt = now();
    if (won) o.wonAt = now();
    else o.lostReason = (await body<{ reason: string }>(request)).reason ?? null;
    o.version += 1;
    return HttpResponse.json(oppView(ok, o));
  }),
  http.get(`${BASE}/activities`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const about = url.searchParams.get("leadId") ?? url.searchParams.get("opportunityId") ?? url.searchParams.get("customerId");
    const view = url.searchParams.get("view") ?? "open";
    const rows = ok.e4.activities.filter((a) => (!about || a.about.id === about) && (view === "all" || !a.doneAt));
    return listOf(request, rows.map(activityView));
  }),
  http.post(`${BASE}/activities`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpSaveActivityDto"]>(request);
    if (!b.subject?.trim()) return invalid("subject", "ใส่เรื่อง");
    const lead = find(ok.e4.leads, b.leadId);
    const opp = find(ok.e4.opps, b.opportunityId);
    const customer = customerOf(ok, b.customerId);
    const about = lead
      ? { type: "lead" as const, id: lead.id, name: lead.name }
      : opp
        ? { type: "opportunity" as const, id: opp.id, name: opp.title }
        : customer
          ? { type: "customer" as const, id: customer.id, name: customer.name }
          : null;
    if (!about) return invalid("leadId", "เลือกเรื่องที่ติดตาม");
    const a: Activity = {
      id: mockId("eac", (ok.e4.seq += 1)),
      kind: b.kind ?? "call",
      subject: b.subject.trim(),
      detail: b.detail ?? null,
      about,
      assignee: { id: ok.who.id, name: ok.who.displayName },
      dueAt: b.dueAt ?? null,
      doneAt: b.done ? now() : null,
      outcome: b.outcome ?? null,
      createdAt: now(),
      createdBy: ok.who.displayName,
      version: 1,
    };
    ok.e4.activities.unshift(a);
    return HttpResponse.json(activityView(a), { status: 201 });
  }),
  http.post(`${BASE}/activities/:activityId/actions/complete`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const a = find(ok.e4.activities, params.activityId);
    if (!a) return notFound();
    a.doneAt = now();
    a.version += 1;
    return HttpResponse.json(activityView(a));
  }),

  // ----------------------------------------------------------------------------- quotations
  http.get(`${BASE}/quotations`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const opportunityId = url.searchParams.get("opportunityId");
    const rows = ok.e4.quotes.filter(
      (q) =>
        (!status || (status === "open" ? ["draft", "sent"].includes(q.status) : q.status === status)) &&
        (!opportunityId || q.opportunity?.id === opportunityId),
    );
    return listOf(
      request,
      rows.map((q) => ({
        id: q.id,
        quoteNo: q.quoteNo,
        revision: q.revision,
        customer: q.customer,
        quoteDate: q.quoteDate,
        validUntil: q.validUntil,
        total: q.total,
        status: q.status,
        salesperson: q.salesperson,
        createdAt: q.createdAt,
      })),
    );
  }),
  http.post(`${BASE}/quotations`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpSaveQuotationDto"]>(request);
    const customer = customerOf(ok, b.customerId);
    if (!customer) return invalid("customerId", "เลือกลูกค้า");
    const lines = linesOf(ok, b.lines);
    if (lines instanceof Response) return lines;
    const vatMode = b.vatMode ?? "exclusive";
    const opp = find(ok.e4.opps, b.opportunityId);
    const q: Quote = {
      id: mockId("eqt", (ok.e4.seq += 1)),
      quoteNo: number(ok.erp, "qt"),
      revision: 1,
      status: "draft",
      customer: coded(customer),
      opportunity: opp ? { id: opp.id, code: opp.title, name: opp.title } : null,
      salesperson: person(),
      quoteDate: b.quoteDate ?? today(),
      validUntil: b.validUntil ?? addDays(today(), 30),
      paymentTermDays: b.paymentTermDays ?? customer.paymentTermDays,
      leadTimeDays: b.leadTimeDays ?? null,
      vatMode,
      ...totals(lines, vatMode),
      lines,
      terms: b.terms ?? null,
      note: b.note ?? null,
      customerPoNo: null,
      sentAt: null,
      acceptedAt: null,
      acceptedName: null,
      acceptedPosition: null,
      acceptedVia: null,
      rejectedAt: null,
      rejectReason: null,
      cancelReason: null,
      salesOrder: null,
      createdAt: now(),
      version: 1,
      token: null,
    };
    ok.e4.quotes.unshift(q);
    return etagged(quoteView(ok, q), 201);
  }),
  http.get(`${BASE}/quotations/:quotationId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const q = find(ok.e4.quotes, params.quotationId);
    return q ? etagged(quoteView(ok, q)) : notFound();
  }),
  http.get(`${BASE}/quotations/:quotationId/pdf`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const q = find(ok.e4.quotes, params.quotationId);
    return q ? HttpResponse.json({ ...PDF, fileName: `${q.quoteNo}.pdf` }) : notFound();
  }),
  http.post(`${BASE}/quotations/:quotationId/actions/send`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const q = find(ok.e4.quotes, params.quotationId);
    if (!q) return notFound();
    if (!["draft", "sent"].includes(q.status)) return problem(409, "erp.invalid_status", `เอกสารอยู่ในสถานะ ${q.status}`);
    q.status = "sent";
    q.sentAt = now();
    q.token = `mock${q.id.replaceAll("-", "")}`.slice(0, 32);
    q.version += 1;
    return HttpResponse.json({
      quotation: quoteView(ok, q),
      url: `http://localhost:3001/q/${q.token}`,
      expiresAt: `${q.validUntil}T23:59:59+07:00`,
    } satisfies Schemas["ErpQuotationLinkDto"]);
  }),
  http.post(`${BASE}/quotations/:quotationId/actions/:action`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const q = find(ok.e4.quotes, params.quotationId);
    if (!q) return notFound();
    const b = await body<{ name?: string; position?: string; reason?: string }>(request);
    if (params.action === "accept") {
      q.status = "accepted";
      q.acceptedAt = now();
      q.acceptedName = b.name ?? null;
      q.acceptedPosition = b.position ?? null;
      q.acceptedVia = "factory";
    } else if (params.action === "reject") {
      q.status = "rejected";
      q.rejectedAt = now();
      q.rejectReason = b.reason ?? null;
    } else if (params.action === "cancel") {
      q.status = "cancelled";
      q.cancelReason = b.reason ?? null;
    } else if (params.action === "order") {
      const customer = customerOf(ok, q.customer.id)!;
      const so: So = {
        id: mockId("eso", (ok.e4.seq += 1)),
        soNo: number(ok.erp, "so"),
        status: "draft",
        customer: q.customer,
        quotation: { id: q.id, code: q.quoteNo, name: q.quoteNo },
        opportunity: q.opportunity,
        salesperson: q.salesperson,
        customerPoNo: q.customerPoNo,
        orderDate: today(),
        deliveryDate: null,
        warehouse: (() => {
          const w = ok.erp.warehouses.find((x) => x.isDefault) ?? ok.erp.warehouses[0]!;
          return { id: w.id, code: w.code, name: w.name };
        })(),
        paymentTermDays: q.paymentTermDays,
        vatMode: q.vatMode,
        vatRatePct: q.vatRatePct,
        subtotal: q.subtotal,
        vatAmount: q.vatAmount,
        total: q.total,
        shipToAddress: customer.address,
        note: null,
        confirmedAt: null,
        creditOverrideReason: null,
        cancelReason: null,
        closeReason: null,
        lines: q.lines.map((l) => ({
          ...l,
          fulfilment: l.item ? "stock" : "service",
          reservedQty: "0.000",
          deliveredQty: "0.000",
          invoicedQty: "0.000",
          productionOrder: null,
        })),
        version: 1,
      };
      ok.e4.sos.unshift(so);
      q.salesOrder = { id: so.id, code: so.soNo, name: so.soNo };
      return HttpResponse.json(soView(ok, so), { status: 201 });
    } else return notFound();
    q.version += 1;
    return HttpResponse.json(quoteView(ok, q));
  }),

  // -------------------------------------------------------------------------- sales orders
  http.get(`${BASE}/sales-orders`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const status = new URL(request.url).searchParams.get("status");
    const rows = ok.e4.sos.filter((s) =>
      !status ? true : status === "open" ? ["confirmed", "partially_delivered"].includes(s.status) : s.status === status,
    );
    return listOf(
      request,
      rows.map((s) => {
        const v = soView(ok, s);
        return {
          id: v.id,
          soNo: v.soNo,
          customer: v.customer,
          customerPoNo: v.customerPoNo,
          orderDate: v.orderDate,
          deliveryDate: v.deliveryDate,
          total: v.total,
          deliveredPct: v.deliveredPct,
          late: v.late,
          status: v.status,
          salesperson: v.salesperson,
        };
      }),
    );
  }),
  http.get(`${BASE}/sales-orders/:salesOrderId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const so = find(ok.e4.sos, params.salesOrderId);
    return so ? etagged(soView(ok, so)) : notFound();
  }),
  http.get(`${BASE}/sales-orders/:salesOrderId/pdf`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    return ok instanceof Response ? ok : HttpResponse.json(PDF);
  }),
  http.post(`${BASE}/sales-orders/:salesOrderId/actions/:action`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.manage");
    if (ok instanceof Response) return ok;
    const so = find(ok.e4.sos, params.salesOrderId);
    if (!so) return notFound();
    const b = await body<{ reason?: string }>(request);
    if (params.action === "confirm") {
      so.status = "confirmed";
      so.confirmedAt = now();
      for (const l of so.lines) if (l.fulfilment === "stock") l.reservedQty = l.quantity;
    } else if (params.action === "close") {
      so.status = "closed";
      so.closeReason = b.reason ?? null;
    } else if (params.action === "cancel") {
      so.status = "cancelled";
      so.cancelReason = b.reason ?? null;
    } else return notFound();
    so.version += 1;
    return HttpResponse.json(soView(ok, so));
  }),

  // ------------------------------------------------------------------------ delivery notes
  http.get(`${BASE}/delivery-notes`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const soId = url.searchParams.get("salesOrderId");
    const rows = ok.e4.dns.filter(
      (d) =>
        (!status || (status === "uninvoiced" ? d.status !== "draft" && d.status !== "cancelled" && !d.invoiceId : d.status === status)) &&
        (!soId || d.salesOrder.id === soId),
    );
    return listOf(
      request,
      rows.map((d) => ({ id: d.id, doNo: d.doNo, customer: d.customer, salesOrder: d.salesOrder, deliverOn: d.deliverOn, status: d.status, invoiced: !!d.invoiceId })),
    );
  }),
  http.post(`${BASE}/delivery-notes`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_delivery.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpCreateDeliveryNoteDto"]>(request);
    const so = find(ok.e4.sos, b.salesOrderId);
    if (!so) return notFound();
    const wanted = b.lines ?? so.lines.filter((l) => l.fulfilment !== "service").map((l) => ({ salesOrderLineId: l.id, quantity: l.quantity }));
    const d: E4["dns"][number] = {
      id: mockId("edn", (ok.e4.seq += 1)),
      doNo: number(ok.erp, "do"),
      status: "draft",
      customer: so.customer,
      salesOrder: { id: so.id, code: so.soNo, name: so.soNo },
      warehouse: so.warehouse,
      deliverOn: b.deliverOn ?? today(),
      shipToAddress: b.shipToAddress ?? so.shipToAddress,
      vehicle: b.vehicle ?? null,
      note: b.note ?? null,
      issuedAt: null,
      deliveredAt: null,
      receivedBy: null,
      podFileId: null,
      costTotal: "0.00",
      cancelReason: null,
      lines: wanted.map((w, i) => {
        const l = so.lines.find((x) => x.id === w.salesOrderLineId)!;
        return {
          id: mockId("edl", (ok.e4.seq += 1)),
          lineNo: i + 1,
          salesOrderLineId: l.id,
          item: l.item,
          description: l.description,
          quantity: Number(w.quantity).toFixed(3),
          unit: l.unit,
          unitCost: null,
          costAmount: null,
          invoicedQty: "0.000",
        };
      }),
      version: 1,
      invoiceId: null,
    };
    ok.e4.dns.unshift(d);
    return etagged(dnView(ok, d), 201);
  }),
  http.get(`${BASE}/delivery-notes/:deliveryNoteId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const d = find(ok.e4.dns, params.deliveryNoteId);
    return d ? etagged(dnView(ok, d)) : notFound();
  }),
  http.get(`${BASE}/delivery-notes/:deliveryNoteId/pdf`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    return ok instanceof Response ? ok : HttpResponse.json(PDF);
  }),
  http.post(`${BASE}/delivery-notes/:deliveryNoteId/actions/:action`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_delivery.manage");
    if (ok instanceof Response) return ok;
    const d = find(ok.e4.dns, params.deliveryNoteId);
    if (!d) return notFound();
    const so = find(ok.e4.sos, d.salesOrder.id)!;
    const b = await body<{ receivedBy?: string; reason?: string }>(request);
    if (params.action === "issue") {
      d.status = "issued";
      d.issuedAt = now();
      for (const l of d.lines) {
        const sl = so.lines.find((x) => x.id === l.salesOrderLineId)!;
        sl.deliveredQty = (Number(sl.deliveredQty) + Number(l.quantity)).toFixed(3);
        l.unitCost = "10.000000";
        l.costAmount = m2(Number(l.quantity) * 10);
      }
      d.costTotal = m2(d.lines.reduce((a, l) => a + Number(l.costAmount), 0));
      const all = so.lines.filter((l) => l.fulfilment !== "service").every((l) => Number(l.deliveredQty) >= Number(l.quantity));
      so.status = all ? "delivered" : "partially_delivered";
    } else if (params.action === "deliver") {
      if (!b.receivedBy?.trim()) return invalid("receivedBy", "ใส่ชื่อผู้รับ");
      d.status = "delivered";
      d.deliveredAt = now();
      d.receivedBy = b.receivedBy.trim();
    } else if (params.action === "cancel") {
      d.status = "cancelled";
      d.cancelReason = b.reason ?? null;
    } else return notFound();
    d.version += 1;
    return HttpResponse.json(dnView(ok, d));
  }),

  // ------------------------------------------------------------------------------ invoices
  http.get(`${BASE}/sales-invoices`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");
    const rows = ok.e4.ivs
      .map((iv) => ivSummary(ok, iv))
      .filter(
        (iv) =>
          (!customerId || iv.customer.id === customerId) &&
          (!status ||
            (status === "open"
              ? ["issued", "partially_paid"].includes(iv.status)
              : status === "overdue"
                ? iv.overdue
                : iv.status === status)),
      );
    return listOf(request, rows);
  }),
  http.post(`${BASE}/sales-invoices`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpCreateSalesInvoiceDto"]>(request);
    const customer = customerOf(ok, b.customerId);
    if (!customer) return invalid("customerId", "เลือกลูกค้า");
    const so = find(ok.e4.sos, b.salesOrderId);
    const dns = ok.e4.dns.filter((d) => (b.deliveryNoteIds ?? []).includes(d.id));
    let lines: Line[] = [];
    if (dns.length || so) {
      const source = so ?? find(ok.e4.sos, dns[0]!.salesOrder.id)!;
      for (const d of dns)
        for (const l of d.lines) {
          const sl = source.lines.find((x) => x.id === l.salesOrderLineId)!;
          lines.push({ ...sl, id: mockId("eil", (ok.e4.seq += 1)), lineNo: lines.length + 1, quantity: l.quantity, amount: m2((Number(l.quantity) * Number(sl.unitPrice) * (100 - Number(sl.discountPct))) / 100) });
        }
      if (so) for (const sl of so.lines.filter((l) => l.fulfilment === "service" && Number(l.invoicedQty) === 0)) lines.push({ ...sl, id: mockId("eil", (ok.e4.seq += 1)), lineNo: lines.length + 1 });
      lines = lines.map(({ id, lineNo, item, description, quantity, unit, unitPrice, discountPct, amount }) => ({ id, lineNo, item, description, quantity, unit, unitPrice, discountPct, amount }));
    } else {
      const free = linesOf(ok, b.lines);
      if (free instanceof Response) return free;
      lines = free;
    }
    if (!lines.length) return problem(422, "erp.nothing_to_invoice", "ไม่มีรายการที่ต้องออกบิล");
    const vatMode = b.vatMode ?? so?.vatMode ?? "exclusive";
    const days = b.paymentTermDays ?? customer.paymentTermDays;
    const issueDate = b.issueDate ?? today();
    const iv: E4["ivs"][number] = {
      id: mockId("eiv", (ok.e4.seq += 1)),
      invoiceNo: null,
      form: b.form ?? "invoice",
      isTaxInvoice: true,
      status: "draft",
      customer: coded(customer),
      salesOrder: so ? { id: so.id, code: so.soNo, name: so.soNo } : dns[0] ? dns[0].salesOrder : null,
      salesperson: person(),
      issueDate,
      dueDate: addDays(issueDate, days),
      paymentTermDays: days,
      customerPoNo: b.customerPoNo ?? null,
      vatMode,
      ...totals(lines, vatMode),
      totalInWords: "(จำลอง)",
      lines,
      seller: { name: "โรงงานตัวอย่าง (จำลอง)", address: "1 ถนนจำลอง", taxId: "0000500000001", branchCode: "00000", phone: null },
      buyer: { name: customer.name, address: customer.address, taxId: customer.taxId, branchCode: customer.branchCode, phone: customer.phone },
      creditedAmount: "0.00",
      debitedAmount: "0.00",
      receivedAmount: "0.00",
      note: b.note ?? null,
      issuedAt: null,
      voidedAt: null,
      voidReason: null,
      version: 1,
      dnIds: dns.map((d) => d.id),
    };
    for (const d of dns) d.invoiceId = iv.id;
    ok.e4.ivs.unshift(iv);
    return etagged(ivView(ok, iv), 201);
  }),
  http.get(`${BASE}/sales-invoices/:invoiceId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    if (ok instanceof Response) return ok;
    const iv = find(ok.e4.ivs, params.invoiceId);
    return iv ? etagged(ivView(ok, iv)) : notFound();
  }),
  http.get(`${BASE}/sales-invoices/:invoiceId/pdf`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    return ok instanceof Response ? ok : HttpResponse.json(PDF);
  }),
  http.post(`${BASE}/sales-invoices/:invoiceId/actions/:action`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.manage");
    if (ok instanceof Response) return ok;
    const iv = find(ok.e4.ivs, params.invoiceId);
    if (!iv) return notFound();
    const b = await body<{ issueDate?: string; reason?: string }>(request);
    if (params.action === "issue") {
      iv.issueDate = b.issueDate ?? iv.issueDate;
      iv.dueDate = addDays(iv.issueDate, iv.paymentTermDays);
      iv.invoiceNo = number(ok.erp, "iv", iv.issueDate);
      iv.status = "issued";
      iv.issuedAt = now();
    } else if (params.action === "void") {
      iv.status = "voided";
      iv.voidedAt = now();
      iv.voidReason = b.reason ?? null;
    } else return notFound();
    iv.version += 1;
    return HttpResponse.json(ivView(ok, iv));
  }),
  http.get(`${BASE}/sales-notes`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    return ok instanceof Response ? ok : listOf(request, []);
  }),

  // --------------------------------------------------------------------------- receivables
  http.get(`${BASE}/receipts`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    if (ok instanceof Response) return ok;
    return listOf(request, ok.e4.rcs.map((r) => ({ ...r, nextActions: [] })));
  }),
  http.post(`${BASE}/receipts`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpCreateReceiptDto"]>(request);
    const customer = customerOf(ok, b.customerId);
    if (!customer) return invalid("customerId", "เลือกลูกค้า");
    const allocations = (b.allocations ?? []).map((a) => {
      const iv = find(ok.e4.ivs, a.invoiceId)!;
      return { invoice: { id: iv.id, invoiceNo: iv.invoiceNo, status: iv.status, total: iv.total }, amount: m2(Number(a.amount)) };
    });
    const rc: Rc = {
      id: mockId("erc", (ok.e4.seq += 1)),
      receiptNo: number(ok.erp, "rc"),
      kind: b.kind ?? "receipt",
      status: "issued",
      customer: coded(customer),
      receivedOn: b.receivedOn ?? today(),
      method: b.method ?? "transfer",
      reference: b.reference ?? null,
      chequeNo: null,
      chequeBank: null,
      chequeDate: null,
      amount: m2(Number(b.amount ?? 0)),
      amountInWords: "(จำลอง)",
      whtAmount: m2(Number(b.whtAmount ?? 0)),
      whtCertNo: b.whtCertNo ?? null,
      whtCertDate: b.whtCertDate ?? null,
      whtFileId: null,
      note: b.note ?? null,
      cancelReason: null,
      allocations,
      createdAt: now(),
      createdBy: ok.who.displayName,
    };
    ok.e4.rcs.unshift(rc);
    for (const a of allocations) {
      const iv = find(ok.e4.ivs, a.invoice.id)!;
      iv.status = ivOpen(ok, iv) <= 0.004 ? "paid" : "partially_paid";
      iv.receivedAmount = m2(Number(iv.total) - ivOpen(ok, iv));
    }
    return HttpResponse.json({ ...rc, nextActions: [] }, { status: 201 });
  }),
  http.get(`${BASE}/receipts/:receiptId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    if (ok instanceof Response) return ok;
    const rc = find(ok.e4.rcs, params.receiptId);
    return rc
      ? HttpResponse.json({ ...rc, nextActions: actionsOf(ok.who, [["erp_rc.pdf", "factory_receivables.read", true]]) })
      : notFound();
  }),
  http.get(`${BASE}/billing-notes`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    return ok instanceof Response ? ok : listOf(request, []);
  }),
  http.get(`${BASE}/receivables/aging`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_receivables.read");
    if (ok instanceof Response) return ok;
    const open = ok.e4.ivs.filter((iv) => ivOpen(ok, iv) > 0);
    const byCustomer = new Map<string, number>();
    for (const iv of open) byCustomer.set(iv.customer.id, (byCustomer.get(iv.customer.id) ?? 0) + ivOpen(ok, iv));
    const buckets = (n: number) => ({ current: m2(n), d1_30: "0.00", d31_60: "0.00", d61_90: "0.00", over90: "0.00", total: m2(n) });
    const all = [...byCustomer.values()].reduce((a, n) => a + n, 0);
    return HttpResponse.json({
      asOf: today(),
      currency: "THB",
      dueSoon: "0.00",
      refundsDue: "0.00",
      totals: buckets(all),
      customers: [...byCustomer.entries()].map(([id, n]) => {
        const c = customerOf(ok, id)!;
        return { customer: coded(c), buckets: buckets(n), invoices: open.filter((iv) => iv.customer.id === id).length, creditLimit: c.creditLimit };
      }),
    } satisfies Schemas["ErpArAgingDto"]);
  }),

  // ----------------------------------------------------------------------------------- tax
  http.get(`${BASE}/tax/:report`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_tax.read");
    if (ok instanceof Response) return ok;
    const month = new URL(request.url).searchParams.get("month") ?? today().slice(0, 7);
    if (params.report === "vat30")
      return HttpResponse.json({ month, vatRegistered: true, salesNet: "0.00", outputVat: "0.00", purchaseNet: "0.00", inputVat: "0.00", vatPayable: "0.00", dueOn: `${month}-15` });
    if (params.report === "wht")
      return HttpResponse.json({ month, form: "pnd53", rows: [], baseAmount: "0.00", whtAmount: "0.00", dueOn: `${month}-07` });
    const issued = ok.e4.ivs.filter((iv) => params.report === "sales-vat" && iv.invoiceNo && iv.issueDate.startsWith(month));
    return HttpResponse.json({
      month,
      kind: params.report === "sales-vat" ? "sales" : "purchase",
      rows: issued.map((iv) => ({
        date: iv.issueDate,
        docNo: iv.invoiceNo!,
        kind: "tax_invoice" as const,
        partyName: iv.buyer.name,
        partyTaxId: iv.buyer.taxId,
        partyBranch: iv.buyer.branchCode,
        net: iv.subtotal,
        vat: iv.vatAmount,
        voided: iv.status === "voided",
        sourceId: iv.id,
      })),
      net: m2(issued.reduce((a, iv) => a + Number(iv.subtotal), 0)),
      vat: m2(issued.reduce((a, iv) => a + Number(iv.vatAmount), 0)),
    } satisfies Schemas["ErpVatReportDto"]);
  }),
  http.post(`${BASE}/tax/exports`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_tax.read");
    return ok instanceof Response ? ok : HttpResponse.json({ ...PDF, fileName: "report.csv", rows: 0 });
  }),
  http.get(`${BASE}/wht-certificates`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.read");
    return ok instanceof Response ? ok : listOf(request, []);
  }),
  http.get(`${BASE}/supplier-payments/:paymentId/wht`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_ap.read");
    return ok instanceof Response ? ok : problem(422, "erp.no_withholding", "การจ่ายนี้ไม่มีภาษีหัก ณ ที่จ่าย");
  }),
  http.get(`${BASE}/sales/report`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_sales.read");
    if (ok instanceof Response) return ok;
    const month = new URL(request.url).searchParams.get("month") ?? today().slice(0, 7);
    const net = ok.e4.ivs.filter((iv) => iv.invoiceNo && iv.issueDate.startsWith(month)).reduce((a, iv) => a + Number(iv.subtotal), 0);
    return HttpResponse.json({
      month,
      invoicedNet: m2(net),
      targetNet: "0.00",
      commission: "0.00",
      grossProfit: m2(net),
      rows: [],
    } satisfies Schemas["ErpSalesReportDto"]);
  }),

  // ------------------------------------------------------------------------ public link
  http.get("*/v1/store/quote-links/:token", ({ params }) => {
    for (const [, s] of states) {
      const q = s.quotes.find((x) => x.token === params.token);
      if (q)
        return HttpResponse.json({
          quoteNo: q.quoteNo,
          revision: q.revision,
          status: q.status === "draft" ? "sent" : q.status,
          seller: { name: "โรงงานตัวอย่าง (จำลอง)", address: "1 ถนนจำลอง", taxId: "0000500000001", branchCode: "00000", phone: null },
          sellerLogoUrl: null,
          sellerContact: null,
          buyer: { name: q.customer.name, address: null, taxId: null, branchCode: null, phone: null },
          quoteDate: q.quoteDate,
          validUntil: q.validUntil,
          paymentTermDays: q.paymentTermDays,
          leadTimeDays: q.leadTimeDays,
          vatMode: q.vatMode,
          vatRatePct: q.vatRatePct,
          subtotal: q.subtotal,
          vatAmount: q.vatAmount,
          total: q.total,
          totalInWords: "(จำลอง)",
          lines: q.lines,
          terms: q.terms,
          acceptedAt: q.acceptedAt,
          acceptedName: q.acceptedName,
        } satisfies Schemas["PublicQuotationDto"]);
    }
    return problem(404, "http.not_found", "ไม่พบใบเสนอราคา");
  }),
  http.post("*/v1/store/quote-links/:token/actions/:action", async ({ request, params }) => {
    for (const [, s] of states) {
      const q = s.quotes.find((x) => x.token === params.token);
      if (!q) continue;
      if (q.status !== "sent") return problem(409, "erp.invalid_status", "ตอบไปแล้ว");
      const b = await body<{ name?: string; reason?: string }>(request);
      if (params.action === "accept") {
        q.status = "accepted";
        q.acceptedAt = now();
        q.acceptedName = b.name ?? null;
        q.acceptedVia = "link";
      } else {
        q.status = "rejected";
        q.rejectReason = b.reason ?? null;
      }
      q.version += 1;
      return new HttpResponse(null, { status: 204 });
    }
    return problem(404, "http.not_found", "ไม่พบใบเสนอราคา");
  }),
];

export const erpE4Mock = { e4Of, states };
