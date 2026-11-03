/**
 * getpack Agent's Phase 3 (D-468) for the mock persona `agent` (phone 0861234567): the lead pipeline and its
 * timeline, the neutral duplicate check, card scan (a fake parse), CSV import / export, quotes on behalf with their
 * share link, discount requests (an offered round so the options can be walked), deal registration, the playbook and
 * the commission forecast. Stateful for the life of the mock server; every value is obviously fake. Money is computed
 * here only because the mock stands in for the API — the web never does it.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId, problem } from "../support";
import { customerOf } from "./customers";
import {
  buildQuote,
  configuratorOf,
  findQuote,
  inputsOf,
  optionIdOf,
  productOfId,
  quotesOf,
  toSavedQuote,
  toStoreConfiguratorDto,
  type StoreQuote,
} from "./quotes";
import { catalogProducts } from "./catalog";

type Lead = Schemas["AgentLeadDto"];
type Activity = Schemas["AgentLeadActivityDto"];
type AgentQuote = Schemas["AgentQuoteDto"];
type DiscountRequest = Schemas["AgentDiscountRequestDto"];
type Stage = Schemas["AgentLeadStage"];

const isAgent = (request: Request) => customerOf(request)?.persona === "agent";
const DAY_MIN = 24 * 60;
/** The agent's code, as `mocks/store/agent.ts` hands it out. */
export const MOCK_AGENT_CODE = "MOCKAG01";
const LEAD_PROTECTION_DAYS = 60;

/** `YYYY-MM-DDTHH:mm:00+07:00` on the Bangkok day `days` from today. */
function bangkokAt(days: number, hour: number, minute = 0): string {
  const day = bangkokIso(days * DAY_MIN).slice(0, 10);
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`;
}
const endOfTodayMs = () => Date.parse(`${bangkokIso().slice(0, 10)}T23:59:59+07:00`);

let seq = 100;
const nextId = (namespace: string) => mockId(namespace, (seq += 1));

function lead(partial: Partial<Lead> & Pick<Lead, "id" | "contactName">): Lead {
  const now = bangkokIso();
  return {
    kind: "customer",
    organisationName: null,
    phone: null,
    email: null,
    taxId: null,
    note: null,
    status: "registered",
    protectedUntil: bangkokAt(LEAD_PROTECTION_DAYS, 10),
    convertedAt: null,
    closedReason: null,
    createdAt: now,
    stage: "new",
    stageChangedAt: null,
    expectedValue: null,
    nextFollowUpAt: null,
    lostReason: null,
    lostNote: null,
    source: "manual",
    industry: null,
    lineId: null,
    tags: [],
    wonAt: null,
    updatedAt: now,
    ...partial,
  };
}

const LEAD_IDS = {
  manee: "00000000-0000-4000-8000-0000000a0401",
  piti: "00000000-0000-4000-8000-0000000a0402",
  chujai: "00000000-0000-4000-8000-0000000a0403",
  wira: "00000000-0000-4000-8000-0000000a0404",
  kanya: "00000000-0000-4000-8000-0000000a0405",
  somsak: "00000000-0000-4000-8000-0000000a0406",
  napa: "00000000-0000-4000-8000-0000000a0407",
  dara: "00000000-0000-4000-8000-0000000a0408",
} as const;

function seedLeads(): Lead[] {
  return [
    lead({
      id: LEAD_IDS.manee,
      contactName: "คุณมานี ใจดี",
      organisationName: "ร้านกาแฟบ้านสวน (ข้อมูลจำลอง)",
      phone: "+66890001234",
      lineId: "manee.cafe",
      industry: "ร้านกาแฟ",
      tags: ["เบเกอรี่", "รายเดือน"],
      stage: "negotiating",
      stageChangedAt: bangkokAt(-1, 15),
      expectedValue: "86000.00",
      nextFollowUpAt: bangkokAt(0, 10),
      protectedUntil: bangkokAt(41, 10),
      createdAt: bangkokAt(-19, 10),
      updatedAt: bangkokAt(-1, 15),
      note: "สนใจกล่องเค้กพิมพ์โลโก้ 2 ขนาด",
    }),
    lead({
      id: LEAD_IDS.wira,
      contactName: "คุณวีระ ทองดี",
      organisationName: "บริษัท ขนมไทยดีดี จำกัด (ข้อมูลจำลอง)",
      phone: "+66812220001",
      email: "wira@example.invalid",
      taxId: "0105500000017",
      industry: "ขนมและของฝาก",
      stage: "quoted",
      stageChangedAt: bangkokAt(-3, 11),
      expectedValue: "620000.00",
      nextFollowUpAt: bangkokAt(-1, 14),
      protectedUntil: bangkokAt(87, 10),
      createdAt: bangkokAt(-12, 9),
      updatedAt: bangkokAt(-3, 11),
      source: "card_scan",
    }),
    lead({
      id: LEAD_IDS.chujai,
      contactName: "คุณชูใจ มีสุข",
      phone: "+66870004567",
      stage: "contacted",
      stageChangedAt: bangkokAt(-6, 16),
      nextFollowUpAt: bangkokAt(3, 10),
      protectedUntil: bangkokAt(4, 10),
      createdAt: bangkokAt(-56, 10),
      updatedAt: bangkokAt(-6, 16),
    }),
    lead({
      id: LEAD_IDS.kanya,
      contactName: "คุณกันยา ศรีงาม",
      organisationName: "แบรนด์เทียนหอม (ข้อมูลจำลอง)",
      email: "kanya@example.invalid",
      stage: "new",
      expectedValue: "24000.00",
      createdAt: bangkokAt(-1, 18),
      updatedAt: bangkokAt(-1, 18),
      protectedUntil: bangkokAt(59, 18),
      source: "csv_import",
    }),
    lead({
      id: LEAD_IDS.somsak,
      contactName: "คุณสมศักดิ์ ใจเย็น",
      organisationName: "ร้านอุปกรณ์ตกปลา (ข้อมูลจำลอง)",
      phone: "+66860007788",
      stage: "contacted",
      stageChangedAt: bangkokAt(-2, 9),
      nextFollowUpAt: bangkokAt(0, 16, 30),
      createdAt: bangkokAt(-9, 9),
      updatedAt: bangkokAt(-2, 9),
      protectedUntil: bangkokAt(51, 9),
    }),
    lead({
      id: LEAD_IDS.piti,
      contactName: "คุณปิติ รักษ์ดี",
      organisationName: "แบรนด์สบู่ธรรมชาติ (ข้อมูลจำลอง)",
      email: "piti@example.invalid",
      status: "converted",
      stage: "won",
      stageChangedAt: bangkokAt(-5, 14),
      wonAt: bangkokAt(-5, 14),
      expectedValue: "18000.00",
      convertedAt: bangkokAt(-6, 14),
      protectedUntil: bangkokAt(47, 10),
      createdAt: bangkokAt(-13, 10),
      updatedAt: bangkokAt(-5, 14),
    }),
    lead({
      id: LEAD_IDS.napa,
      contactName: "คุณนภา สายลม",
      organisationName: "ร้านดอกไม้ (ข้อมูลจำลอง)",
      phone: "+66850003344",
      status: "withdrawn",
      closedReason: "lost",
      stage: "lost",
      lostReason: "price",
      lostNote: "เลือกเจ้าเดิมที่ราคาต่ำกว่า",
      stageChangedAt: bangkokAt(-8, 13),
      protectedUntil: bangkokAt(-8, 13),
      createdAt: bangkokAt(-30, 10),
      updatedAt: bangkokAt(-8, 13),
    }),
    lead({
      id: LEAD_IDS.dara,
      contactName: "คุณดารา แสงทอง",
      organisationName: "ร้านเครื่องประดับ (ข้อมูลจำลอง)",
      lineId: "dara.gems",
      stage: "contacted",
      stageChangedAt: bangkokAt(-4, 10),
      nextFollowUpAt: bangkokAt(7, 10),
      createdAt: bangkokAt(-20, 10),
      updatedAt: bangkokAt(-4, 10),
      protectedUntil: bangkokAt(6, 10),
    }),
  ];
}

function activity(_leadId: string, partial: Partial<Activity> & Pick<Activity, "kind" | "occurredAt">): Activity {
  return {
    id: nextId("act"),
    author: "agent",
    body: null,
    event: null,
    fromStage: null,
    toStage: null,
    agentQuoteId: null,
    ...partial,
  };
}

function seedActivities(): Map<string, Activity[]> {
  const map = new Map<string, Activity[]>();
  const add = (leadId: string, list: Activity[]) => map.set(leadId, list);
  add(LEAD_IDS.manee, [
    activity(LEAD_IDS.manee, {
      kind: "system",
      author: "system",
      event: "discount_options",
      occurredAt: bangkokAt(-1, 17),
      body: "getpack ส่งทางเลือกส่วนลดกลับมาแล้ว",
    }),
    activity(LEAD_IDS.manee, {
      kind: "stage_change",
      author: "system",
      event: "discount_requested",
      fromStage: "quoted",
      toStage: "negotiating",
      occurredAt: bangkokAt(-1, 15),
    }),
    activity(LEAD_IDS.manee, {
      kind: "system",
      author: "system",
      event: "quote_opened",
      occurredAt: bangkokAt(-2, 20, 12),
    }),
    activity(LEAD_IDS.manee, {
      kind: "quote_sent",
      occurredAt: bangkokAt(-3, 11),
      body: "ส่งใบเสนอราคากล่องเค้ก 1,000 ใบ",
    }),
    activity(LEAD_IDS.manee, {
      kind: "visit",
      occurredAt: bangkokAt(-10, 14),
      body: "ไปที่ร้าน ดูขนาดเค้กจริง ใช้ 2 ขนาด เดือนละประมาณ 1,000 ใบ",
    }),
    activity(LEAD_IDS.manee, { kind: "call", occurredAt: bangkokAt(-18, 10), body: "โทรแนะนำตัว นัดเข้าไปที่ร้าน" }),
  ]);
  add(LEAD_IDS.wira, [
    activity(LEAD_IDS.wira, {
      kind: "system",
      author: "system",
      event: "deal_registered",
      occurredAt: bangkokAt(-3, 11, 1),
      body: "ดีลนี้ถูกจองให้คุณอัตโนมัติ",
    }),
    activity(LEAD_IDS.wira, { kind: "quote_sent", occurredAt: bangkokAt(-3, 11) }),
    activity(LEAD_IDS.wira, { kind: "line", occurredAt: bangkokAt(-7, 19), body: "ขอสเปกกล่องของฝากชุดปีใหม่" }),
  ]);
  add(LEAD_IDS.chujai, [
    activity(LEAD_IDS.chujai, {
      kind: "call",
      occurredAt: bangkokAt(-6, 16),
      body: "ยังไม่สะดวกคุย ให้โทรกลับต้นเดือน",
    }),
  ]);
  add(LEAD_IDS.somsak, [
    activity(LEAD_IDS.somsak, { kind: "line", occurredAt: bangkokAt(-2, 9), body: "ส่งรูปกล่องเดิมมาให้ดู" }),
  ]);
  add(LEAD_IDS.piti, [
    activity(LEAD_IDS.piti, { kind: "system", author: "system", event: "won", occurredAt: bangkokAt(-5, 14) }),
    activity(LEAD_IDS.piti, {
      kind: "system",
      author: "system",
      event: "converted",
      occurredAt: bangkokAt(-6, 14),
    }),
  ]);
  add(LEAD_IDS.napa, [
    activity(LEAD_IDS.napa, {
      kind: "stage_change",
      fromStage: "quoted",
      toStage: "lost",
      event: "lost",
      occurredAt: bangkokAt(-8, 13),
      body: "เลือกเจ้าเดิมที่ราคาต่ำกว่า",
    }),
  ]);
  add(LEAD_IDS.dara, [activity(LEAD_IDS.dara, { kind: "email", occurredAt: bangkokAt(-4, 10), body: "ส่งแคตตาล็อก" })]);
  return map;
}

let leads: Lead[] = [];
let activities = new Map<string, Activity[]>();
const versions = new Map<string, number>();
/** Agent quote id → its record (the saved quote lives in `./quotes`, persona `agentquotes`). */
let agentQuotes: (Omit<AgentQuote, "quote"> & { quoteId: string; token: string })[] = [];
let discountRequests = new Map<string, DiscountRequest[]>();
let imports = new Map<string, Schemas["AgentLeadImportDto"] & { pending: Lead[] }>();
let seeded = false;
const QUOTE_PERSONA = "agentquotes";

export function resetAgentLeadsMock(): void {
  leads = seedLeads();
  activities = seedActivities();
  versions.clear();
  agentQuotes = [];
  discountRequests = new Map();
  imports = new Map();
  quotesOf(QUOTE_PERSONA).length = 0;
  seeded = false;
}
resetAgentLeadsMock();

/** The leads the P0–P2 page list (`store.agent.leads`) shows. */
export const agentLeads = () => leads;

const etagOf = (id: string) => `W/"${id}.${versions.get(id) ?? 1}"`;
const touch = (row: Lead) => {
  versions.set(row.id, (versions.get(row.id) ?? 1) + 1);
  row.updatedAt = bangkokIso();
};
const addActivity = (leadId: string, entry: Activity) => {
  const list = activities.get(leadId) ?? [];
  list.unshift(entry);
  activities.set(leadId, list);
};
const STAGE_ORDER: Stage[] = ["new", "contacted", "quoted", "negotiating"];
/** The system moves a lead forward only (D-468 §1). */
function moveForward(row: Lead, to: Stage, event: Schemas["AgentLeadSystemEvent"] | null) {
  if (row.stage === "won" || row.stage === "lost") return;
  if (STAGE_ORDER.indexOf(to) <= STAGE_ORDER.indexOf(row.stage)) return;
  addActivity(
    row.id,
    activity(row.id, {
      kind: "stage_change",
      author: "system",
      event,
      fromStage: row.stage,
      toStage: to,
      occurredAt: bangkokIso(),
    }),
  );
  row.stage = to;
  row.stageChangedAt = bangkokIso();
  touch(row);
}

const digits = (value: string | null | undefined) => (value ?? "").replace(/[^0-9]/g, "");
const samePhone = (a: string | null | undefined, b: string | null | undefined) => {
  const left = digits(a).replace(/^66/, "0");
  const right = digits(b).replace(/^66/, "0");
  return left.length > 0 && left === right;
};
/**
 * Contacts held elsewhere (another agent's protected lead, an existing customer): the API refuses them with one
 * neutral answer (D-440). The mock's are obviously fake.
 */
const UNAVAILABLE_PHONES = ["0899999999", "0811111111"];
const UNAVAILABLE_EMAILS = ["taken@example.invalid"];
const UNAVAILABLE_TAX_IDS = ["0105599999999"];

function availability(input: { phone?: string | null; email?: string | null; taxId?: string | null }, except?: string) {
  const own = leads.find(
    (row) =>
      row.id !== except &&
      row.status === "registered" &&
      ((input.phone && samePhone(row.phone, input.phone)) ||
        (input.email && row.email?.toLowerCase() === input.email.toLowerCase()) ||
        (input.taxId && row.taxId === input.taxId)),
  );
  if (own) return { available: false, reason: "own_lead" as const, leadId: own.id };
  const taken =
    (input.phone && UNAVAILABLE_PHONES.some((phone) => samePhone(phone, input.phone))) ||
    (input.email && UNAVAILABLE_EMAILS.includes(input.email.toLowerCase())) ||
    (input.taxId && UNAVAILABLE_TAX_IDS.includes(input.taxId));
  if (taken) return { available: false, reason: "unavailable" as const, leadId: null };
  return { available: true, reason: null, leadId: null };
}

const isOpen = (row: Lead) => ["registered", "converted"].includes(row.status) && !["won", "lost"].includes(row.stage);

function filterLeads(url: URL): Lead[] {
  const view = url.searchParams.get("view");
  const stages = url.searchParams
    .getAll("stage")
    .flatMap((value) => value.split(","))
    .filter(Boolean);
  const source = url.searchParams.get("source");
  const due = url.searchParams.get("due");
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const now = Date.now();
  return leads.filter((row) => {
    if (view === "open" && !isOpen(row)) return false;
    if (
      view === "follow_up_today" &&
      !(isOpen(row) && row.nextFollowUpAt && Date.parse(row.nextFollowUpAt) <= endOfTodayMs())
    )
      return false;
    if (
      view === "protection_ending" &&
      !(
        row.status === "registered" &&
        Date.parse(row.protectedUntil) > now &&
        Date.parse(row.protectedUntil) <= now + 7 * 86_400_000
      )
    )
      return false;
    if (
      view === "closed" &&
      !(["won", "lost"].includes(row.stage) || ["expired", "withdrawn", "rejected"].includes(row.status))
    )
      return false;
    if (stages.length && !stages.includes(row.stage)) return false;
    if (source && row.source !== source) return false;
    if (due === "today" && !(row.nextFollowUpAt && Date.parse(row.nextFollowUpAt) <= endOfTodayMs())) return false;
    if (due === "overdue" && !(row.nextFollowUpAt && Date.parse(row.nextFollowUpAt) < now)) return false;
    if (q) {
      const hay = [row.contactName, row.organisationName, row.phone, row.email, row.taxId, row.lineId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const phoneQ = q.replace(/^0/, "");
      if (!hay.includes(q) && !(phoneQ.length >= 3 && digits(row.phone).includes(phoneQ))) return false;
    }
    return true;
  });
}

function sortLeads(rows: Lead[], sort: string | null, order: string | null): Lead[] {
  const key = (sort ?? "updatedAt") as keyof Lead;
  const direction = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[key] as string | null;
    const right = b[key] as string | null;
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    if (key === "expectedValue") return (Number(left) - Number(right)) * direction;
    return String(left).localeCompare(String(right)) * direction;
  });
}

const notMine = () => problem(404, "http.not_found", "ไม่พบลูกค้ามุ่งหวังรายนี้");
const findLead = (id: unknown) => leads.find((row) => row.id === id);

/* -------------------------------------------------------------------------------------- quotes */

function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  const dto = catalogProducts()
    .map((row) => configuratorOf(row))
    .map((configurator) => (configurator ? toStoreConfiguratorDto(configurator) : null))
    .find((candidate) => candidate?.instant && candidate.defaultSpec);
  if (!dto) return;
  const base = dto.defaultSpec?.configuration as Record<string, unknown> | undefined;
  if (!base) return;
  const make = (leadId: string, quantity: number, status: AgentQuote["status"], daysAgo: number) => {
    const created = createQuote(leadId, dto.productTypeCode, { ...base, quantities: [quantity] }, undefined, daysAgo);
    if (created instanceof Response) return null;
    created.status = status;
    if (status === "opened") created.openedAt = bangkokAt(-daysAgo + 1, 20, 12);
    return created;
  };
  const manee = make(LEAD_IDS.manee, 1000, "opened", 3);
  const wira = make(LEAD_IDS.wira, 20000, "sent", 3);
  if (wira) {
    wira.dealRegistration = {
      id: nextId("deal"),
      status: "registered",
      scope: "quote",
      origin: "automatic",
      protectedUntil: bangkokAt(87, 11),
      lockedFirstRatePct: "5",
      lockedRepeatRatePct: "3",
      registeredAt: bangkokAt(-3, 11),
    };
  }
  if (manee) {
    // A round getpack has already answered, so the options can be walked (in P3 staff cannot offer yet — P4).
    const quote = findQuote(manee.quoteId)!;
    const net = Number(quote.netAmount);
    const option = (position: number, kind: Schemas["AgentDiscountOptionKind"], pct: number, rate: number) => {
      const after = Math.round(net * (100 - pct)) / 100;
      return {
        id: nextId("dopt"),
        position,
        kind,
        status: "offered" as const,
        discountPct: pct.toFixed(2),
        netAmount: after.toFixed(2),
        ratePct: rate.toFixed(2),
        standardRatePct: "5.00",
        commissionAmount: (Math.round(after * rate) / 100).toFixed(2),
        conditionsTh: `ราคานี้สำหรับ ${quote.quantity.toLocaleString("th-TH")} ใบ · มัดจำ 50% · ชำระภายใน 7 วัน · สั่งภายใน ${thaiDate(bangkokAt(6, 0))}`,
        conditionsEn: `For ${quote.quantity} pcs · 50% deposit · paid within 7 days · order by ${bangkokAt(6, 0).slice(0, 10)}`,
        validUntil: bangkokAt(6, 23, 59),
        acceptedAt: null,
      };
    };
    discountRequests.set(manee.id, [
      {
        id: nextId("dreq"),
        round: 1,
        status: "offered",
        quoteOptionId: optionIdOf(quote),
        quantity: quote.quantity,
        requestedPct: "8",
        reason: "competitor_price",
        reasonNote: "ร้านเดิมเสนอถูกกว่าประมาณ 8%",
        quantityChange: null,
        commitment: "call_off",
        commitmentMonths: 6,
        depositPct: "50",
        cashWithinDays: 7,
        leadTimeFlexDays: null,
        specChange: null,
        competitorFile: null,
        competitorSpec: {
          boardGrade: "อาร์ตการ์ด 300 แกรม",
          printColours: 4,
          printSides: 1,
          quantity: 1000,
          price: "11500.00",
          vatIncluded: false,
        },
        decisionNote: null,
        createdAt: bangkokAt(-1, 15),
        decidedAt: bangkokAt(-1, 17),
        options: [option(1, "standard", 4, 5), option(2, "co_fund", 7, 3.5), option(3, "spiff", 3, 6)],
      },
    ]);
  }
}

function createQuote(
  leadId: string,
  productTypeCode: string,
  configuration: Record<string, unknown>,
  deliveryPostcode: string | undefined,
  daysAgo = 0,
) {
  const raw = configuration as Record<string, unknown> & { quantities?: number[] };
  const product = productOfId(raw.catalogProductId as string | undefined);
  if (!product) return problem(404, "http.not_found", "ไม่พบสินค้านี้");
  const quantity = raw.quantities?.[0];
  if (!quantity)
    return problem(422, "validation.failed", "ระบุจำนวน", [
      { path: "configuration.quantities", code: "required", message: "ระบุจำนวน" },
    ]);
  const inputs = inputsOf(productTypeCode, { ...raw, quantities: [quantity] });
  if (inputs instanceof Response) return inputs;
  const quote = buildQuote(
    inputs,
    raw,
    { quantity, ...(deliveryPostcode ? { deliveryPostcode } : {}), designOption: "own_file", mockupOption: "none" },
    false,
  );
  if (quote instanceof Response) return quote;
  quotesOf(QUOTE_PERSONA).unshift(quote);
  const row = (leads.find((candidate) => candidate.id === leadId) ?? externalLeadOf(leadId))!;
  const token = Array.from(
    { length: 43 },
    (_, i) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[(i * 7 + seq) % 56],
  ).join("");
  seq += 1;
  const sentAt = daysAgo ? bangkokAt(-daysAgo, 11) : bangkokIso();
  const record = {
    id: nextId("aquo"),
    quoteId: quote.id,
    token,
    lead: { id: row.id, contactName: row.contactName, organisationName: row.organisationName },
    status: "sent" as AgentQuote["status"],
    shareUrl: null as string | null,
    sentAt,
    sendCount: 1,
    openedAt: null as string | null,
    acceptedAt: null as string | null,
    withdrawnAt: null as string | null,
    dealRegistration: null as AgentQuote["dealRegistration"],
  };
  agentQuotes.unshift(record);
  return record;
}

/** The storefront host the share link opens on (the mock server is told nothing; local e2e uses port 3100). */
const storefrontOrigin = (request: Request) => {
  const host = request.headers.get("x-forwarded-host") ?? "";
  const port = host.split(":")[1] ?? "3100";
  return process.env["MOCK_STOREFRONT_ORIGIN"] ?? `http://localhost:${port}`;
};

function toAgentQuote(record: (typeof agentQuotes)[number], request: Request): AgentQuote {
  const quote = findQuote(record.quoteId);
  const saved = quote ? toSavedQuote(quote) : null;
  const expired = saved?.status === "expired";
  const status =
    record.status === "withdrawn" || record.status === "accepted" ? record.status : expired ? "expired" : record.status;
  const { quoteId: _q, token, ...rest } = record;
  void _q;
  return {
    ...rest,
    status,
    shareUrl: status === "sent" || status === "opened" ? `${storefrontOrigin(request)}/q/${token}` : null,
    quote: { ...saved!, quoteCode: saved?.quoteCode ?? quote?.quoteCode ?? null },
  };
}

const findAgentQuote = (id: unknown) =>
  agentQuotes.find((row) => row.id === id && leads.some((candidate) => candidate.id === row.lead.id));

/* -------------------------------------------------------------------------------------- playbook */

const card = (
  key: string,
  contexts: string[],
  titleTh: string,
  bodyTh: string,
  replies: string[] = [],
): Schemas["AgentPlaybookCardDto"] => ({
  id: mockId("play", key.length * 31 + key.charCodeAt(0)),
  key,
  version: 1,
  contexts,
  titleTh,
  titleEn: null,
  bodyTh,
  bodyEn: null,
  suggestedReplies: replies.map((th) => ({ th, en: null })),
});

/** The nine agent cards of `PLAYBOOK.md` (owner-approved seed), shortened for the mock. */
const PLAYBOOK: Schemas["AgentPlaybookCardDto"][] = [
  card(
    "pricing-principle",
    ["all"],
    "ราคาเดียวกันสำหรับทุกคน ส่วนลดต้องแลกด้วยเงื่อนไข",
    'ราคาบนเว็บ getpack เป็นราคาที่ลูกค้าทุกรายเห็นเท่ากัน ถ้าลูกค้าต้องการราคาที่ถูกกว่านี้ ให้ถามก่อนว่า "ถ้าเราปรับราคาให้ คุณลูกค้าสะดวกปรับเงื่อนไขไหนได้บ้าง"\n\nค่าคอมของคุณคิดจากราคาขายจริง การรักษาราคาไว้จึงเป็นประโยชน์กับคุณโดยตรง',
  ),
  card(
    "give-get-menu",
    ["discount_request", "competitor_cheaper"],
    "เมนูแลกเปลี่ยน: ให้ส่วนลด เมื่อได้อะไรกลับมา",
    "| ลูกค้าให้ | เหตุผลที่เราให้ราคาดีขึ้นได้ |\n|---|---|\n| เพิ่มจำนวนต่อครั้ง | ราคาต่อชิ้นลดลงจริง |\n| ทำสัญญาเรียกของเป็นงวด 6–12 เดือน | วางแผนผลิตได้ ล็อกราคาทั้งปีให้ลูกค้า |\n| จ่ายมัดจำมากขึ้น หรือจ่ายเงินสดภายใน 7 วัน | ไม่ต้องรอเครดิต |\n| รับ lead time ยาวขึ้น | จัดคิวผลิตได้ยืดหยุ่น |\n| ปรับสเปก | วัสดุถูกลง |\n\nสิ่งที่ให้แทนการลดราคาได้: ทำ sample ฟรี, บริการออกแบบ, ส่งด่วนขึ้น, ล็อกราคาทั้งปี",
    [
      "เราปรับราคาให้ได้ค่ะ/ครับ ถ้าสั่งเป็นสัญญา 6 เดือน ราคาจะล็อกทั้ง 6 เดือนด้วย ไม่ต้องกังวลเรื่องกระดาษขึ้นราคา",
      "ถ้าสะดวกชำระภายใน 7 วัน เรามีส่วนลดเงินสดให้ค่ะ/ครับ",
    ],
  ),
  card(
    "like-for-like",
    ["competitor_cheaper"],
    "เทียบสเปกให้ตรงกันก่อนคุยเรื่องราคา",
    "ราคาที่ถูกกว่ามักมาจากสเปกที่ต่ำกว่า ขอใบเสนอราคาของเจ้าอื่นแล้วเทียบทีละข้อ: เกรดกระดาษ · ลอน · จำนวนสีและด้านที่พิมพ์ · การเคลือบ · จำนวน · lead time · รวมค่าส่งไหม · รวม VAT ไหม",
    ["ขอดูใบเสนอราคานั้นได้ไหมคะ/ครับ จะได้เทียบให้ตรงสเปกกัน บางครั้งราคาต่างกันเพราะกระดาษหรือการพิมพ์ไม่เหมือนกัน"],
  ),
  card(
    "one-round",
    ["discount_request"],
    "เจรจาได้รอบเดียวต่อใบเสนอราคา",
    "ระบบรับคำขอส่วนลดได้ 1 รอบต่อใบเสนอราคา ถ้าลูกค้ากลับมาขอเพิ่มเพราะเจ้าอื่นลดอีก เราไม่ลดตาม นอกจากเงื่อนไขจะเปลี่ยนจริง",
    [
      "ราคานี้เป็นราคาที่ดีที่สุดของเราสำหรับเงื่อนไขนี้แล้วค่ะ/ครับ ถ้าอยากได้ราคาดีขึ้นอีก เราปรับได้ถ้าเพิ่มจำนวนหรือทำเป็นสัญญารายงวด",
    ],
  ),
  card(
    "short-validity",
    ["discount_request"],
    "ราคาพิเศษมีอายุ 7 วัน",
    "ใบเสนอราคาที่มีส่วนลดมีอายุ 7 วันและระบุเงื่อนไขชัดเจน บอกลูกค้าตั้งแต่ต้น เพื่อให้ตัดสินใจ",
    ["ราคาพิเศษนี้ยืนถึงวันที่ … นะคะ/ครับ หลังจากนั้นระบบจะคำนวณราคาใหม่"],
  ),
  card(
    "big-deal",
    ["big_deal"],
    "ดีลใหญ่: จองดีลและล็อกอัตราค่าคอม",
    "ใบเสนอราคาที่ถึงเกณฑ์ดีลใหญ่จะถูกจองให้อัตโนมัติ คุ้มครอง 90 วัน และล็อกอัตราค่าคอมไว้ ไม่มีใครลดอัตราของคุณได้\n\nสิ่งที่ควรทำ: นัดคุยกับผู้ตัดสินใจตัวจริง, ถามแผนการใช้ทั้งปี, ขอ sample ก่อนเสนอราคาสุดท้าย",
  ),
  card(
    "follow-up",
    ["follow_up"],
    "จังหวะการติดตาม",
    "วันที่ 1: ส่งใบเสนอราคาพร้อมสรุปสเปก 3 บรรทัด · วันที่ 3: ถามว่ามีคำถามเรื่องสเปกหรือไฟล์ไหม · วันที่ 6: แจ้งว่าราคาพิเศษใกล้หมดอายุ · หลังหมดอายุ: ถามแผนรอบหน้า แล้วตั้งวันติดตามใหม่",
    ["สวัสดีค่ะ/ครับ ใบเสนอราคากล่องที่ส่งไป มีส่วนไหนอยากให้ปรับสเปกหรือดูตัวอย่างไหมคะ/ครับ"],
  ),
  card(
    "first-contact",
    ["first_contact"],
    "คุยครั้งแรก: ถาม 5 ข้อนี้",
    "1. ใช้บรรจุภัณฑ์กับสินค้าอะไร ส่งทางไหน\n2. ใช้ต่อเดือนหรือต่อปีประมาณเท่าไร\n3. ตอนนี้ซื้อจากที่ไหน ชอบหรือไม่ชอบอะไร\n4. ใครเป็นคนตัดสินใจ และต้องการภายในเมื่อไร\n5. มีไฟล์งานหรือแบบเดิมไหม",
  ),
  card(
    "lead-lost-price",
    ["lead_lost_price"],
    "แพ้เพราะราคา: เก็บข้อมูลให้ครบ",
    "บันทึก: ราคาของเจ้าที่ชนะ (ถ้ารู้), สเปกที่ต่างกัน, จำนวน และเหตุผลที่ลูกค้าให้ แล้วตั้งวันติดตามอีก 60–90 วัน",
  ),
];

/* -------------------------------------------------------------------------------------- forecast */

function forecast(): Schemas["AgentCommissionForecastDto"] {
  const today = bangkokIso().slice(0, 10);
  const firstOfNext = (() => {
    const [y, m] = today.split("-").map(Number) as [number, number];
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  })();
  const plus = (date: string, days: number) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const items: Schemas["AgentForecastItemDto"][] = [
    {
      orderCode: "OR-2611-00071",
      status: "in_progress",
      isFirstOrder: true,
      expectedBase: "42000.00",
      ratePct: "5",
      expectedCommission: "2100.00",
      earnableOn: null,
      statementOn: null,
      expectedPayableOn: null,
      waitingFor: "completion",
    },
    {
      orderCode: "OR-2610-00058",
      status: "pending",
      isFirstOrder: false,
      expectedBase: "15500.00",
      ratePct: "3",
      expectedCommission: "465.00",
      earnableOn: plus(today, 4),
      statementOn: firstOfNext,
      expectedPayableOn: plus(firstOfNext, 15),
      waitingFor: "claim_window",
    },
    {
      orderCode: "OR-2610-00044",
      status: "pending",
      isFirstOrder: true,
      expectedBase: "12000.00",
      ratePct: "5",
      expectedCommission: "600.00",
      earnableOn: null,
      statementOn: null,
      expectedPayableOn: null,
      waitingFor: "payment",
    },
    {
      orderCode: "OR-2610-00031",
      status: "earned",
      isFirstOrder: true,
      expectedBase: "16610.00",
      ratePct: "5",
      expectedCommission: "830.50",
      earnableOn: plus(today, -6),
      statementOn: firstOfNext,
      expectedPayableOn: plus(firstOfNext, 15),
      waitingFor: "statement",
    },
    {
      orderCode: "OR-2609-00012",
      status: "paid",
      isFirstOrder: true,
      expectedBase: "84000.00",
      ratePct: "5",
      expectedCommission: "4200.00",
      earnableOn: plus(today, -40),
      statementOn: plus(today, -33),
      expectedPayableOn: plus(today, -20),
      waitingFor: null,
    },
  ];
  return { asOf: bangkokIso(), paymentTermsDays: 15, payoutProfileReady: false, totalExpected: "3995.50", items };
}

/* -------------------------------------------------------------------------------------- import */

const IMPORT_HEADERS = [
  "contact_name",
  "organisation_name",
  "phone",
  "email",
  "tax_id",
  "line_id",
  "industry",
  "tags",
  "expected_value",
  "next_follow_up_at",
  "note",
];
const THAI_ALIASES: Record<string, string> = {
  ชื่อผู้ติดต่อ: "contact_name",
  ชื่อร้านหรือบริษัท: "organisation_name",
  เบอร์โทร: "phone",
  อีเมล: "email",
  เลขผู้เสียภาษี: "tax_id",
  ไลน์: "line_id",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const clean = text.replace(/^﻿/, "");
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]!;
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function previewImport(csv: string): (Schemas["AgentLeadImportDto"] & { pending: Lead[] }) | Response {
  const rows = parseCsv(csv);
  if (rows.length === 0)
    return problem(422, "validation.failed", "ไฟล์ว่าง", [{ path: "csv", code: "empty", message: "empty" }]);
  const header = rows[0]!.map((name) => THAI_ALIASES[name.trim()] ?? name.trim().toLowerCase());
  if (!header.includes("contact_name"))
    return problem(422, "validation.failed", "ไม่พบหัวคอลัมน์ contact_name", [
      { path: "csv", code: "header", message: "header" },
    ]);
  if (rows.length - 1 > 500)
    return problem(422, "validation.failed", "เกิน 500 แถว", [
      { path: "csv", code: "too_many_rows", message: "too_many_rows" },
    ]);
  const pending: Lead[] = [];
  const seen = new Set<string>();
  const out = rows.slice(1).map((cells, index) => {
    const value = (key: string) => {
      const at = header.indexOf(key);
      return at === -1 ? "" : (cells[at] ?? "").trim();
    };
    const errors: Schemas["AgentLeadImportErrorDto"][] = [];
    const contactName = value("contact_name");
    const phoneRaw = digits(value("phone"));
    const email = value("email");
    const taxId = value("tax_id");
    if (!contactName) errors.push({ field: "contact_name", code: "required" });
    if (phoneRaw && !/^0\d{8,9}$/.test(phoneRaw)) errors.push({ field: "phone", code: "invalid_phone" });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push({ field: "email", code: "invalid_email" });
    if (taxId && !/^\d{13}$/.test(taxId)) errors.push({ field: "tax_id", code: "invalid_tax_id" });
    if (!phoneRaw && !email && !taxId) errors.push({ field: "phone", code: "contact_missing" });
    const amount = value("expected_value");
    if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) errors.push({ field: "expected_value", code: "invalid_amount" });
    const key = phoneRaw || email.toLowerCase() || taxId;
    if (key && seen.has(key)) errors.push({ field: "phone", code: "duplicate_in_file" });
    if (key) seen.add(key);
    if (errors.length === 0) {
      const check = availability({ phone: phoneRaw || null, email: email || null, taxId: taxId || null });
      if (!check.available)
        errors.push({ field: phoneRaw ? "phone" : email ? "email" : "tax_id", code: check.reason! });
    }
    const phone = phoneRaw && /^0\d{8,9}$/.test(phoneRaw) ? `+66${phoneRaw.slice(1)}` : null;
    if (errors.length === 0) {
      pending.push(
        lead({
          id: nextId("lead"),
          contactName,
          organisationName: value("organisation_name") || null,
          phone,
          email: email || null,
          taxId: taxId || null,
          lineId: value("line_id") || null,
          industry: value("industry") || null,
          tags: value("tags")
            ? value("tags")
                .split("|")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [],
          expectedValue: amount ? Number(amount).toFixed(2) : null,
          note: value("note") || null,
          source: "csv_import",
          createdAt: bangkokIso(),
          protectedUntil: bangkokAt(LEAD_PROTECTION_DAYS, 10),
        }),
      );
    }
    return {
      rowNo: index + 2,
      contactName: contactName || null,
      organisationName: value("organisation_name") || null,
      phone,
      email: email || null,
      taxId: taxId || null,
      errors,
      leadId: null,
    };
  });
  return {
    id: nextId("imp"),
    status: "previewed",
    rowCount: out.length,
    validCount: out.filter((row) => row.errors.length === 0).length,
    createdCount: null,
    rows: out,
    expiresAt: bangkokIso(DAY_MIN),
    pending,
  };
}

const publicImport = (record: Schemas["AgentLeadImportDto"] & { pending: Lead[] }): Schemas["AgentLeadImportDto"] => {
  const { pending: _pending, ...rest } = record;
  void _pending;
  return rest;
};

/* -------------------------------------------------------------------------------------- handlers */

const idempotency = new Map<string, unknown>();

export const storeAgentLeadHandlers = [
  // The customer opens an agent's quote on the storefront (`/q/{token}`): the code comes back, the first open is kept.
  http.get("*/v1/store/quotes/shared/:token", ({ params }) => {
    const record = agentQuotes.find((row) => row.token === params.token);
    if (!record || record.status === "withdrawn") return undefined;
    const quote = findQuote(record.quoteId);
    if (!quote) return undefined;
    if (record.status === "sent") {
      record.status = "opened";
      record.openedAt = bangkokIso();
      addActivity(
        record.lead.id,
        activity(record.lead.id, {
          kind: "system",
          author: "system",
          event: "quote_opened",
          agentQuoteId: record.id,
          occurredAt: bangkokIso(),
        }),
      );
    }
    return HttpResponse.json({
      ...toSavedQuote(quote),
      agentCode: MOCK_AGENT_CODE,
    } satisfies Schemas["SharedQuoteDto"]);
  }),

  // A customer claims the agent's code after signing in (D-417): a lead with the same phone or e-mail converts.
  http.post("*/v1/store/agent/claims", async ({ request }) => {
    const customer = customerOf(request);
    const body = (await request
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null;
    if (!customer || body?.code !== MOCK_AGENT_CODE) return undefined;
    const match = leads.find(
      (row) =>
        row.status === "registered" &&
        (samePhone(row.phone, customer.phone) || (customer.email && row.email === customer.email)),
    );
    if (match) {
      match.status = "converted";
      match.convertedAt = bangkokIso();
      touch(match);
      addActivity(
        match.id,
        activity(match.id, {
          kind: "system",
          author: "system",
          event: "converted",
          occurredAt: bangkokIso(),
        }),
      );
      for (const record of agentQuotes.filter((row) => row.lead.id === match.id && row.status === "opened")) {
        record.status = "accepted";
        record.acceptedAt = bangkokIso();
      }
    }
    return HttpResponse.json({ linked: true, reason: null });
  }),

  http.post("*/v1/store/agent/leads/actions/check", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    const body = (await request.json()) as Schemas["CheckAgentLeadDto"];
    return HttpResponse.json(availability(body) satisfies Schemas["AgentLeadAvailabilityDto"]);
  }),

  http.post("*/v1/store/agent/leads/actions/scan-card", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    const body = (await request.json()) as Schemas["ScanAgentCardDto"];
    // The fake OCR: always the same obviously fake card, one field read with low confidence.
    return HttpResponse.json({
      fileId: body.fileId,
      engine: "fake",
      contactName: { value: "คุณสุดา ทดลองสแกน", confidence: 0.93 },
      organisationName: { value: "บริษัท ตัวอย่างนามบัตร จำกัด", confidence: 0.88 },
      phone: { value: "+66819990123", confidence: 0.97 },
      email: { value: "suda@example.invalid", confidence: 0.58 },
      taxId: null,
      lineId: { value: "suda.sample", confidence: 0.72 },
      website: { value: "example.invalid", confidence: 0.9 },
      otherPhones: [{ value: "+6621234567", confidence: 0.81 }],
      lines: [
        { text: "คุณสุดา ทดลองสแกน", confidence: 93 },
        { text: "บริษัท ตัวอย่างนามบัตร จำกัด", confidence: 88 },
        { text: "081-999-0123", confidence: 97 },
        { text: "suda@exarnple.invalid", confidence: 58 },
      ],
      deleteAfter: bangkokIso(7 * DAY_MIN),
    } satisfies Schemas["ScannedCardDto"]);
  }),

  http.get("*/v1/store/agent/leads/pipeline", ({ request }) => {
    if (!isAgent(request)) return undefined;
    const url = new URL(request.url);
    const all = sortLeads(filterLeads(url), url.searchParams.get("sort"), url.searchParams.get("order"));
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);
    const start = Number(url.searchParams.get("cursor") ?? 0) || 0;
    const page = all.slice(start, start + limit);
    return HttpResponse.json({
      data: page,
      meta: { nextCursor: start + limit < all.length ? String(start + limit) : null },
    });
  }),

  http.get("*/v1/store/agent/leads/export", ({ request }) => {
    if (!isAgent(request)) return undefined;
    const cols = [
      "contact_name",
      "organisation_name",
      "phone",
      "email",
      "tax_id",
      "line_id",
      "industry",
      "tags",
      "stage",
      "source",
      "expected_value",
      "next_follow_up_at",
      "status",
      "protected_until",
      "created_at",
    ];
    const safe = (value: string | null | undefined) => {
      const text = value ?? "";
      const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
    };
    const body = [
      cols.join(","),
      ...leads.map((row) =>
        [
          row.contactName,
          row.organisationName,
          row.phone ? `0${digits(row.phone).slice(2)}` : "",
          row.email,
          row.taxId,
          row.lineId,
          row.industry,
          row.tags.join("|"),
          row.stage,
          row.source,
          row.expectedValue,
          row.nextFollowUpAt,
          row.status,
          row.protectedUntil,
          row.createdAt,
        ]
          .map(safe)
          .join(","),
      ),
    ].join("\n");
    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${body}`)}`;
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),

  http.post("*/v1/store/agent/leads/imports", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    const body = (await request.json()) as Schemas["PreviewAgentLeadImportDto"];
    if (!body.consentConfirmed)
      return problem(422, "validation.failed", "ต้องยืนยันความยินยอม", [
        { path: "consentConfirmed", code: "required", message: "required" },
      ]);
    const result = previewImport(body.csv ?? "");
    if (result instanceof Response) return result;
    imports.set(result.id, result);
    return HttpResponse.json(publicImport(result), { status: 201 });
  }),

  http.post("*/v1/store/agent/leads/imports/:importId/actions/commit", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    const key = request.headers.get("idempotency-key");
    if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key");
    if (idempotency.has(key)) return HttpResponse.json(idempotency.get(key) as object);
    const record = imports.get(String(params.importId));
    if (!record) return notMine();
    if (record.status !== "previewed") return problem(409, "agents.lead_import_closed", "รายการนำเข้านี้ปิดไปแล้ว");
    record.status = "committed";
    record.createdCount = record.pending.length;
    const ids = record.pending.map((row) => row.id);
    leads.unshift(...record.pending);
    let at = 0;
    record.rows = record.rows.map((row) => ({
      rowNo: row.rowNo,
      errors: row.errors,
      leadId: row.errors.length === 0 ? (ids[at++] ?? null) : null,
      contactName: null,
      organisationName: null,
      phone: null,
      email: null,
      taxId: null,
    }));
    record.pending = [];
    const out = publicImport(record);
    idempotency.set(key, out);
    return HttpResponse.json(out);
  }),

  // Registering a lead: the pipeline fields, the neutral refusal and the own-lead duplicate (D-468 §1).
  http.post("*/v1/store/agent/leads", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    const body = (await request.json()) as Schemas["RegisterAgentLeadDto"];
    const check = availability(body);
    if (check.reason === "own_lead") return problem(409, "agents.lead_duplicate", "ลงทะเบียนซ้ำ");
    if (check.reason === "unavailable")
      return problem(409, "agents.lead_unavailable", "ลงทะเบียนผู้มุ่งหวังรายนี้ไม่ได้");
    const row = lead({
      id: nextId("lead"),
      contactName: body.contactName,
      organisationName: body.organisationName ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      taxId: body.taxId ?? null,
      note: body.note ?? null,
      source: body.source,
      expectedValue: body.expectedValue ?? null,
      nextFollowUpAt: body.nextFollowUpAt ?? null,
      industry: body.industry ?? null,
      lineId: body.lineId ?? null,
      tags: body.tags ?? [],
    });
    leads.unshift(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.get("*/v1/store/agent/leads/:leadId/activities", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    if (!findLead(params.leadId)) return notMine();
    const list = activities.get(String(params.leadId)) ?? [];
    return HttpResponse.json({ data: list, meta: { nextCursor: null } });
  }),

  http.post("*/v1/store/agent/leads/:leadId/activities", async ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    const row = findLead(params.leadId);
    if (!row) return notMine();
    const body = (await request.json()) as Schemas["AddAgentLeadActivityDto"];
    if (!body.body?.trim())
      return problem(422, "validation.failed", "เขียนสิ่งที่คุยกัน", [
        { path: "body", code: "required", message: "required" },
      ]);
    const entry = activity(row.id, {
      kind: body.kind,
      body: body.body.trim(),
      occurredAt: body.occurredAt ?? bangkokIso(),
    });
    addActivity(row.id, entry);
    if (body.nextFollowUpAt !== undefined) row.nextFollowUpAt = body.nextFollowUpAt;
    if (row.stage === "new") moveForward(row, "contacted", null);
    touch(row);
    return HttpResponse.json(entry, { status: 201 });
  }),

  http.post("*/v1/store/agent/leads/:leadId/actions/change-stage", async ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    const row = findLead(params.leadId);
    if (!row) return notMine();
    const body = (await request.json()) as Schemas["ChangeAgentLeadStageDto"];
    if (row.stage === "won" || row.stage === "lost")
      return problem(409, "agents.lead_stage_final", "ลูกค้ามุ่งหวังรายนี้ปิดแล้ว");
    if (body.stage === "lost" && !body.lostReason)
      return problem(422, "validation.failed", "เลือกเหตุผล", [
        { path: "lostReason", code: "required", message: "required" },
      ]);
    addActivity(
      row.id,
      activity(row.id, {
        kind: "stage_change",
        fromStage: row.stage,
        toStage: body.stage,
        event: body.stage === "lost" ? "lost" : null,
        body: body.note ?? null,
        occurredAt: bangkokIso(),
      }),
    );
    row.stage = body.stage;
    row.stageChangedAt = bangkokIso();
    if (body.stage === "lost") {
      row.lostReason = body.lostReason ?? null;
      row.lostNote = body.note ?? null;
      if (row.status === "registered") {
        row.status = "withdrawn";
        row.closedReason = "lost";
        row.protectedUntil = bangkokIso();
      }
    }
    touch(row);
    return HttpResponse.json(row);
  }),

  http.get("*/v1/store/agent/leads/:leadId", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    const row = findLead(params.leadId);
    if (!row) return notMine();
    return HttpResponse.json(row, { headers: { ETag: etagOf(row.id) } });
  }),

  http.patch("*/v1/store/agent/leads/:leadId", async ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    const row = findLead(params.leadId);
    if (!row) return notMine();
    const match = request.headers.get("if-match");
    if (!match) return problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
    if (match !== etagOf(row.id)) return problem(412, "concurrency.stale", "ข้อมูลนี้ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
    const body = (await request.json()) as Schemas["UpdateAgentLeadDto"];
    if (body.phone !== undefined || body.email !== undefined || body.taxId !== undefined) {
      const check = availability(
        { phone: body.phone ?? null, email: body.email ?? null, taxId: body.taxId ?? null },
        row.id,
      );
      if (check.reason === "own_lead") return problem(409, "agents.lead_duplicate", "ลงทะเบียนซ้ำ");
      if (check.reason === "unavailable")
        return problem(409, "agents.lead_unavailable", "ลงทะเบียนผู้มุ่งหวังรายนี้ไม่ได้");
    }
    Object.assign(row, body);
    touch(row);
    return HttpResponse.json(row, { headers: { ETag: etagOf(row.id) } });
  }),

  /* quotes on behalf */
  http.get("*/v1/store/agent/quotes", ({ request }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId");
    const status = url.searchParams.get("status");
    // Quotes a staff rep made (P4, employee agents' leads) never reach the freelance agent's zone.
    const all = agentQuotes
      .filter((row) => leads.some((candidate) => candidate.id === row.lead.id))
      .map((row) => toAgentQuote(row, request))
      .filter((row) => (!leadId || row.lead.id === leadId) && (!status || row.status === status));
    const page = Number(url.searchParams.get("page") ?? 1) || 1;
    const perPage = Math.min(Number(url.searchParams.get("perPage") ?? 25) || 25, 100);
    return HttpResponse.json({
      data: all.slice((page - 1) * perPage, page * perPage),
      meta: { page, perPage, total: all.length },
    });
  }),

  http.post("*/v1/store/agent/quotes", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const body = (await request.json()) as Schemas["CreateAgentQuoteDto"];
    const row = findLead(body.leadId);
    if (!row) return notMine();
    if (row.stage === "won" || row.stage === "lost" || (row.status !== "registered" && row.status !== "converted"))
      return problem(409, "agents.lead_closed", "ลูกค้ามุ่งหวังรายนี้ปิดแล้ว");
    const created = createQuote(
      row.id,
      body.productTypeCode,
      body.configuration as Record<string, unknown>,
      body.deliveryPostcode,
    );
    if (created instanceof Response) return created;
    addActivity(row.id, activity(row.id, { kind: "quote_sent", agentQuoteId: created.id, occurredAt: bangkokIso() }));
    moveForward(row, "quoted", null);
    // Automatic registration at the threshold (D-468 §4: largest base ≥ 500,000.00).
    const quote = findQuote(created.quoteId)!;
    if (Number(quote.netAmount) >= 500000) {
      created.dealRegistration = {
        id: nextId("deal"),
        status: "registered",
        scope: "quote",
        origin: "automatic",
        protectedUntil: bangkokAt(90, 23, 59),
        lockedFirstRatePct: "5",
        lockedRepeatRatePct: "3",
        registeredAt: bangkokIso(),
      };
    }
    return HttpResponse.json(toAgentQuote(created, request), { status: 201 });
  }),

  http.post("*/v1/store/agent/quotes/:agentQuoteId/actions/resend", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const record = findAgentQuote(params.agentQuoteId);
    if (!record) return notMine();
    if (record.status === "withdrawn" || record.status === "accepted")
      return problem(409, "agents.quote_closed", "ใบเสนอราคานี้ปิดแล้ว");
    record.token = `${record.token.slice(1)}${record.token[0]}`;
    record.sendCount += 1;
    record.sentAt = bangkokIso();
    return HttpResponse.json(toAgentQuote(record, request));
  }),

  http.post("*/v1/store/agent/quotes/:agentQuoteId/actions/withdraw", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const record = findAgentQuote(params.agentQuoteId);
    if (!record) return notMine();
    if (record.status === "withdrawn") return problem(409, "agents.quote_closed", "ใบเสนอราคานี้ปิดแล้ว");
    record.status = "withdrawn";
    record.withdrawnAt = bangkokIso();
    addActivity(
      record.lead.id,
      activity(record.lead.id, {
        kind: "system",
        event: "quote_withdrawn",
        agentQuoteId: record.id,
        occurredAt: bangkokIso(),
      }),
    );
    return HttpResponse.json(toAgentQuote(record, request));
  }),

  http.post("*/v1/store/agent/quotes/:agentQuoteId/actions/register-deal", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const record = findAgentQuote(params.agentQuoteId);
    if (!record) return notMine();
    if (record.status === "withdrawn") return problem(409, "agents.quote_closed", "ใบเสนอราคานี้ปิดแล้ว");
    if (!record.dealRegistration) {
      record.dealRegistration = {
        id: nextId("deal"),
        status: "registered",
        scope: "quote",
        origin: "requested",
        protectedUntil: bangkokAt(90, 23, 59),
        lockedFirstRatePct: "5",
        lockedRepeatRatePct: "3",
        registeredAt: bangkokIso(),
      };
      const row = findLead(record.lead.id);
      if (row && Date.parse(row.protectedUntil) < Date.parse(record.dealRegistration.protectedUntil)) {
        row.protectedUntil = record.dealRegistration.protectedUntil;
        touch(row);
      }
      addActivity(
        record.lead.id,
        activity(record.lead.id, {
          kind: "system",
          author: "system",
          event: "deal_registered",
          agentQuoteId: record.id,
          occurredAt: bangkokIso(),
        }),
      );
    }
    return HttpResponse.json(toAgentQuote(record, request));
  }),

  http.get("*/v1/store/agent/quotes/:agentQuoteId/discount-requests", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const record = findAgentQuote(params.agentQuoteId);
    if (!record) return notMine();
    return HttpResponse.json(discountRequests.get(record.id) ?? []);
  }),

  http.post("*/v1/store/agent/quotes/:agentQuoteId/discount-requests", async ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const record = findAgentQuote(params.agentQuoteId);
    if (!record) return notMine();
    if (record.status === "withdrawn" || record.status === "accepted")
      return problem(409, "agents.quote_closed", "ใบเสนอราคานี้ปิดแล้ว");
    const body = (await request.json()) as Schemas["RequestAgentDiscountDto"];
    const rounds = discountRequests.get(record.id) ?? [];
    if (rounds.some((round) => round.status === "open"))
      return problem(409, "quotes.discount_request_open", "มีคำขอที่รออยู่");
    const giveGet = [
      body.quantityChange,
      body.commitment === "call_off" ? body.commitmentMonths : null,
      body.depositPct,
      body.cashWithinDays,
      body.leadTimeFlexDays,
      body.specChange,
    ];
    if (!giveGet.some((value) => value !== undefined && value !== null && value !== ""))
      return problem(422, "validation.failed", "เลือกสิ่งที่ลูกค้าให้กลับมาอย่างน้อยหนึ่งอย่าง", [
        { path: "quantityChange", code: "give_get_required", message: "give_get_required" },
      ]);
    const last = rounds.at(-1);
    const hash = (r: Partial<DiscountRequest>) =>
      JSON.stringify([
        r.quantityChange ?? null,
        r.commitment ?? "one_off",
        r.commitmentMonths ?? null,
        r.depositPct ?? null,
        r.cashWithinDays ?? null,
        r.leadTimeFlexDays ?? null,
        r.specChange ?? null,
      ]);
    if (last && hash(last) === hash(body as Partial<DiscountRequest>))
      return problem(409, "quotes.discount_round_limit", "ขอรอบใหม่ได้เมื่อเงื่อนไขเปลี่ยน");
    const quote = findQuote(record.quoteId)!;
    const created: DiscountRequest = {
      id: nextId("dreq"),
      round: rounds.length + 1,
      status: "open",
      quoteOptionId: body.quoteOptionId ?? optionIdOf(quote),
      quantity: quote.quantity,
      requestedPct: body.requestedPct,
      reason: body.reason,
      reasonNote: body.reasonNote ?? null,
      quantityChange: body.quantityChange ?? null,
      commitment: body.commitment ?? "one_off",
      commitmentMonths: body.commitmentMonths ?? null,
      depositPct: body.depositPct ?? null,
      cashWithinDays: body.cashWithinDays ?? null,
      leadTimeFlexDays: body.leadTimeFlexDays ?? null,
      specChange: body.specChange ?? null,
      competitorFile: body.competitorFileId ? { id: body.competitorFileId, fileName: "competitor-quote.pdf" } : null,
      competitorSpec: body.competitorSpec ?? null,
      decisionNote: null,
      createdAt: bangkokIso(),
      decidedAt: null,
      options: [],
    } as DiscountRequest;
    rounds.push(created);
    discountRequests.set(record.id, rounds);
    for (const listener of discountListeners) listener(record.id, created);
    const row = findLead(record.lead.id);
    if (row) moveForward(row, "negotiating", "discount_requested");
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(
    "*/v1/store/agent/quotes/:agentQuoteId/discount-options/:optionId/actions/accept",
    ({ request, params }) => {
      if (!isAgent(request)) return undefined;
      ensureSeeded();
      const key = request.headers.get("idempotency-key");
      if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key");
      if (idempotency.has(key)) return HttpResponse.json(idempotency.get(key) as object);
      const record = findAgentQuote(params.agentQuoteId);
      if (!record) return notMine();
      const round = (discountRequests.get(record.id) ?? []).find((r) =>
        r.options.some((o) => o.id === params.optionId),
      );
      const option = round?.options.find((o) => o.id === params.optionId);
      if (
        !round ||
        !option ||
        round.status !== "offered" ||
        option.status !== "offered" ||
        Date.parse(option.validUntil) < Date.now()
      )
        return problem(409, "agents.discount_option_unavailable", "ตัวเลือกนี้ใช้ไม่ได้แล้ว");
      round.status = "accepted";
      for (const other of round.options) other.status = other.id === option.id ? "accepted" : "lapsed";
      option.acceptedAt = bangkokIso();
      addActivity(
        record.lead.id,
        activity(record.lead.id, {
          kind: "system",
          author: "system",
          event: "discount_option_accepted",
          agentQuoteId: record.id,
          occurredAt: bangkokIso(),
        }),
      );
      idempotency.set(key, round);
      return HttpResponse.json(round);
    },
  ),

  http.get("*/v1/store/agent/quotes/:agentQuoteId", ({ request, params }) => {
    if (!isAgent(request)) return undefined;
    ensureSeeded();
    const record = findAgentQuote(params.agentQuoteId);
    return record ? HttpResponse.json(toAgentQuote(record, request)) : notMine();
  }),

  http.get("*/v1/store/agent/playbook", ({ request }) => {
    if (!isAgent(request)) return undefined;
    const context = new URL(request.url).searchParams.get("context");
    const data = context
      ? PLAYBOOK.filter((item) => item.contexts.includes(context) || item.contexts.includes("all"))
      : PLAYBOOK;
    return HttpResponse.json({ data } satisfies Schemas["AgentPlaybookDto"]);
  }),

  http.get("*/v1/store/agent/commissions/forecast", ({ request }) => {
    if (!isAgent(request)) return undefined;
    return HttpResponse.json(forecast());
  }),
];

/* ------------------------------------------------------------------ the sales desk (P4, mocks/admin/sales-desk.ts) */

let externalLeadOf: (leadId: string) => Pick<Lead, "id" | "contactName" | "organisationName"> | undefined = () =>
  undefined;
const discountListeners: ((agentQuoteId: string, round: DiscountRequest) => void)[] = [];

/** Lets the staff pipeline's leads (employee agents) own agent quotes made through `createQuote`. */
export function setExternalLeadResolver(resolve: typeof externalLeadOf): void {
  externalLeadOf = resolve;
}
/** P4: a discount request opens an approval on the desk (`sales_agent_discount.requested` subscriber). */
export function onDiscountRequested(listener: (agentQuoteId: string, round: DiscountRequest) => void): void {
  discountListeners.push(listener);
}
export const ensureAgentQuotesSeeded = () => ensureSeeded();
export const AGENT_LEAD_IDS = LEAD_IDS;
export const agentQuoteRecords = () => agentQuotes;
export const discountRoundsOf = (agentQuoteId: string): DiscountRequest[] => discountRequests.get(agentQuoteId) ?? [];
export function pushDiscountRound(agentQuoteId: string, round: DiscountRequest): void {
  discountRequests.set(agentQuoteId, [...discountRoundsOf(agentQuoteId), round]);
}
export const nextAgentMockId = nextId;
export const bangkokDayAt = bangkokAt;
export const thaiConditionsDate = (iso: string) => thaiDate(iso);
export function createAgentQuote(
  leadId: string,
  productTypeCode: string,
  configuration: Record<string, unknown>,
  deliveryPostcode?: string,
) {
  return createQuote(leadId, productTypeCode, configuration, deliveryPostcode);
}
/** The default instant spec the seeded quotes use (the first instant catalogue product with a default spec). */
export function defaultInstantSpec(): { productTypeCode: string; configuration: Record<string, unknown> } | null {
  const dto = catalogProducts()
    .map((row) => configuratorOf(row))
    .map((configurator) => (configurator ? toStoreConfiguratorDto(configurator) : null))
    .find((candidate) => candidate?.instant && candidate.defaultSpec);
  const base = dto?.defaultSpec?.configuration as Record<string, unknown> | undefined;
  return dto && base ? { productTypeCode: dto.productTypeCode, configuration: base } : null;
}
export const agentQuoteDto = (record: (typeof agentQuotes)[number], request: Request) => toAgentQuote(record, request);
export const quoteOptionIdOf = (record: (typeof agentQuotes)[number]) => optionIdOf(findQuote(record.quoteId)!);
export const savedQuoteOf = (record: (typeof agentQuotes)[number]) => findQuote(record.quoteId);
export function addAgentLeadActivity(
  leadId: string,
  partial: Partial<Activity> & Pick<Activity, "kind" | "occurredAt">,
) {
  addActivity(leadId, activity(leadId, partial));
}
export function moveAgentLeadForward(leadId: string, to: Stage, event: Schemas["AgentLeadSystemEvent"] | null) {
  const row = findLead(leadId);
  if (row) moveForward(row, to, event);
}

export type { StoreQuote };
export { IMPORT_HEADERS };

/** The API prints the conditions date as d/m/BE (e.g. 25/10/2569); the mock does the same. */
function thaiDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}/${m}/${y + 543}`;
}
