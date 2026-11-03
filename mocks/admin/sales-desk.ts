/**
 * The company sales desk (getpack-api P4, D-469 / D-470) on the published contract: the staff pipeline over employee
 * agents' leads (`admin.salesLeads.*`, `admin.salesQuotes.*`, `admin.salesReps.list`), the inbound pool with
 * assignment and first-response SLA (`admin.salesInbound.*`), the manager dashboard, the discount approval desk with
 * the waterfall in its three permission tiers, the simulator, decisions and the view log
 * (`admin.discountApprovals.*`), negotiation history, lost-to-price, the playbook admin with maker-checker and the
 * post-deal review.
 *
 * Stateful for the life of the mock server and obviously fake. The waterfall arithmetic below is the mock standing in
 * for getpack-api — the web never computes money. Field-level RBAC is the API's: each caller gets ONE serializer by
 * permission (`full` → `margin_pct` → `authority`), so a rep's payload has no cost or margin keys at all.
 *
 * Approving with options makes the agent-side discount round `offered` (the P3 mock's `discountRequests`), so the
 * freelance agent persona sees the options in the agent zone and can accept one.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import {
  addAgentLeadActivity,
  AGENT_LEAD_IDS,
  agentLeads,
  agentQuoteDto,
  agentQuoteRecords,
  bangkokDayAt,
  createAgentQuote,
  defaultInstantSpec,
  discountRoundsOf,
  ensureAgentQuotesSeeded,
  MOCK_AGENT_CODE,
  moveAgentLeadForward,
  onDiscountRequested,
  pushDiscountRound,
  quoteOptionIdOf,
  savedQuoteOf,
  setExternalLeadResolver,
  thaiConditionsDate,
} from "../store/agent-leads";
import { mockAgentLeadScore, mockLeadScore } from "../lead-score";
import { PLAYBOOK_SEED } from "./playbook-seed";

type Lead = Schemas["AdminAgentLeadDto"];
type Activity = Schemas["AgentLeadActivityDto"];
type Inbound = Schemas["SalesInboundDto"];
type Rep = Schemas["SalesRepDto"];
type AgentRef = Schemas["AgentRefDto"];
type Round = Schemas["AgentDiscountRequestDto"];
type Waterfall = Schemas["DiscountApprovalDto"]["waterfall"];
type Level = Schemas["SalesDiscountApprovalLevel"];
type Colour = Schemas["SalesAuthorityColour"];
type Card = Schemas["PlaybookCardAdminDto"];

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = (what: string) => problem(404, "http.not_found", `ไม่พบ${what}นี้`);
const invalid = (path: string, message: string, code = "invalid") =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code, message }]);

let seq = 900;
const nextId = (ns: string) => mockId(ns, (seq += 1));
const MINUTE = 60_000;

const personaRef = (key: string): Schemas["UserRefDto"] => {
  const persona = PERSONAS.find((candidate) => candidate.key === key)!;
  return { id: persona.id, displayName: persona.displayName };
};

const pipeline = (who: StaffPersona | undefined) =>
  who && (can(who, "sales.pipeline.manage") || can(who, "sales.pipeline.self")) ? who : null;
const isManager = (who: StaffPersona) => can(who, "sales.pipeline.manage");

/* ---------------------------------------------------------------------------------------- reps */

interface RepRecord {
  userId: string;
  displayName: string;
  agent: AgentRef | null;
  assignable: boolean;
  lastAssignedAt: number;
}

const FREELANCE_AGENT: AgentRef = {
  id: "00000000-0000-4000-8000-0000000a6001",
  code: MOCK_AGENT_CODE,
  legalName: "ตัวแทน ทดสอบ (ข้อมูลจำลอง)",
  kind: "freelance",
};

function seedReps(): RepRecord[] {
  const rep = personaRef("sales_rep");
  return [
    {
      userId: rep.id,
      displayName: rep.displayName,
      agent: {
        id: "00000000-0000-4000-8000-0000000b7001",
        code: "EMP00017",
        legalName: rep.displayName,
        kind: "employee",
      },
      assignable: true,
      lastAssignedAt: 3,
    },
    {
      userId: "00000000-0000-4000-8000-0000000b7102",
      displayName: "วิภา ขายดี (ข้อมูลจำลอง)",
      agent: {
        id: "00000000-0000-4000-8000-0000000b7002",
        code: "EMP00021",
        legalName: "วิภา ขายดี (ข้อมูลจำลอง)",
        kind: "employee",
      },
      assignable: true,
      lastAssignedAt: 1,
    },
    {
      userId: "00000000-0000-4000-8000-0000000b7103",
      displayName: "ธนา มุ่งมั่น (ข้อมูลจำลอง)",
      agent: {
        id: "00000000-0000-4000-8000-0000000b7003",
        code: "EMP00024",
        legalName: "ธนา มุ่งมั่น (ข้อมูลจำลอง)",
        kind: "employee",
      },
      assignable: true,
      lastAssignedAt: 2,
    },
    {
      userId: "00000000-0000-4000-8000-0000000b7104",
      displayName: "ปรีชา ลาพัก (ข้อมูลจำลอง)",
      agent: null,
      assignable: false,
      lastAssignedAt: 0,
    },
  ];
}

/* --------------------------------------------------------------------------------------- leads */

function staffLead(partial: Partial<Lead> & Pick<Lead, "id" | "contactName" | "agent">): Lead {
  const now = bangkokIso();
  return {
    kind: "customer",
    status: "registered",
    organisationName: null,
    phone: null,
    email: null,
    taxId: null,
    note: null,
    protectedUntil: bangkokDayAt(60, 10),
    convertedAt: null,
    closedReason: null,
    createdAt: now,
    stage: "new",
    stageChangedAt: null,
    expectedValue: null,
    nextFollowUpAt: null,
    lostReason: null,
    lostNote: null,
    source: "staff",
    industry: null,
    lineId: null,
    tags: [],
    wonAt: null,
    updatedAt: now,
    convertedCustomerId: null,
    convertedCompanyId: null,
    convertedFactoryId: null,
    score: null,
    scoreReasons: [],
    scoredAt: null,
    ...partial,
  };
}

/** D-471: a lead as the API answers it — scored from its own fields, with the top reasons (staff only). */
function scoredLead(lead: Lead): Lead {
  const { score, reasons } = mockAgentLeadScore(lead);
  return { ...lead, score, scoreReasons: reasons, scoredAt: lead.updatedAt };
}

const LEAD = {
  kitti: "00000000-0000-4000-8000-0000000b8001",
  suda: "00000000-0000-4000-8000-0000000b8002",
  anan: "00000000-0000-4000-8000-0000000b8003",
  porn: "00000000-0000-4000-8000-0000000b8004",
  chai: "00000000-0000-4000-8000-0000000b8005",
  lamai: "00000000-0000-4000-8000-0000000b8006",
  boon: "00000000-0000-4000-8000-0000000b8007",
} as const;

function seedLeads(reps: RepRecord[]): Lead[] {
  const [me, wipa, thana] = reps.map((rep) => rep.agent!);
  return [
    staffLead({
      id: LEAD.kitti,
      agent: me!,
      contactName: "คุณกิตติ ทดสอบ",
      organisationName: "บริษัท ขนมไทยตัวอย่าง จำกัด (ข้อมูลจำลอง)",
      phone: "+66820001111",
      email: "kitti@example.invalid",
      stage: "negotiating",
      stageChangedAt: bangkokDayAt(-1, 14),
      expectedValue: "180000.00",
      nextFollowUpAt: bangkokDayAt(0, 15),
      industry: "ขนมและของฝาก",
      createdAt: bangkokDayAt(-12, 10),
      updatedAt: bangkokDayAt(-1, 14),
    }),
    staffLead({
      id: LEAD.suda,
      agent: me!,
      contactName: "คุณสุดา ตัวอย่าง",
      organisationName: "ร้านเครื่องสำอางทดสอบ (ข้อมูลจำลอง)",
      phone: "+66820002222",
      stage: "quoted",
      stageChangedAt: bangkokDayAt(-3, 11),
      expectedValue: "64000.00",
      nextFollowUpAt: bangkokDayAt(-1, 10),
      createdAt: bangkokDayAt(-9, 10),
      updatedAt: bangkokDayAt(-3, 11),
    }),
    staffLead({
      id: LEAD.anan,
      agent: me!,
      contactName: "คุณอนันต์ ทดลอง",
      organisationName: "ฟาร์มผักตัวอย่าง (ข้อมูลจำลอง)",
      email: "anan@example.invalid",
      stage: "contacted",
      stageChangedAt: bangkokDayAt(-2, 9),
      expectedValue: "25000.00",
      nextFollowUpAt: bangkokDayAt(2, 10),
      createdAt: bangkokDayAt(-4, 10),
      updatedAt: bangkokDayAt(-2, 9),
    }),
    staffLead({
      id: LEAD.porn,
      agent: wipa!,
      contactName: "คุณพร ตัวอย่าง",
      organisationName: "โรงคั่วกาแฟทดสอบ (ข้อมูลจำลอง)",
      phone: "+66820004444",
      stage: "negotiating",
      stageChangedAt: bangkokDayAt(-2, 16),
      expectedValue: "420000.00",
      nextFollowUpAt: bangkokDayAt(1, 10),
      createdAt: bangkokDayAt(-20, 10),
      updatedAt: bangkokDayAt(-2, 16),
    }),
    staffLead({
      id: LEAD.chai,
      agent: wipa!,
      contactName: "คุณชัย ทดสอบ",
      organisationName: "ร้านอาหารแช่แข็งตัวอย่าง (ข้อมูลจำลอง)",
      stage: "new",
      createdAt: bangkokDayAt(-1, 10),
      updatedAt: bangkokDayAt(-1, 10),
    }),
    staffLead({
      id: LEAD.lamai,
      agent: thana!,
      contactName: "คุณละไม ทดลอง",
      organisationName: "แบรนด์สบู่ทดสอบ (ข้อมูลจำลอง)",
      stage: "won",
      wonAt: bangkokDayAt(-6, 15),
      status: "converted",
      convertedAt: bangkokDayAt(-8, 15),
      convertedCustomerId: "00000000-0000-4000-8000-0000000b8901",
      stageChangedAt: bangkokDayAt(-6, 15),
      expectedValue: "96000.00",
      createdAt: bangkokDayAt(-40, 10),
      updatedAt: bangkokDayAt(-6, 15),
    }),
    staffLead({
      id: LEAD.boon,
      agent: thana!,
      contactName: "คุณบุญ ตัวอย่าง",
      organisationName: "ร้านชาไข่มุกทดสอบ (ข้อมูลจำลอง)",
      stage: "lost",
      status: "withdrawn",
      lostReason: "price",
      lostNote: "คู่แข่งเสนอถูกกว่า 15% สเปกต่ำกว่า",
      stageChangedAt: bangkokDayAt(-5, 15),
      expectedValue: "38000.00",
      createdAt: bangkokDayAt(-30, 10),
      updatedAt: bangkokDayAt(-5, 15),
    }),
  ];
}

/* ------------------------------------------------------------------------------------- inbound */

function inbound(partial: Partial<Inbound> & Pick<Inbound, "id" | "contactName" | "source">): Inbound {
  const created = partial.createdAt ?? bangkokIso(-30);
  return {
    sourceRef: null,
    contactPhone: null,
    contactEmail: null,
    organisationName: null,
    need: null,
    status: "new",
    assignee: null,
    assignedAt: null,
    leadId: null,
    leadRefusal: null,
    firstResponseDueAt: bangkokIso(210),
    firstRespondedAt: null,
    slaBreached: false,
    slaBreachedAt: null,
    disqualifiedReason: null,
    statusNote: null,
    consentBasis: partial.source === "manual" ? "staff_entry" : "enquiry",
    signalCount: 1,
    lastSignalAt: created,
    customerId: null,
    designId: null,
    score: null,
    scoreReasons: [],
    scoredAt: null,
    updatedAt: created,
    ...partial,
    createdAt: created,
  };
}

/** D-471: an item as the API answers it — scored at intake / refresh with its top reasons (the mock's stand-in). */
function scoredInbound(row: Inbound): Inbound {
  const quantity = Number(/([\d,]{3,})\s*(ใบ|ชิ้น)/.exec(row.need ?? "")?.[1]?.replace(/,/g, "") ?? 0) || null;
  const { score, reasons } = mockLeadScore({
    kind: "inbound",
    source: row.source,
    email: row.contactEmail,
    taxIdPresent: /บริษัท|จำกัด/.test(row.organisationName ?? ""),
    quantity,
    lastAt: row.lastSignalAt ?? row.createdAt,
    signals: row.signalCount,
  });
  return { ...row, score, scoreReasons: reasons, scoredAt: row.lastSignalAt ?? row.createdAt };
}

function seedInbound(reps: RepRecord[]): Inbound[] {
  const rep = (at: number) => ({ id: reps[at]!.userId, displayName: reps[at]!.displayName });
  return [
    inbound({
      id: "00000000-0000-4000-8000-0000000b9001",
      source: "contact_form",
      sourceRef: "TK-2611-00031",
      contactName: "คุณเมธี ทดสอบ",
      contactPhone: "+66830001001",
      contactEmail: "methee@example.invalid",
      organisationName: "บริษัท อาหารเสริมตัวอย่าง จำกัด (ข้อมูลจำลอง)",
      need: "กล่องใส่ขวดอาหารเสริม 5,000 ใบ พิมพ์ 4 สี เคลือบด้าน",
      createdAt: bangkokIso(-50),
      firstResponseDueAt: bangkokIso(190),
    }),
    inbound({
      id: "00000000-0000-4000-8000-0000000b9002",
      source: "rfq",
      sourceRef: "RFQ-2611-0012",
      contactName: "คุณนิด ตัวอย่าง",
      contactEmail: "nid@example.invalid",
      organisationName: "ร้านขนมปังทดสอบ (ข้อมูลจำลอง)",
      need: "กล่องเค้ก 2 ขนาด รวม 3,000 ใบ",
      createdAt: bangkokIso(-200),
      firstResponseDueAt: bangkokIso(40),
    }),
    inbound({
      id: "00000000-0000-4000-8000-0000000b9003",
      source: "contact_form",
      sourceRef: "TK-2611-00027",
      contactName: "คุณโอม ทดลอง",
      contactPhone: "+66830001003",
      organisationName: "สตาร์ทอัพเครื่องดื่มตัวอย่าง (ข้อมูลจำลอง)",
      need: "ถุงตั้งได้ซิปล็อก 10,000 ใบ",
      createdAt: bangkokIso(-320),
      firstResponseDueAt: bangkokIso(-80),
      slaBreached: true,
      slaBreachedAt: bangkokIso(-80),
    }),
    inbound({
      id: "00000000-0000-4000-8000-0000000b9004",
      source: "manual",
      contactName: "คุณแพร ทดสอบ",
      contactPhone: "+66830001004",
      organisationName: "ร้านดอกไม้ตัวอย่าง (ข้อมูลจำลอง)",
      need: "ป้ายแขวนและสติกเกอร์",
      createdAt: bangkokIso(-25),
      firstResponseDueAt: bangkokIso(215),
    }),
    inbound({
      id: "00000000-0000-4000-8000-0000000b9005",
      source: "contact_form",
      sourceRef: "TK-2611-00025",
      contactName: "คุณต้น ตัวอย่าง",
      contactPhone: "+66899999999",
      organisationName: "บริษัท ทดลองค้าส่ง จำกัด (ข้อมูลจำลอง)",
      need: "กล่องลูกฟูกส่งของ",
      status: "assigned",
      assignee: rep(0),
      assignedAt: bangkokIso(-60),
      leadRefusal: "unavailable",
      createdAt: bangkokIso(-90),
      firstResponseDueAt: bangkokIso(150),
    }),
    inbound({
      id: "00000000-0000-4000-8000-0000000b9006",
      source: "rfq",
      sourceRef: "RFQ-2611-0009",
      contactName: "คุณอนันต์ ทดลอง",
      contactEmail: "anan@example.invalid",
      organisationName: "ฟาร์มผักตัวอย่าง (ข้อมูลจำลอง)",
      need: "ถาดและฉลากผัก",
      status: "converted_to_lead",
      assignee: rep(0),
      assignedAt: bangkokIso(-5 * 24 * 60),
      leadId: LEAD.anan,
      firstRespondedAt: bangkokIso(-5 * 24 * 60 + 70),
      createdAt: bangkokIso(-5 * 24 * 60 - 30),
      firstResponseDueAt: bangkokIso(-5 * 24 * 60 + 210),
    }),
    inbound({
      id: "00000000-0000-4000-8000-0000000b9007",
      source: "contact_form",
      sourceRef: "TK-2610-00191",
      contactName: "คุณฝน ทดสอบ",
      contactEmail: "fon@example.invalid",
      need: "ขอดูผลงานที่เคยพิมพ์",
      status: "disqualified",
      disqualifiedReason: "not_a_buyer",
      statusNote: "นักศึกษาทำรายงาน",
      assignee: rep(1),
      assignedAt: bangkokIso(-3 * 24 * 60),
      firstRespondedAt: bangkokIso(-3 * 24 * 60 + 30),
      createdAt: bangkokIso(-3 * 24 * 60 - 20),
      firstResponseDueAt: bangkokIso(-3 * 24 * 60 + 220),
    }),
    // D-471 captured signals (marketing consent granted; nobody attributed).
    inbound({
      id: "00000000-0000-4000-8000-0000000b9008",
      source: "dieline_download",
      sourceRef: "PK-TE-01-K7QD",
      contactName: "คุณภูมิ ทดสอบ",
      contactEmail: "phum@example.invalid",
      organisationName: "บริษัท ชาออร์แกนิกตัวอย่าง จำกัด (ข้อมูลจำลอง)",
      need: "dieline · PK-TE-01-K7QD · PK-TE-02-M4PA",
      consentBasis: "marketing_consent",
      customerId: "00000000-0000-4000-8000-0000000c0101",
      signalCount: 3,
      lastSignalAt: bangkokIso(-15),
      createdAt: bangkokIso(-2 * 24 * 60),
      firstResponseDueAt: bangkokIso(-2 * 24 * 60 + 240),
      slaBreached: true,
      slaBreachedAt: bangkokIso(-2 * 24 * 60 + 240),
    }),
  ];
}

/** D-471: what the mock's studio idle job finds — one saved design not ordered, of a customer who agreed to hear. */
const IDLE_DESIGN = {
  designId: "00000000-0000-4000-8000-0000000c0201",
  customerId: "00000000-0000-4000-8000-0000000c0102",
  contactName: "คุณใบเตย ออกแบบเอง",
  contactPhone: "+66830001010",
  contactEmail: "baitoey@example.invalid",
  organisationName: "บริษัท ขนมไทยตัวอย่าง จำกัด (ข้อมูลจำลอง)",
  need: "“กล่องขนมเปี๊ยะ 6 ช่อง” · PK-TE-03-R2KD",
};

/** Job `sales.capture_studio_idle` as the mock runs it (POST …/mock-jobs/…): idempotent per design. */
function runStudioIdleJob(): number {
  if (inboundRows.some((row) => row.designId === IDLE_DESIGN.designId)) return 0;
  const { designId, customerId, ...contact } = IDLE_DESIGN;
  inboundRows.unshift(
    inbound({
      id: nextId("sinb"),
      source: "studio_idle",
      ...contact,
      designId,
      customerId,
      consentBasis: "marketing_consent",
      lastSignalAt: bangkokIso(-3 * 24 * 60 - 40),
      createdAt: bangkokIso(),
      firstResponseDueAt: bangkokIso(240),
    }),
  );
  return 1;
}

/* ---------------------------------------------------------------------------------- approvals */

/** What the mock knows of a quote's economics (the API reads buy prices; these are obviously fake ratios). */
interface Economics {
  listRevenue: number;
  costRatio: number;
  standardRatePct: number;
  creditDays: number;
  depositPct: number;
}

interface ApprovalRecord {
  id: string;
  agentQuoteId: string;
  requestId: string;
  agent: AgentRef;
  lead: Schemas["AgentQuoteLeadRefDto"];
  requestedBy: Schemas["UserRefDto"];
  requestedByUserId: string | null;
  status: Schemas["SalesDiscountApprovalStatus"];
  baseLevel: Level;
  level: Level;
  negotiationHeavy: boolean;
  requestedPct: string;
  round: number;
  dueAt: string;
  escalatedAt: string | null;
  decidedBy: Schemas["UserRefDto"] | null;
  decidedAt: string | null;
  validUntil: string | null;
  createdAt: string;
  decisionNote: string | null;
  counter: Record<string, unknown> | null;
  selfApproved: boolean;
  economics: Economics;
  quoteCode: string | null;
  quoteValidUntil: string;
  offered: { optionId: string; kind: Schemas["AgentDiscountOptionKind"]; discountPct: string; ratePct: string }[];
  bigDeal: boolean;
}

const FLOOR_PCT = 10;
const LIMITS = { rep: 3, manager: 8 };
const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2);
const pct = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

function figures(e: Economics, discountPct: number, options: Partial<SimInput> = {}) {
  const creditDays = options.creditDays ?? e.creditDays;
  const depositPct = options.depositPct ?? e.depositPct;
  const ratePct = options.ratePct ?? e.standardRatePct;
  const free = options.freeServicesAmount ?? 0;
  const discountAmount = (e.listRevenue * discountPct) / 100;
  const net = e.listRevenue - discountAmount;
  const factoryCost = e.listRevenue * e.costRatio;
  const shipping = -e.listRevenue * 0.004;
  const gross = net - factoryCost + shipping - free;
  const commission = (net * ratePct) / 100;
  // Factory paid half at day 0 and half at day 21; the customer pays at delivery (day 14) + credit days.
  const payDay = creditDays > 0 ? 14 + creditDays : depositPct >= 50 ? 14 : 0;
  const uncovered = Math.max(0, 1 - depositPct / 100);
  const legA = Math.round(((factoryCost / 2) * uncovered * 0.07 * payDay) / 365);
  const legB = Math.round(((factoryCost / 2) * uncovered * 0.07 * Math.max(0, payDay - 21)) / 365);
  const credit = depositPct >= 50 && creditDays === 0 ? 0 : legA + legB;
  const contribution = gross - commission - credit;
  const grossPct = net > 0 ? (gross / net) * 100 : 0;
  return {
    discountAmount,
    net,
    factoryCost,
    shipping,
    gross,
    grossPct,
    commission,
    ratePct,
    credit,
    contribution,
    contributionPct: net > 0 ? (contribution / net) * 100 : 0,
    free,
  };
}

function levelOf(discountPct: number, grossPct: number, heavy: boolean): Level {
  const pass = grossPct >= FLOOR_PCT;
  const base: Level =
    pass && discountPct <= LIMITS.rep ? "rep" : pass && discountPct <= LIMITS.manager ? "sales_manager" : "c_level";
  if (!heavy) return base;
  return base === "rep" ? "sales_manager" : "c_level";
}
const colourOf = (level: Level): Colour => (level === "rep" ? "green" : level === "sales_manager" ? "amber" : "red");

type Tier = Schemas["SalesWaterfallTier"];
const tierOf = (who: StaffPersona): Tier =>
  can(who, "discount_approvals.waterfall_full")
    ? "full"
    : can(who, "discount_approvals.margin_pct")
      ? "margin_pct"
      : "authority";

interface SimInput {
  creditDays: number;
  depositPct: number;
  ratePct: number;
  freeServicesAmount: number;
  paymentMethod: string;
}

/** The ONE serializer the caller's permissions allow (D-470 field-level RBAC). */
function waterfallFor(
  tier: Tier,
  record: ApprovalRecord,
  discountPct: number,
  input: Partial<SimInput> = {},
): { level: Level; waterfall: Waterfall } {
  const f = figures(record.economics, discountPct, input);
  const level = levelOf(discountPct, f.grossPct, record.negotiationHeavy);
  const authorityLevel = colourOf(level);
  if (tier === "authority") return { level, waterfall: { visibility: "authority", authorityLevel } };
  const floorCheck: Schemas["SalesFloorCheck"] = f.grossPct >= FLOOR_PCT ? "pass" : "fail";
  const shared = {
    authorityLevel,
    discountPct: pct(discountPct),
    grossMarginPct: pct(f.grossPct),
    contributionPct: pct(f.contributionPct),
    floorPct: pct(FLOOR_PCT),
    floorCheck,
  };
  if (tier === "margin_pct") return { level, waterfall: { visibility: "margin_pct", ...shared } };
  return {
    level,
    waterfall: {
      visibility: "full",
      ...shared,
      listRevenue: money(record.economics.listRevenue),
      discountAmount: money(f.discountAmount),
      netRevenue: money(f.net),
      factoryCost: money(f.factoryCost),
      shippingDifference: money(f.shipping),
      paymentFee: {
        method: input.paymentMethod ?? null,
        amount: "0.00",
        status: input.paymentMethod === "card" ? "set" : "not_set",
      },
      freeServices: money(f.free),
      grossMargin: money(f.gross),
      commissionRatePct: pct(f.ratePct),
      commissionAmount: money(f.commission),
      creditCost: money(f.credit),
      creditCostPct: pct(f.net > 0 ? (f.credit / f.net) * 100 : 0),
      badDebtProvision: { pct: null, amount: "0.00", status: "not_set" },
      contributionAfterCommission: money(f.contribution),
    },
  };
}

/* ----------------------------------------------------------------------------------- state */

let reps: RepRecord[] = [];
let staffLeads: Lead[] = [];
let activities = new Map<string, Activity[]>();
let inboundRows: Inbound[] = [];
let approvals: ApprovalRecord[] = [];
let views: Schemas["WaterfallViewDto"][] = [];
let cards: (Card & { authorId: string; submittedById: string | null })[] = [];
let seededQuotes = false;
const idempotency = new Map<string, unknown>();

function seedCards(): typeof cards {
  const marketing = PERSONAS.find((persona) => persona.key === "marketing")!.id;
  const manager = PERSONAS.find((persona) => persona.key === "sales_manager")!.id;
  return PLAYBOOK_SEED.map((seed, at) => {
    const managerOwned = seed.key === "walk-away" || seed.key === "cash-vs-credit";
    return {
      id: mockId("pbk", at + 1),
      key: seed.key,
      version: 1,
      status: "published",
      submitted: false,
      contexts: [...seed.contexts] as Card["contexts"],
      audiences: [...seed.audiences] as Card["audiences"],
      ownerRole: managerOwned ? "sales_manager" : "marketing",
      titleTh: seed.titleTh,
      titleEn: null,
      bodyTh: seed.bodyTh,
      bodyEn: null,
      suggestedReplies: seed.replies.map((th) => ({ th, en: null })),
      sort: (at + 1) * 10,
      changeNote: "ฉบับแรกจากคู่มือการขาย (PLAYBOOK.md)",
      source: "PLAYBOOK.md v1",
      submittedAt: bangkokDayAt(-3, 10),
      publishedAt: bangkokDayAt(-2, 10),
      updatedAt: bangkokDayAt(-2, 10),
      authorId: managerOwned ? manager : marketing,
      submittedById: managerOwned ? manager : marketing,
    };
  });
}

export function resetSalesDeskMock(): void {
  reps = seedReps();
  staffLeads = seedLeads(reps);
  activities = new Map();
  inboundRows = seedInbound(reps);
  approvals = [];
  views = [];
  cards = seedCards();
  // A second version waiting for a publisher: drafted and submitted by Marketing (maker-checker).
  const base = cards.find((card) => card.key === "follow-up")!;
  const marketing = PERSONAS.find((persona) => persona.key === "marketing")!.id;
  cards.push({
    ...base,
    id: mockId("pbk", 50),
    version: 2,
    status: "draft",
    submitted: true,
    titleTh: `${base.titleTh} (ปรับปรุง)`,
    changeNote: "เพิ่มประโยคตอบลูกค้าที่ยังไม่ตัดสินใจ",
    submittedAt: bangkokIso(-120),
    publishedAt: null,
    updatedAt: bangkokIso(-120),
    authorId: marketing,
    submittedById: marketing,
  });
  seededQuotes = false;
  for (const lead of staffLeads) activities.set(lead.id, seedActivities(lead));
}

function seedActivities(lead: Lead): Activity[] {
  const list: Activity[] = [
    {
      id: nextId("sact"),
      kind: "system",
      body: null,
      author: "system",
      event: null,
      fromStage: null,
      toStage: "new",
      agentQuoteId: null,
      occurredAt: lead.createdAt,
    },
  ];
  if (lead.stage !== "new") {
    list.unshift({
      id: nextId("sact"),
      kind: "call",
      body: "โทรคุยความต้องการ ขนาดและจำนวนที่สั่งต่อรอบ",
      author: "agent",
      event: null,
      fromStage: null,
      toStage: null,
      agentQuoteId: null,
      occurredAt: lead.stageChangedAt ?? lead.updatedAt,
    });
  }
  return list;
}

resetSalesDeskMock();
setExternalLeadResolver((leadId) => staffLeads.find((lead) => lead.id === leadId));

const addActivity = (leadId: string, entry: Omit<Activity, "id">) => {
  const list = activities.get(leadId) ?? [];
  list.unshift({ ...entry, id: nextId("sact") });
  activities.set(leadId, list);
};

const repOfUser = (userId: string) => reps.find((rep) => rep.userId === userId);
const myAgent = (who: StaffPersona) => repOfUser(who.id)?.agent ?? null;
const freelanceLeads = (): Lead[] =>
  agentLeads().map((lead) =>
    scoredLead({
      ...lead,
      agent: FREELANCE_AGENT,
      convertedCustomerId: lead.status === "converted" ? "00000000-0000-4000-8000-0000000c0001" : null,
      convertedCompanyId: null,
      convertedFactoryId: null,
      scoreReasons: [],
      scoredAt: null,
    }),
  );
const findLead = (id: unknown): Lead | undefined =>
  staffLeads.find((lead) => lead.id === id) ?? freelanceLeads().find((lead) => lead.id === id);
/** A rep sees only their own employee agent's leads; a manager sees every lead. */
const visible = (who: StaffPersona, lead: Lead) => isManager(who) || lead.agent.id === myAgent(who)?.id;

/* ---------------------------------------------------------------------- quotes & approvals seed */

function openApproval(
  agentQuoteId: string,
  round: Round,
  agent: AgentRef,
  requestedBy: Schemas["UserRefDto"],
  requestedByUserId: string | null,
  economics: Economics,
  extra: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  const record = agentQuoteRecords().find((row) => row.id === agentQuoteId)!;
  const saved = savedQuoteOf(record);
  const heavy = extra.negotiationHeavy ?? false;
  const f = figures(economics, Number(round.requestedPct));
  const level = levelOf(Number(round.requestedPct), f.grossPct, heavy);
  const approval: ApprovalRecord = {
    id: nextId("dapp"),
    agentQuoteId,
    requestId: round.id,
    agent,
    lead: record.lead,
    requestedBy,
    requestedByUserId,
    status: "pending",
    baseLevel: levelOf(Number(round.requestedPct), f.grossPct, false),
    level,
    negotiationHeavy: heavy,
    requestedPct: round.requestedPct,
    round: round.round,
    dueAt: bangkokIso(240),
    escalatedAt: null,
    decidedBy: null,
    decidedAt: null,
    validUntil: null,
    createdAt: round.createdAt,
    decisionNote: null,
    counter: null,
    selfApproved: false,
    economics,
    quoteCode: saved?.quoteCode ?? null,
    quoteValidUntil: saved?.validUntil ?? bangkokDayAt(14, 23, 59),
    offered: [],
    bigDeal: Boolean(record.dealRegistration),
    ...extra,
  };
  approvals.unshift(approval);
  return approval;
}

function round(partial: Partial<Round> & Pick<Round, "requestedPct" | "quoteOptionId" | "quantity">): Round {
  return {
    id: nextId("dreq"),
    round: 1,
    status: "open",
    reason: "competitor_price",
    reasonNote: null,
    quantityChange: null,
    commitment: "one_off",
    commitmentMonths: null,
    depositPct: null,
    cashWithinDays: null,
    leadTimeFlexDays: null,
    specChange: null,
    competitorFile: null,
    competitorSpec: null,
    decisionNote: null,
    createdAt: bangkokIso(-45),
    decidedAt: null,
    options: [],
    ...partial,
  };
}

function ensureDesk(request: Request) {
  if (seededQuotes) return;
  seededQuotes = true;
  ensureAgentQuotesSeeded();
  const spec = defaultInstantSpec();
  if (!spec) return;
  const quoteFor = (leadId: string, quantity: number) => {
    const created = createAgentQuote(leadId, spec.productTypeCode, { ...spec.configuration, quantities: [quantity] });
    return created instanceof Response ? null : created;
  };
  const rep = personaRef("sales_rep");
  const repAgent = reps[0]!.agent!;
  const wipaAgent = reps[1]!.agent!;

  // 1 · The freelance agent persona's big quote (P3 seed "คุณวีระ", 20,000 pcs, deal registered): a new round the
  //     agent asked for — manager level. Approving it is the e2e journey (the agent then sees the options).
  const wira = agentQuoteRecords().find((row) => row.lead.id === AGENT_LEAD_IDS.wira);
  if (wira) {
    const saved = savedQuoteOf(wira)!;
    const first = round({
      requestedPct: "6",
      quoteOptionId: quoteOptionIdOf(wira),
      quantity: saved.quantity,
      reason: "competitor_price",
      reasonNote: "ลูกค้าได้ใบเสนอราคาจากโรงพิมพ์อื่นถูกกว่าราว 7%",
      commitment: "call_off",
      commitmentMonths: 6,
      depositPct: "50",
      competitorSpec: {
        boardGrade: "อาร์ตการ์ด 300 แกรม",
        printColours: 4,
        printSides: 1,
        finish: "ไม่เคลือบ",
        quantity: saved.quantity,
        price: money(Number(saved.netAmount) * 0.93),
        vatIncluded: false,
        shippingIncluded: false,
        leadTimeDays: 14,
      },
      competitorFile: { id: "00000000-0000-4000-8000-0000000b9901", fileName: "competitor-quote.pdf" },
    });
    // A round the agent already sent (the P3 journey, on the same server) is the one the desk answers.
    const open = discountRoundsOf(wira.id).find((candidate) => candidate.status === "open");
    if (!open) pushDiscountRound(wira.id, first);
    openApproval(
      wira.id,
      open ?? first,
      FREELANCE_AGENT,
      { id: "00000000-0000-4000-8000-0000000a6010", displayName: "ตัวแทน ทดสอบ (ข้อมูลจำลอง)" },
      null,
      { listRevenue: Number(saved.netAmount), costRatio: 0.74, standardRatePct: 5, creditDays: 30, depositPct: 50 },
      { dueAt: bangkokIso(150) },
    );
  }

  // 2 · The rep's own lead "คุณกิตติ": the rep asked 2.5% (rep level) — the rep cannot decide their own request.
  const kitti = quoteFor(LEAD.kitti, 10000);
  if (kitti) {
    const saved = savedQuoteOf(kitti)!;
    const asked = round({
      requestedPct: "2.5",
      quoteOptionId: quoteOptionIdOf(kitti),
      quantity: saved.quantity,
      reason: "volume",
      cashWithinDays: 7,
      createdAt: bangkokIso(-30),
    });
    pushDiscountRound(kitti.id, asked);
    openApproval(
      kitti.id,
      asked,
      repAgent,
      rep,
      rep.id,
      { listRevenue: Number(saved.netAmount), costRatio: 0.7, standardRatePct: 2, creditDays: 0, depositPct: 50 },
      { dueAt: bangkokIso(210) },
    );
  }

  // 3 · Another rep's big deal "คุณพร": 12% asked, negotiation-heavy customer — C-Level, overdue and escalated.
  const porn = quoteFor(LEAD.porn, 50000);
  if (porn) {
    const saved = savedQuoteOf(porn)!;
    const asked = round({
      round: 2,
      requestedPct: "12",
      quoteOptionId: quoteOptionIdOf(porn),
      quantity: saved.quantity,
      reason: "strategic_account",
      reasonNote: "ลูกค้ารายใหญ่ ต่อรองหลายรอบ ขอราคาสัญญา 12 เดือน",
      commitment: "call_off",
      commitmentMonths: 12,
      leadTimeFlexDays: 7,
      createdAt: bangkokIso(-400),
    });
    pushDiscountRound(porn.id, asked);
    openApproval(
      porn.id,
      asked,
      wipaAgent,
      { id: reps[1]!.userId, displayName: reps[1]!.displayName },
      reps[1]!.userId,
      { listRevenue: Number(saved.netAmount), costRatio: 0.76, standardRatePct: 2, creditDays: 60, depositPct: 0 },
      { negotiationHeavy: true, dueAt: bangkokIso(-60), escalatedAt: bangkokIso(-55) },
    );
  }

  // 4 · Decided history (for the queue's "decided" tab and the post-deal review).
  const suda = quoteFor(LEAD.suda, 3000);
  if (suda) {
    const saved = savedQuoteOf(suda)!;
    const asked = round({
      requestedPct: "4",
      quoteOptionId: quoteOptionIdOf(suda),
      quantity: saved.quantity,
      reason: "budget",
      depositPct: "30",
      status: "rejected",
      decisionNote: "ขอให้ลูกค้าเพิ่มจำนวนเป็น 5,000 ใบก่อน",
      decidedAt: bangkokIso(-2 * 24 * 60),
      createdAt: bangkokIso(-2 * 24 * 60 - 120),
    });
    pushDiscountRound(suda.id, asked);
    const done = openApproval(suda.id, asked, repAgent, rep, rep.id, {
      listRevenue: Number(saved.netAmount),
      costRatio: 0.72,
      standardRatePct: 2,
      creditDays: 30,
      depositPct: 30,
    });
    Object.assign(done, {
      status: "countered",
      decidedBy: personaRef("sales_manager"),
      decidedAt: asked.decidedAt,
      decisionNote: asked.decisionNote,
      counter: { quantityChange: 5000 },
      dueAt: bangkokIso(-2 * 24 * 60 + 120),
    });
  }
  void request;
}

onDiscountRequested((agentQuoteId, created) => {
  // `sales_agent_discount.requested` subscriber: every request opens an approval (when the desk has been seeded).
  if (!seededQuotes) return;
  const record = agentQuoteRecords().find((row) => row.id === agentQuoteId);
  if (!record) return;
  const saved = savedQuoteOf(record);
  const staff = staffLeads.find((lead) => lead.id === record.lead.id);
  openApproval(
    agentQuoteId,
    created,
    staff?.agent ?? FREELANCE_AGENT,
    staff
      ? { id: repOfAgent(staff.agent.id)?.userId ?? "", displayName: staff.agent.legalName }
      : { id: "00000000-0000-4000-8000-0000000a6010", displayName: "ตัวแทน ทดสอบ (ข้อมูลจำลอง)" },
    staff ? (repOfAgent(staff.agent.id)?.userId ?? null) : null,
    {
      listRevenue: Number(saved?.netAmount ?? 10000),
      costRatio: 0.72,
      standardRatePct: staff ? 2 : 5,
      creditDays: 30,
      depositPct: Number(created.depositPct ?? 0),
    },
  );
});
const repOfAgent = (agentId: string) => reps.find((rep) => rep.agent?.id === agentId);

/* ---------------------------------------------------------------------------------- serializers */

const summaryOf = (a: ApprovalRecord): Schemas["DiscountApprovalSummaryDto"] => ({
  id: a.id,
  status: a.status,
  level: a.level,
  baseLevel: a.baseLevel,
  authorityLevel: colourOf(a.level),
  negotiationHeavy: a.negotiationHeavy,
  requestedPct: a.requestedPct,
  round: a.round,
  requestId: a.requestId,
  agentQuoteId: a.agentQuoteId,
  quote: { id: a.agentQuoteId, quoteCode: a.quoteCode, validUntil: a.quoteValidUntil },
  agent: a.agent,
  lead: a.lead,
  requestedBy: a.requestedBy,
  dueAt: a.dueAt,
  overdue: a.status === "pending" && Date.parse(a.dueAt) < Date.now(),
  escalatedAt: a.escalatedAt,
  decidedBy: a.decidedBy,
  decidedAt: a.decidedAt,
  validUntil: a.validUntil,
  createdAt: a.createdAt,
});

function detailOf(a: ApprovalRecord, who: StaffPersona): Schemas["DiscountApprovalDto"] {
  const tier = tierOf(who);
  const request = discountRoundsOf(a.agentQuoteId).find((r) => r.id === a.requestId)!;
  const dto: Schemas["DiscountApprovalDto"] = {
    ...summaryOf(a),
    request,
    waterfall: waterfallFor(tier, a, Number(a.requestedPct)).waterfall,
    optionWaterfalls: a.offered.map((option) => ({
      optionId: option.optionId,
      kind: option.kind,
      discountPct: option.discountPct,
      waterfall: waterfallFor(tier, a, Number(option.discountPct), { ratePct: Number(option.ratePct) }).waterfall,
    })),
    decisionNote: a.decisionNote,
    counter: a.counter,
    selfApproved: a.selfApproved,
  };
  // Price locks are a full-tier field only (factory buy price).
  if (tier === "full" && a.bigDeal && a.status === "approved") {
    dto.priceLocks = [
      {
        id: mockId("plock", 1),
        buyPrice: money(a.economics.listRevenue * a.economics.costRatio),
        status: "requested",
        validUntil: a.validUntil ?? bangkokDayAt(7, 23, 59),
      },
    ];
  }
  return dto;
}

function logView(who: StaffPersona, a: ApprovalRecord, purpose: Schemas["SalesWaterfallViewPurpose"]) {
  views.unshift({
    id: nextId("wview"),
    viewer: { id: who.id, displayName: who.displayName },
    quoteId: a.agentQuoteId,
    quoteCode: a.quoteCode,
    approvalId: a.id,
    tier: tierOf(who),
    purpose,
    viewedAt: bangkokIso(),
  });
}

/** Who may decide at which level (D-470): rep — any sales_rep or higher; manager — sales_manager or C-Level. */
function mayDecide(who: StaffPersona, level: Level): boolean {
  if (!can(who, "discount_approvals.decide")) return false;
  const roles = who.roles;
  if (roles.includes("superadmin") || roles.includes("c_level")) return true;
  if (level === "sales_manager") return roles.includes("sales_manager");
  if (level === "rep") return roles.includes("sales_manager") || roles.includes("sales_rep");
  return false;
}

const findApproval = (id: unknown) => approvals.find((a) => a.id === id);
const approvalVisible = (who: StaffPersona, a: ApprovalRecord) =>
  !who.roles.every((role) => role === "sales_rep") || a.requestedByUserId === who.id || a.level === "rep";

/* ----------------------------------------------------------------------------------- dashboard */

function dashboard(url: URL): Schemas["SalesDashboardDto"] {
  const kind = url.searchParams.get("agentKind");
  const agentId = url.searchParams.get("agentId");
  const period = (url.searchParams.get("period") ?? "month") as Schemas["SalesDashboardPeriod"];
  const all = [...staffLeads, ...freelanceLeads()].filter(
    (lead) => (!kind || lead.agent.kind === kind) && (!agentId || lead.agent.id === agentId),
  );
  // History the mock does not keep lead by lead: a fixed, obviously fake 90-day base so the charts have a shape.
  const scale = kind === "freelance" ? 0.4 : kind === "employee" ? 0.6 : 1;
  const base = { new: 120, contacted: 92, quoted: 61, negotiating: 34, won: 19 };
  const stages = ["new", "contacted", "quoted", "negotiating", "won"] as const;
  const counts = stages.map(
    (stage) => Math.round(base[stage] * scale) + all.filter((lead) => lead.stage === stage).length,
  );
  const funnel = stages.map((stage, at) => ({
    stage,
    count: counts[at]!,
    dropOffPct: at === 0 ? null : pct(100 - (counts[at]! / counts[at - 1]!) * 100),
  }));
  const won = counts[4]!;
  const lost = Math.round(41 * scale) + all.filter((lead) => lead.stage === "lost").length;
  const leads = counts[0]!;
  const winRate = (w: number, l: number) => (w + l > 0 ? pct((w / (w + l)) * 100) : null);
  const months = ["2026-08", "2026-09", "2026-10", "2026-11"];
  const weeks = Array.from({ length: 12 }, (_, i) => bangkokDayAt(-7 * (11 - i), 0).slice(0, 10));
  const periods = period === "week" ? weeks : months;
  const byPeriod = periods.map((key, at) => ({
    period: key,
    leads: Math.round((period === "week" ? 9 + ((at * 7) % 6) : 34 + at * 6) * scale),
    won: Math.round((period === "week" ? 1 + (at % 3) : 4 + at * 2) * scale),
  }));
  const source = (s: string, l: number, w: number, lo: number, inb: number) => ({
    source: s,
    leads: Math.round(l * scale),
    won: Math.round(w * scale),
    lost: Math.round(lo * scale),
    winRatePct: winRate(w, lo),
    inbound: Math.round(inb * scale),
  });
  const repRows = reps
    .filter((rep) => rep.agent && (!agentId || rep.agent.id === agentId))
    .map((rep, at) => {
      const mine = staffLeads.filter((lead) => lead.agent.id === rep.agent!.id);
      const w = 4 + at * 2 + mine.filter((lead) => lead.stage === "won").length;
      const l = 6 - at + mine.filter((lead) => lead.stage === "lost").length;
      return {
        agentId: rep.agent!.id,
        name: rep.displayName,
        leads: 22 + at * 7 + mine.length,
        won: w,
        lost: l,
        winRatePct: winRate(w, l),
        openValue: money(150000 + at * 82000),
      };
    });
  const split = (["employee", "freelance"] as const)
    .filter((k) => !kind || k === kind)
    .map((k) => {
      const w = k === "employee" ? 12 : 7;
      const l = k === "employee" ? 24 : 17;
      return {
        agentKind: k,
        leads: k === "employee" ? 74 : 46,
        won: w,
        lost: l,
        winRatePct: winRate(w, l),
        openValue: money(k === "employee" ? 1240000 : 615000),
      };
    });
  return {
    from: url.searchParams.get("from") ?? bangkokDayAt(-90, 0).slice(0, 10),
    to: url.searchParams.get("to") ?? bangkokDayAt(0, 0).slice(0, 10),
    period,
    asOf: bangkokIso(),
    totals: { leads, won, lost, winRatePct: winRate(won, lost), openValue: money(1855000 * scale) },
    funnel,
    medianDays: (["new", "contacted", "quoted", "negotiating"] as const).map((stage, at) => ({
      stage,
      medianDays: pct([1.5, 3, 4.5, 6][at]!),
      samples: [88, 61, 40, 22][at]!,
    })),
    bySource: [
      source("staff", 52, 9, 14, 38),
      source("link", 31, 5, 9, 0),
      source("manual", 24, 3, 10, 0),
      source("card_scan", 9, 1, 4, 0),
      source("csv_import", 4, 1, 4, 0),
    ],
    byRep: repRows,
    byPeriod,
    split,
    inbound: { total: inboundRows.length + 38, firstResponseSlaPct: "86.36" },
  };
}

/* ---------------------------------------------------------------------------------------- cards */

const cardDto = ({ authorId: _a, submittedById: _s, ...card }: (typeof cards)[number]): Card => card;
const ownsCard = (who: StaffPersona, card: Card) =>
  who.roles.includes("superadmin") || who.roles.includes(card.ownerRole);
const AGENT_UNSAFE = /ต้นทุน|กำไร|มาร์จิ้น|margin|โรงงาน|factory|profit|cost/i;

/* --------------------------------------------------------------------------------------- handlers */

const leadEtag = (lead: Lead) => `W/"${lead.id}.${Date.parse(lead.updatedAt)}"`;

export const salesDeskHandlers = [
  /* reps */
  http.get("*/v1/admin/sales/reps", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales.pipeline.manage")) return forbidden();
    const data: Rep[] = reps.map((rep) => ({
      userId: rep.userId,
      displayName: rep.displayName,
      agent: rep.agent,
      assignable: rep.assignable,
      openLeads: staffLeads.filter((lead) => lead.agent.id === rep.agent?.id && !["won", "lost"].includes(lead.stage))
        .length,
      openInbound: inboundRows.filter(
        (row) => row.assignee?.id === rep.userId && ["assigned", "contacted"].includes(row.status),
      ).length,
    }));
    return HttpResponse.json(data);
  }),

  /* inbound */
  http.post("*/v1/admin/sales/inbound/actions/bulk-assign", async ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales.pipeline.manage")) return forbidden();
    const body = (await request.json()) as Schemas["BulkAssignSalesInboundDto"];
    if (!body.ids?.length || body.ids.length > 100) return invalid("ids", "เลือก 1–100 รายการ");
    const assigned: Inbound[] = [];
    const skipped: string[] = [];
    for (const id of body.ids) {
      const row = inboundRows.find((candidate) => candidate.id === id);
      const result = row ? assign(who, row, body.repUserId, body.reason) : null;
      if (!row || result instanceof Response) skipped.push(id);
      else assigned.push(result!);
    }
    return HttpResponse.json({ assigned, skipped } satisfies Schemas["BulkAssignResultDto"]);
  }),

  http.get("*/v1/admin/sales/inbound", ({ request }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const statuses = url.searchParams.get("status")?.split(",").filter(Boolean) ?? [];
    const source = url.searchParams.get("source");
    const assigneeId = url.searchParams.get("assigneeId");
    const unassigned = url.searchParams.get("unassigned") === "true";
    const breached = url.searchParams.get("breached") === "true";
    const minScore = url.searchParams.get("minScore");
    const sort = url.searchParams.get("sort") ?? "due";
    const desc = url.searchParams.get("order") !== "asc";
    const rows = inboundRows
      .map(scoredInbound)
      .filter((row) => isManager(who) || row.assignee?.id === who.id)
      .filter((row) => !statuses.length || statuses.includes(row.status))
      .filter((row) => !source || row.source === source)
      .filter((row) => !assigneeId || row.assignee?.id === assigneeId)
      .filter((row) => !unassigned || row.assignee === null)
      .filter((row) => !breached || slaBreached(row))
      .filter((row) => minScore === null || (row.score !== null && row.score >= Number(minScore)))
      .filter((row) => matchesQuery(q, row.contactName, row.organisationName, row.sourceRef, row.need))
      .map(withSla)
      .sort((a, b) =>
        sort === "score"
          ? ((a.score ?? -1) - (b.score ?? -1)) * (desc ? -1 : 1) ||
            Date.parse(a.firstResponseDueAt) - Date.parse(b.firstResponseDueAt)
          : sort === "createdAt"
            ? (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * (desc ? -1 : 1)
            : Date.parse(a.firstResponseDueAt) - Date.parse(b.firstResponseDueAt),
      );
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  /**
   * Mock-only (D-471): runs the job `sales.capture_studio_idle` now, so a journey can see a saved design that was not
   * ordered arrive in the pool. Reached through the admin BFF like any admin path; a sales manager only.
   */
  http.post("*/v1/admin/mock-jobs/sales.capture_studio_idle", ({ request }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who || !isManager(who)) return forbidden();
    return HttpResponse.json({ captured: runStudioIdleJob() });
  }),

  http.post("*/v1/admin/sales/inbound", async ({ request }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const body = (await request.json()) as Schemas["CreateSalesInboundDto"];
    if (!body.contactName?.trim()) return invalid("contactName", "กรอกชื่อผู้ติดต่อ", "required");
    if (!body.contactPhone && !body.contactEmail)
      return invalid("contactPhone", "กรอกเบอร์โทรหรืออีเมลอย่างน้อยหนึ่งอย่าง", "required");
    const row = inbound({
      id: nextId("sinb"),
      source: "manual",
      contactName: body.contactName.trim(),
      contactPhone: body.contactPhone ?? null,
      contactEmail: body.contactEmail ?? null,
      organisationName: body.organisationName ?? null,
      need: body.need ?? null,
      createdAt: bangkokIso(),
      firstResponseDueAt: bangkokIso(240),
    });
    inboundRows.unshift(row);
    const target = isManager(who) ? body.assigneeUserId : who.id;
    if (target) assign(who, row, target);
    return HttpResponse.json(withSla(row), { status: 201 });
  }),

  http.get("*/v1/admin/sales/inbound/:inboundId", ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const row = inboundRows.find((candidate) => candidate.id === params.inboundId);
    if (!row || (!isManager(who) && row.assignee?.id !== who.id)) return notFound("รายการ");
    return HttpResponse.json(withSla(row));
  }),

  http.post("*/v1/admin/sales/inbound/:inboundId/actions/assign", async ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales.pipeline.manage")) return forbidden();
    const row = inboundRows.find((candidate) => candidate.id === params.inboundId);
    if (!row) return notFound("รายการ");
    const body = (await request.json().catch(() => ({}))) as Schemas["AssignSalesInboundDto"];
    const result = assign(who, row, body.repUserId, body.reason);
    return result instanceof Response ? result : HttpResponse.json(withSla(result));
  }),

  http.post("*/v1/admin/sales/inbound/:inboundId/actions/mark-contacted", async ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const row = inboundRows.find((candidate) => candidate.id === params.inboundId);
    if (!row || (!isManager(who) && row.assignee?.id !== who.id)) return notFound("รายการ");
    if (row.status !== "assigned") return problem(409, "sales.inbound_closed", "รายการนี้ปิดแล้ว");
    const body = (await request.json().catch(() => ({}))) as { note?: string | null };
    row.status = "contacted";
    row.firstRespondedAt = bangkokIso();
    row.statusNote = body.note ?? null;
    row.updatedAt = bangkokIso();
    if (row.leadId) {
      const lead = staffLeads.find((candidate) => candidate.id === row.leadId);
      if (lead && lead.stage === "new") {
        addActivity(lead.id, {
          kind: "stage_change",
          body: null,
          author: "system",
          event: null,
          fromStage: "new",
          toStage: "contacted",
          agentQuoteId: null,
          occurredAt: bangkokIso(),
        });
        lead.stage = "contacted";
        lead.stageChangedAt = bangkokIso();
        lead.updatedAt = bangkokIso();
      }
    }
    return HttpResponse.json(withSla(row));
  }),

  http.post("*/v1/admin/sales/inbound/:inboundId/actions/disqualify", async ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const row = inboundRows.find((candidate) => candidate.id === params.inboundId);
    if (!row || (!isManager(who) && row.assignee?.id !== who.id)) return notFound("รายการ");
    if (row.status === "converted_to_lead" || row.status === "disqualified")
      return problem(409, "sales.inbound_closed", "รายการนี้ปิดแล้ว");
    const body = (await request.json()) as { reason?: Schemas["SalesInboundDisqualifyReason"]; note?: string | null };
    if (!body.reason) return invalid("reason", "เลือกเหตุผล", "required");
    row.status = "disqualified";
    row.disqualifiedReason = body.reason;
    row.statusNote = body.note ?? null;
    row.updatedAt = bangkokIso();
    return HttpResponse.json(withSla(row));
  }),

  http.post("*/v1/admin/sales/inbound/:inboundId/actions/convert", ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const row = inboundRows.find((candidate) => candidate.id === params.inboundId);
    if (!row || (!isManager(who) && row.assignee?.id !== who.id)) return notFound("รายการ");
    if (row.status === "converted_to_lead" || row.status === "disqualified" || row.status === "new")
      return problem(409, "sales.inbound_closed", "รายการนี้ปิดแล้ว");
    if (!row.leadId) return problem(409, "agents.lead_unavailable", "ลงทะเบียนผู้มุ่งหวังรายนี้ไม่ได้");
    row.status = "converted_to_lead";
    row.firstRespondedAt ??= bangkokIso();
    row.updatedAt = bangkokIso();
    return HttpResponse.json(withSla(row));
  }),

  /* leads */
  http.get("*/v1/admin/sales/leads", ({ request }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const url = new URL(request.url);
    const kind = url.searchParams.get("agentKind") ?? "employee";
    const agentId = url.searchParams.get("agentId");
    const view = url.searchParams.get("view") ?? "open";
    const stage = url.searchParams.get("stage");
    const minScore = url.searchParams.get("minScore");
    const q = url.searchParams.get("q") ?? undefined;
    const source = (kind === "freelance" ? freelanceLeads() : staffLeads)
      .filter((lead) => visible(who, lead))
      .filter((lead) => !agentId || lead.agent.id === agentId)
      .filter((lead) =>
        view === "closed"
          ? ["won", "lost"].includes(lead.stage)
          : view === "follow_up_today"
            ? Boolean(lead.nextFollowUpAt) && Date.parse(lead.nextFollowUpAt!) < Date.now() + 24 * 60 * MINUTE
            : view === "protection_ending"
              ? lead.status === "registered" && Date.parse(lead.protectedUntil) < Date.now() + 14 * 24 * 60 * MINUTE
              : !["won", "lost"].includes(lead.stage),
      )
      .filter((lead) => !stage || lead.stage === stage)
      .filter((lead) => matchesQuery(q, lead.contactName, lead.organisationName, lead.phone, lead.email))
      .map(scoredLead)
      .filter((lead) => minScore === null || (lead.score !== null && lead.score >= Number(minScore)));
    const sort = url.searchParams.get("sort") ?? "updatedAt";
    const order = url.searchParams.get("order") === "asc" ? 1 : -1;
    const key = (lead: Lead) => {
      const value = (lead as Record<string, unknown>)[sort];
      return sort === "expectedValue" || sort === "score" ? Number(value ?? -1) : Date.parse(String(value ?? "")) || 0;
    };
    source.sort((a, b) => (key(a) - key(b)) * order);
    return HttpResponse.json({ data: source, meta: { nextCursor: null } });
  }),

  http.post("*/v1/admin/sales/leads", async ({ request }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const body = (await request.json()) as Schemas["CreateSalesLeadDto"];
    const agent = isManager(who)
      ? (reps.find((rep) => rep.agent?.id === body.agentId)?.agent ?? myAgent(who))
      : myAgent(who);
    if (!agent) return problem(403, "sales.no_employee_agent", "บัญชีของคุณยังไม่มีรหัสตัวแทนพนักงาน");
    if (!body.contactName?.trim()) return invalid("contactName", "กรอกชื่อ", "required");
    const lead = staffLead({
      id: nextId("slead"),
      agent,
      contactName: body.contactName.trim(),
      organisationName: body.organisationName ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      expectedValue: body.expectedValue ?? null,
      nextFollowUpAt: body.nextFollowUpAt ?? null,
      note: body.note ?? null,
    });
    staffLeads.unshift(lead);
    activities.set(lead.id, seedActivities(lead));
    return HttpResponse.json(scoredLead(lead), { status: 201 });
  }),

  http.get("*/v1/admin/sales/leads/:leadId/activities", ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const lead = findLead(params.leadId);
    if (!lead || !visible(who, lead)) return notFound("ลูกค้ามุ่งหวัง");
    return HttpResponse.json({ data: activities.get(lead.id) ?? [], meta: { nextCursor: null } });
  }),

  http.post("*/v1/admin/sales/leads/:leadId/activities", async ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const lead = staffLeads.find((candidate) => candidate.id === params.leadId);
    if (!lead)
      return findLead(params.leadId)
        ? problem(409, "sales.lead_read_only", "ดูได้อย่างเดียว")
        : notFound("ลูกค้ามุ่งหวัง");
    if (!visible(who, lead)) return notFound("ลูกค้ามุ่งหวัง");
    const body = (await request.json()) as Schemas["AddAgentLeadActivityDto"];
    if (!body.body?.trim()) return invalid("body", "เขียนสิ่งที่คุยกัน", "required");
    const entry: Activity = {
      id: nextId("sact"),
      kind: body.kind,
      body: body.body.trim(),
      author: "agent",
      event: null,
      fromStage: null,
      toStage: null,
      agentQuoteId: null,
      occurredAt: body.occurredAt ?? bangkokIso(),
    };
    activities.set(lead.id, [entry, ...(activities.get(lead.id) ?? [])]);
    if (body.nextFollowUpAt !== undefined) lead.nextFollowUpAt = body.nextFollowUpAt;
    lead.updatedAt = bangkokIso();
    return HttpResponse.json(entry, { status: 201 });
  }),

  http.post("*/v1/admin/sales/leads/:leadId/actions/change-stage", async ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const lead = staffLeads.find((candidate) => candidate.id === params.leadId);
    if (!lead)
      return findLead(params.leadId)
        ? problem(409, "sales.lead_read_only", "ดูได้อย่างเดียว")
        : notFound("ลูกค้ามุ่งหวัง");
    if (!visible(who, lead)) return notFound("ลูกค้ามุ่งหวัง");
    const body = (await request.json()) as Schemas["ChangeAgentLeadStageDto"];
    if (lead.stage === "won" || lead.stage === "lost") return problem(409, "agents.lead_closed", "ปิดแล้ว");
    if (body.stage === "lost" && !body.lostReason) return invalid("lostReason", "เลือกเหตุผล", "required");
    addActivity(lead.id, {
      kind: "stage_change",
      body: body.note ?? null,
      author: "agent",
      event: body.stage === "lost" ? "lost" : null,
      fromStage: lead.stage,
      toStage: body.stage,
      agentQuoteId: null,
      occurredAt: bangkokIso(),
    });
    lead.stage = body.stage;
    lead.stageChangedAt = bangkokIso();
    lead.updatedAt = bangkokIso();
    if (body.stage === "lost") {
      lead.lostReason = body.lostReason ?? null;
      lead.lostNote = body.note ?? null;
      lead.status = "withdrawn";
    }
    return HttpResponse.json(scoredLead(lead));
  }),

  http.get("*/v1/admin/sales/leads/:leadId", ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const lead = findLead(params.leadId);
    if (!lead || !visible(who, lead)) return notFound("ลูกค้ามุ่งหวัง");
    return HttpResponse.json(scoredLead(lead), { headers: { ETag: leadEtag(lead) } });
  }),

  http.patch("*/v1/admin/sales/leads/:leadId", async ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    const lead = staffLeads.find((candidate) => candidate.id === params.leadId);
    if (!lead)
      return findLead(params.leadId)
        ? problem(409, "sales.lead_read_only", "ดูได้อย่างเดียว")
        : notFound("ลูกค้ามุ่งหวัง");
    if (!visible(who, lead)) return notFound("ลูกค้ามุ่งหวัง");
    const match = request.headers.get("if-match");
    if (!match) return problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
    if (match !== leadEtag(lead)) return problem(412, "concurrency.stale", "ข้อมูลเปลี่ยนแล้ว");
    Object.assign(lead, (await request.json()) as Schemas["UpdateAgentLeadDto"], { updatedAt: bangkokIso() });
    return HttpResponse.json(scoredLead(lead), { headers: { ETag: leadEtag(lead) } });
  }),

  /* quotes */
  http.get("*/v1/admin/sales/quotes", ({ request }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    ensureDesk(request);
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = agentQuoteRecords()
      .filter((record) => {
        const lead = findLead(record.lead.id);
        return lead && visible(who, lead) && (!leadId || lead.id === leadId);
      })
      .filter((record) => {
        const lead = findLead(record.lead.id)!;
        const agentId = url.searchParams.get("agentId");
        return !agentId || lead.agent.id === agentId;
      })
      .map((record) => agentQuoteDto(record, request))
      .filter(
        (row) => (!status || row.status === status) && matchesQuery(q, row.lead.contactName, row.quote.quoteCode),
      );
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.post("*/v1/admin/sales/quotes", async ({ request }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    ensureDesk(request);
    const body = (await request.json()) as Schemas["CreateAgentQuoteDto"];
    const lead = staffLeads.find((candidate) => candidate.id === body.leadId);
    if (!lead)
      return findLead(body.leadId)
        ? problem(409, "sales.lead_read_only", "ดูได้อย่างเดียว")
        : notFound("ลูกค้ามุ่งหวัง");
    if (!visible(who, lead)) return notFound("ลูกค้ามุ่งหวัง");
    const spec = defaultInstantSpec();
    if (!spec) return problem(503, "provider.unavailable", "คำนวณราคาไม่ได้ตอนนี้");
    const quantities = (body.configuration as { quantities?: number[] }).quantities;
    const created = createAgentQuote(
      lead.id,
      spec.productTypeCode,
      { ...spec.configuration, quantities: quantities?.length ? [quantities[0]!] : [1000] },
      body.deliveryPostcode,
    );
    if (created instanceof Response) return created;
    addActivity(lead.id, {
      kind: "quote_sent",
      body: null,
      author: "agent",
      event: null,
      fromStage: null,
      toStage: null,
      agentQuoteId: created.id,
      occurredAt: bangkokIso(),
    });
    if (lead.stage === "new" || lead.stage === "contacted") {
      addActivity(lead.id, {
        kind: "stage_change",
        body: null,
        author: "system",
        event: null,
        fromStage: lead.stage,
        toStage: "quoted",
        agentQuoteId: null,
        occurredAt: bangkokIso(),
      });
      lead.stage = "quoted";
      lead.stageChangedAt = bangkokIso();
    }
    lead.updatedAt = bangkokIso();
    return HttpResponse.json(agentQuoteDto(created, request), { status: 201 });
  }),

  http.get("*/v1/admin/sales/quotes/:agentQuoteId/discount-requests", ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    ensureDesk(request);
    const record = agentQuoteRecords().find((row) => row.id === params.agentQuoteId);
    const lead = record ? findLead(record.lead.id) : undefined;
    if (!record || !lead || !visible(who, lead)) return notFound("ใบเสนอราคา");
    return HttpResponse.json(discountRoundsOf(record.id));
  }),

  http.post("*/v1/admin/sales/quotes/:agentQuoteId/discount-requests", async ({ request, params }) => {
    const who = pipeline(staffPersonaOf(request));
    if (!who) return forbidden();
    ensureDesk(request);
    const record = agentQuoteRecords().find((row) => row.id === params.agentQuoteId);
    const lead = record ? staffLeads.find((candidate) => candidate.id === record.lead.id) : undefined;
    if (!record || !lead || !visible(who, lead)) return notFound("ใบเสนอราคา");
    const body = (await request.json()) as Schemas["RequestAgentDiscountDto"];
    const rounds = discountRoundsOf(record.id);
    if (rounds.some((r) => r.status === "open")) return problem(409, "quotes.discount_request_open", "มีคำขอที่รออยู่");
    const giveGet = [
      body.quantityChange,
      body.commitmentMonths,
      body.depositPct,
      body.cashWithinDays,
      body.leadTimeFlexDays,
      body.specChange,
    ];
    if (!giveGet.some((value) => value !== undefined && value !== null && value !== ""))
      return invalid("quantityChange", "give_get_required", "give_get_required");
    const saved = savedQuoteOf(record)!;
    const created = round({
      round: rounds.length + 1,
      requestedPct: body.requestedPct,
      quoteOptionId: body.quoteOptionId ?? quoteOptionIdOf(record),
      quantity: saved.quantity,
      reason: body.reason,
      reasonNote: body.reasonNote ?? null,
      quantityChange: body.quantityChange ?? null,
      commitment: body.commitment ?? "one_off",
      commitmentMonths: body.commitmentMonths ?? null,
      depositPct: body.depositPct ?? null,
      cashWithinDays: body.cashWithinDays ?? null,
      leadTimeFlexDays: body.leadTimeFlexDays ?? null,
      specChange: body.specChange ?? null,
      competitorSpec: body.competitorSpec ?? null,
      createdAt: bangkokIso(),
    });
    pushDiscountRound(record.id, created);
    openApproval(record.id, created, lead.agent, { id: who.id, displayName: who.displayName }, who.id, {
      listRevenue: Number(saved.netAmount),
      costRatio: 0.72,
      standardRatePct: 2,
      creditDays: 30,
      depositPct: Number(body.depositPct ?? 0),
    });
    addActivity(lead.id, {
      kind: "system",
      body: null,
      author: "system",
      event: "discount_requested",
      fromStage: null,
      toStage: null,
      agentQuoteId: record.id,
      occurredAt: bangkokIso(),
    });
    if (lead.stage !== "negotiating") {
      lead.stage = "negotiating";
      lead.stageChangedAt = bangkokIso();
    }
    return HttpResponse.json(created, { status: 201 });
  }),

  /* discount approvals */
  http.get("*/v1/admin/sales/discount-approvals/views", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_waterfall_views.read")) return forbidden();
    const url = new URL(request.url);
    const quoteId = url.searchParams.get("quoteId");
    const viewerId = url.searchParams.get("viewerId");
    const rows = views.filter(
      (row) => (!quoteId || row.quoteId === quoteId) && (!viewerId || row.viewer.id === viewerId),
    );
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.get("*/v1/admin/sales/discount-approvals", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "discount_approvals.read")) return forbidden();
    ensureDesk(request);
    const url = new URL(request.url);
    const statuses = url.searchParams.get("status")?.split(",").filter(Boolean) ?? [];
    const level = url.searchParams.get("level");
    const awaitingMe = url.searchParams.get("awaitingMe") === "true";
    const q = url.searchParams.get("q") ?? undefined;
    const rows = approvals
      .filter((a) => approvalVisible(who, a))
      .filter((a) => !statuses.length || statuses.includes(a.status))
      .filter((a) => !level || a.level === level)
      .filter(
        (a) => !awaitingMe || (a.status === "pending" && mayDecide(who, a.level) && a.requestedByUserId !== who.id),
      )
      .filter((a) => matchesQuery(q, a.lead.contactName, a.lead.organisationName, a.quoteCode, a.agent.code))
      .sort((a, b) =>
        a.status === "pending" && b.status !== "pending"
          ? -1
          : b.status === "pending" && a.status !== "pending"
            ? 1
            : Date.parse(a.dueAt) - Date.parse(b.dueAt),
      )
      .map(summaryOf);
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),

  http.post("*/v1/admin/sales/discount-approvals", async ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "discount_approvals.decide")) return forbidden();
    ensureDesk(request);
    const body = (await request.json()) as Schemas["OpenDiscountApprovalDto"];
    const existing = approvals.find((a) => a.requestId === body.discountRequestId);
    if (existing) return problem(409, "discount_approval.already_open", "มีรายการอนุมัติเปิดอยู่แล้ว");
    return problem(409, "agents.discount_request_closed", "คำขอส่วนลดนี้ปิดแล้ว");
  }),

  http.get("*/v1/admin/sales/discount-approvals/:approvalId/export", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "discount_approvals.export")) return forbidden();
    const a = findApproval(params.approvalId);
    if (!a) return notFound("รายการอนุมัติ");
    logView(who, a, "export");
    return HttpResponse.json({
      url: `data:text/csv;charset=utf-8,${encodeURIComponent("line,amount\r\nmock,0.00\r\n")}`,
      expiresAt: bangkokIso(5),
    } satisfies Schemas["DownloadUrlDto"]);
  }),

  http.post("*/v1/admin/sales/discount-approvals/:approvalId/actions/simulate", async ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "discount_approvals.read")) return forbidden();
    const a = findApproval(params.approvalId);
    if (!a || !approvalVisible(who, a)) return notFound("รายการอนุมัติ");
    const body = (await request.json()) as Schemas["SimulateDiscountApprovalDto"];
    const discount = Number(body.discountPct);
    if (!Number.isFinite(discount) || discount < 0 || discount > 50) return invalid("discountPct", "ระบุ 0–50");
    if (body.creditDays !== undefined && (body.creditDays < 0 || body.creditDays > 180))
      return invalid("creditDays", "ระบุ 0–180 วัน");
    const template = body.paymentTemplateKey;
    const deposit =
      body.depositPct !== undefined
        ? Number(body.depositPct)
        : template?.startsWith("deposit_50")
          ? 50
          : template === "full_upfront"
            ? 100
            : undefined;
    logView(who, a, "simulate");
    const result = waterfallFor(tierOf(who), a, discount, {
      creditDays: template === "full_upfront" ? 0 : body.creditDays,
      depositPct: deposit,
      ratePct: body.ratePct !== undefined ? Number(body.ratePct) : undefined,
      freeServicesAmount: body.freeServicesAmount !== undefined ? Number(body.freeServicesAmount) : undefined,
      paymentMethod: body.paymentMethod,
    });
    return HttpResponse.json(result satisfies Schemas["DiscountSimulationDto"]);
  }),

  http.post("*/v1/admin/sales/discount-approvals/:approvalId/actions/decide", async ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "discount_approvals.decide")) return forbidden();
    const key = request.headers.get("idempotency-key");
    if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key");
    if (idempotency.has(key)) return HttpResponse.json(idempotency.get(key) as object);
    const a = findApproval(params.approvalId);
    if (!a || !approvalVisible(who, a)) return notFound("รายการอนุมัติ");
    if (a.status !== "pending") return problem(409, "discount_approval.not_pending", "รายการนี้ตัดสินแล้ว");
    if (a.requestedByUserId === who.id)
      return problem(409, "discount_approval.self_approval", "อนุมัติคำขอของตัวเองไม่ได้");
    if (!mayDecide(who, a.level))
      return problem(403, "discount_approval.not_authorised", "ส่วนลดนี้เกินอำนาจอนุมัติของคุณ");
    const body = (await request.json()) as Schemas["DecideDiscountApprovalDto"];
    const roundRow = discountRoundsOf(a.agentQuoteId).find((r) => r.id === a.requestId)!;
    if ((body.decision === "reject" || body.decision === "counter") && !body.note?.trim())
      return invalid("note", "เขียนเหตุผลให้ผู้ขอทราบ", "required");
    if (body.decision === "approve") {
      const options = body.options ?? [];
      if (!options.length || options.length > 3) return invalid("options", "ต้องมี 1–3 ทางเลือก");
      if (options[0]!.kind !== "standard") return invalid("options.0.kind", "ทางเลือกแรกต้องเป็นค่าคอมปกติ");
      const standard = a.economics.standardRatePct;
      for (const [at, option] of options.entries()) {
        const d = Number(option.discountPct);
        const rate = option.kind === "standard" ? standard : Number(option.ratePct);
        if (option.kind !== "standard" && !Number.isFinite(rate)) return invalid(`options.${at}.ratePct`, "ระบุอัตรา");
        if (option.kind === "co_fund" && rate >= standard)
          return invalid(`options.${at}.ratePct`, "ค่าคอมแบบร่วมลดต้องต่ำกว่าอัตราปกติ");
        if (option.kind === "spiff" && rate <= standard)
          return invalid(`options.${at}.ratePct`, "ค่าคอมพิเศษต้องสูงกว่าอัตราปกติ");
        const f = figures(a.economics, d, { ratePct: rate });
        if (!mayDecide(who, levelOf(d, f.grossPct, a.negotiationHeavy)))
          return problem(403, "discount_approval.not_authorised", "ทางเลือกนี้เกินอำนาจอนุมัติของคุณ");
      }
      const net = a.economics.listRevenue;
      const valid = bangkokDayAt(7, 23, 59);
      const saved = savedQuoteOf(agentQuoteRecords().find((row) => row.id === a.agentQuoteId)!)!;
      roundRow.options = options.map((option, at) => {
        const d = Number(option.discountPct);
        const rate = option.kind === "standard" ? a.economics.standardRatePct : Number(option.ratePct);
        const after = net * (1 - d / 100);
        return {
          id: nextId("dopt"),
          position: at + 1,
          kind: option.kind,
          status: "offered",
          discountPct: pct(d),
          netAmount: money(after),
          ratePct: pct(rate),
          standardRatePct: pct(a.economics.standardRatePct),
          commissionAmount: money((after * rate) / 100),
          conditionsTh: `ราคานี้สำหรับ ${saved.quantity.toLocaleString("th-TH")} ใบ · ${roundRow.depositPct ? `มัดจำ ${Number(roundRow.depositPct)}% · ` : ""}สั่งภายใน ${thaiConditionsDate(valid)}`,
          conditionsEn: `For ${saved.quantity} pcs · order by ${valid.slice(0, 10)}`,
          validUntil: valid,
          acceptedAt: null,
        };
      });
      roundRow.status = "offered";
      roundRow.decisionNote = body.note ?? null;
      roundRow.decidedAt = bangkokIso();
      a.status = "approved";
      a.validUntil = valid;
      a.offered = roundRow.options.map((option) => ({
        optionId: option.id,
        kind: option.kind,
        discountPct: option.discountPct,
        ratePct: option.ratePct,
      }));
    } else {
      roundRow.status = "rejected";
      roundRow.decisionNote = body.note!.trim();
      roundRow.decidedAt = bangkokIso();
      a.status = body.decision === "counter" ? "countered" : "rejected";
      a.counter = body.decision === "counter" ? ((body.counter as Record<string, unknown>) ?? {}) : null;
    }
    a.decidedBy = { id: who.id, displayName: who.displayName };
    a.decidedAt = bangkokIso();
    a.decisionNote = body.note?.trim() || null;
    // The lead's timeline sees getpack's answer (P3 event `discount_options`).
    const event = body.decision === "approve" ? "discount_options" : null;
    const staff = staffLeads.find((lead) => lead.id === a.lead.id);
    if (staff && event)
      addActivity(staff.id, {
        kind: "system",
        body: null,
        author: "getpack",
        event,
        fromStage: null,
        toStage: null,
        agentQuoteId: a.agentQuoteId,
        occurredAt: bangkokIso(),
      });
    else if (event) {
      addAgentLeadActivity(a.lead.id, {
        kind: "system",
        author: "getpack",
        event,
        agentQuoteId: a.agentQuoteId,
        occurredAt: bangkokIso(),
      });
      moveAgentLeadForward(a.lead.id, "negotiating", null);
    }
    const dto = detailOf(a, who);
    idempotency.set(key, dto);
    return HttpResponse.json(dto);
  }),

  http.get("*/v1/admin/sales/discount-approvals/:approvalId", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "discount_approvals.read")) return forbidden();
    ensureDesk(request);
    const a = findApproval(params.approvalId);
    if (!a || !approvalVisible(who, a)) return notFound("รายการอนุมัติ");
    logView(who, a, "view");
    return HttpResponse.json(detailOf(a, who));
  }),

  /* dashboard */
  http.get("*/v1/admin/sales/dashboard/export", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales.pipeline.manage")) return forbidden();
    return HttpResponse.json({
      url: `data:text/csv;charset=utf-8,${encodeURIComponent("stage,count\r\nnew,120\r\n")}`,
      expiresAt: bangkokIso(5),
    } satisfies Schemas["DownloadUrlDto"]);
  }),
  http.get("*/v1/admin/sales/dashboard", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales.pipeline.manage")) return forbidden();
    return HttpResponse.json(dashboard(new URL(request.url)));
  }),

  /* negotiations */
  http.get("*/v1/admin/sales/negotiations/history", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_reports.read")) return forbidden();
    ensureDesk(request);
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId");
    const mine = approvals.filter((a) => !leadId || a.lead.id === leadId);
    const quotes = [...new Set(mine.map((a) => a.agentQuoteId))].map((agentQuoteId) => {
      const record = agentQuoteRecords().find((row) => row.id === agentQuoteId)!;
      const rounds = discountRoundsOf(agentQuoteId);
      const accepted = rounds.flatMap((r) => r.options).find((o) => o.status === "accepted");
      return {
        agentQuoteId,
        quoteCode: savedQuoteOf(record)?.quoteCode ?? null,
        sentAt: record.sentAt,
        rounds: rounds.length,
        acceptedDiscountPct: accepted?.discountPct ?? null,
        outcome: (record.status === "accepted" ? "won" : "open") as Schemas["SalesNegotiationOutcome"],
      };
    });
    const history: Schemas["NegotiationQuoteDto"][] = [
      ...quotes,
      {
        agentQuoteId: "00000000-0000-4000-8000-0000000b9a01",
        quoteCode: "QT-2026-000017",
        sentAt: bangkokDayAt(-70, 10),
        rounds: 2,
        acceptedDiscountPct: "5.00",
        outcome: "won",
      },
      {
        agentQuoteId: "00000000-0000-4000-8000-0000000b9a02",
        quoteCode: "QT-2026-000023",
        sentAt: bangkokDayAt(-45, 10),
        rounds: 3,
        acceptedDiscountPct: null,
        outcome: "lost",
      },
    ];
    const heavy = history.filter((row) => row.rounds >= 2).length >= 2;
    return HttpResponse.json({
      negotiationHeavy: heavy,
      minRounds: 2,
      minQuotes: 2,
      lastQuotes: 5,
      quotes: history.slice(0, 5),
      averageApprovedDiscountPct: "4.50",
      won: 1,
      lost: 1,
      lostReasons: [
        { reason: "price", count: 1 },
        { reason: "lead_time", count: 0 },
      ],
      lastCompetitor: {
        namedAt: bangkokDayAt(-1, 15),
        notes: "โรงพิมพ์ย่านบางนา เสนอกระดาษเกรดต่ำกว่า",
        price: "11500.00",
      },
    } satisfies Schemas["NegotiationHistoryDto"]);
  }),

  http.get("*/v1/admin/sales/negotiations/lost-to-price", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_reports.read")) return forbidden();
    const url = new URL(request.url);
    const row = (productClass: string, quantityBand: Schemas["SalesQuantityBand"], closed: number, lost: number) => ({
      productClass,
      quantityBand,
      closed,
      lostToPrice: lost,
      lostToPricePct: closed ? pct((lost / closed) * 100) : null,
    });
    return HttpResponse.json({
      from: url.searchParams.get("from") ?? bangkokDayAt(-90, 0).slice(0, 10),
      to: url.searchParams.get("to") ?? bangkokDayAt(0, 0).slice(0, 10),
      rows: [
        row("folding_carton", "lt_1k", 24, 3),
        row("folding_carton", "1k_10k", 31, 9),
        row("folding_carton", "10k_100k", 12, 6),
        row("corrugated", "lt_1k", 8, 1),
        row("corrugated", "1k_10k", 15, 5),
        row("corrugated", "gte_100k", 2, 1),
        row("label", "1k_10k", 11, 2),
        row("pouch", "10k_100k", 6, 0),
      ],
    } satisfies Schemas["LostToPriceDto"]);
  }),

  /* post-deal review */
  http.get("*/v1/admin/sales/post-deal-review", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_reports.read")) return forbidden();
    const url = new URL(request.url);
    const groupBy = (url.searchParams.get("groupBy") ?? "approver") as Schemas["SalesPostDealGroupBy"];
    const full = can(who, "discount_approvals.waterfall_full");
    const fig = (net: number, gm: number, ctb: number) =>
      full
        ? {
            visibility: "full" as const,
            netRevenue: money(net),
            grossMargin: money((net * gm) / 100),
            grossMarginPct: pct(gm),
            contribution: money((net * ctb) / 100),
            contributionPct: pct(ctb),
          }
        : { visibility: "margin_pct" as const, grossMarginPct: pct(gm), contributionPct: pct(ctb) };
    const deals = [
      [
        "QT-2026-000017",
        "EMP00024",
        "ธนา มุ่งมั่น (ข้อมูลจำลอง)",
        "ผู้จัดการฝ่ายขาย ตัวอย่าง (ข้อมูลจำลอง)",
        "แบรนด์สบู่ทดสอบ (ข้อมูลจำลอง)",
        "5.00",
        2,
        96000,
        21.4,
        19.8,
        92800,
        19.1,
        17.2,
      ],
      [
        "QT-2026-000021",
        MOCK_AGENT_CODE,
        "ตัวแทน ทดสอบ (ข้อมูลจำลอง)",
        "ผู้บริหาร ตัวอย่าง (ข้อมูลจำลอง)",
        "ร้านกาแฟบ้านสวน (ข้อมูลจำลอง)",
        "7.00",
        1,
        128000,
        17.9,
        12.6,
        131500,
        18.6,
        13.1,
      ],
      [
        "QT-2026-000026",
        "EMP00021",
        "วิภา ขายดี (ข้อมูลจำลอง)",
        "ผู้จัดการฝ่ายขาย ตัวอย่าง (ข้อมูลจำลอง)",
        "โรงคั่วกาแฟทดสอบ (ข้อมูลจำลอง)",
        "3.00",
        3,
        210000,
        23.5,
        21.0,
        204000,
        20.2,
        17.4,
      ],
    ] as const;
    const rows: Schemas["PostDealRowDto"][] = deals.map((d, at) => ({
      approvalId: mockId("pdeal", at + 1),
      quoteCode: d[0],
      agentCode: d[1],
      agentName: d[2],
      approverName: d[3],
      customerName: d[4],
      approvedDiscountPct: d[5],
      orders: d[6],
      approved: fig(d[7], d[8], d[9]),
      actual: fig(d[10], d[11], d[12]),
    }));
    const keyOf = (row: Schemas["PostDealRowDto"]) =>
      groupBy === "approver" ? (row.approverName ?? "—") : groupBy === "agent" ? row.agentName : row.customerName;
    const groups = [...new Set(rows.map(keyOf))].map((key) => {
      const members = deals.filter((_, at) => keyOf(rows[at]!) === key);
      const avg = (index: number) => members.reduce((sum, d) => sum + (d[index] as number), 0) / members.length;
      const sum = (index: number) => members.reduce((total, d) => total + (d[index] as number), 0);
      return {
        key,
        deals: members.length,
        approved: fig(sum(7), avg(8), avg(9)),
        actual: fig(sum(10), avg(11), avg(12)),
      };
    });
    return HttpResponse.json({
      from: url.searchParams.get("from") ?? bangkokDayAt(-90, 0).slice(0, 10),
      to: url.searchParams.get("to") ?? bangkokDayAt(0, 0).slice(0, 10),
      groupBy,
      deals: rows,
      groups,
    } satisfies Schemas["PostDealReviewDto"]);
  }),

  /* playbook */
  http.get("*/v1/admin/sales/playbook", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_playbook.manage")) return forbidden();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const key = url.searchParams.get("key");
    const audience = url.searchParams.get("audience");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = cards
      .filter((card) => (!status || card.status === status) && (!key || card.key === key))
      .filter((card) => !audience || card.audiences.includes(audience as Card["audiences"][number]))
      .filter((card) => matchesQuery(q, card.key, card.titleTh, card.bodyTh))
      .sort((a, b) => a.sort - b.sort || b.version - a.version)
      .map(cardDto);
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 50),
      }),
    );
  }),

  http.post("*/v1/admin/sales/playbook", async ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_playbook.manage")) return forbidden();
    const body = (await request.json()) as Schemas["CreatePlaybookCardDto"];
    const versions = cards.filter((card) => card.key === body.key);
    if (versions.some((card) => card.status === "draft"))
      return problem(409, "sales_playbook.not_draft", "มีฉบับร่างอยู่แล้ว");
    const latest = [...versions].sort((a, b) => b.version - a.version)[0];
    const ownerRole = latest?.ownerRole ?? body.ownerRole ?? "marketing";
    if (!who.roles.includes("superadmin") && !who.roles.includes(ownerRole)) return forbidden();
    const next = {
      ...(latest ?? {
        contexts: ["all"],
        audiences: ["agent", "rep"],
        titleTh: body.titleTh ?? body.key,
        titleEn: null,
        bodyTh: body.bodyTh ?? "",
        bodyEn: null,
        suggestedReplies: [],
        sort: 200,
        source: null,
      }),
      ...body,
      suggestedReplies: (body.suggestedReplies ?? latest?.suggestedReplies ?? []).map((reply) => ({
        th: reply.th,
        en: reply.en ?? null,
      })),
      id: nextId("pbk"),
      key: body.key,
      version: (latest?.version ?? 0) + 1,
      status: "draft" as const,
      submitted: false,
      ownerRole,
      changeNote: body.changeNote ?? null,
      submittedAt: null,
      publishedAt: null,
      updatedAt: bangkokIso(),
      authorId: who.id,
      submittedById: null,
    } as (typeof cards)[number];
    cards.push(next);
    return HttpResponse.json(cardDto(next), { status: 201 });
  }),

  http.get("*/v1/admin/sales/playbook/:cardId", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_playbook.manage")) return forbidden();
    const card = cards.find((candidate) => candidate.id === params.cardId);
    return card ? HttpResponse.json(cardDto(card)) : notFound("การ์ด");
  }),

  http.patch("*/v1/admin/sales/playbook/:cardId", async ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_playbook.manage")) return forbidden();
    const card = cards.find((candidate) => candidate.id === params.cardId);
    if (!card) return notFound("การ์ด");
    if (!ownsCard(who, card)) return forbidden();
    if (card.status !== "draft") return problem(409, "sales_playbook.not_draft", "แก้ไขได้เฉพาะฉบับร่าง");
    const body = (await request.json()) as Schemas["UpdatePlaybookCardDto"];
    const audiences = body.audiences ?? card.audiences;
    const text = [
      body.titleTh ?? card.titleTh,
      body.bodyTh ?? card.bodyTh,
      ...(body.suggestedReplies ?? []).map((r) => r.th),
    ].join(" ");
    if (audiences.includes("agent") && AGENT_UNSAFE.test(text))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        {
          path: "bodyTh",
          code: "agent_unsafe_wording",
          message: "การ์ดที่ตัวแทนเห็นใช้คำเรื่องต้นทุน กำไร หรือโรงงานไม่ได้",
        },
      ]);
    Object.assign(card, body, {
      suggestedReplies: (body.suggestedReplies ?? card.suggestedReplies).map((reply) => ({
        th: reply.th,
        en: reply.en ?? null,
      })),
      submitted: false,
      submittedAt: null,
      submittedById: null,
      updatedAt: bangkokIso(),
    });
    return HttpResponse.json(cardDto(card));
  }),

  http.post("*/v1/admin/sales/playbook/:cardId/actions/submit", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_playbook.manage")) return forbidden();
    const card = cards.find((candidate) => candidate.id === params.cardId);
    if (!card) return notFound("การ์ด");
    if (!ownsCard(who, card)) return forbidden();
    if (card.status !== "draft") return problem(409, "sales_playbook.not_draft", "ส่งตรวจได้เฉพาะฉบับร่าง");
    Object.assign(card, { submitted: true, submittedAt: bangkokIso(), submittedById: who.id, updatedAt: bangkokIso() });
    return HttpResponse.json(cardDto(card));
  }),

  http.post("*/v1/admin/sales/playbook/:cardId/actions/publish", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_playbook.publish")) return forbidden();
    const card = cards.find((candidate) => candidate.id === params.cardId);
    if (!card) return notFound("การ์ด");
    if (card.status !== "draft") return problem(409, "sales_playbook.not_draft", "เผยแพร่ได้เฉพาะฉบับร่าง");
    if (!card.submitted) return problem(409, "sales_playbook.not_submitted", "ต้องส่งตรวจก่อนเผยแพร่");
    if (card.authorId === who.id || card.submittedById === who.id)
      return problem(409, "sales_playbook.maker_checker", "ผู้เขียนหรือผู้ส่งตรวจเผยแพร่เองไม่ได้");
    for (const other of cards)
      if (other.key === card.key && other.status === "published")
        Object.assign(other, { status: "retired", updatedAt: bangkokIso() });
    Object.assign(card, { status: "published", publishedAt: bangkokIso(), updatedAt: bangkokIso() });
    return HttpResponse.json(cardDto(card));
  }),

  http.post("*/v1/admin/sales/playbook/:cardId/actions/retire", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "sales_playbook.manage")) return forbidden();
    const card = cards.find((candidate) => candidate.id === params.cardId);
    if (!card) return notFound("การ์ด");
    if (!ownsCard(who, card)) return forbidden();
    if (card.status !== "published") return problem(409, "sales_playbook.not_draft", "เลิกใช้ได้เฉพาะฉบับที่เผยแพร่");
    Object.assign(card, { status: "retired", updatedAt: bangkokIso() });
    return HttpResponse.json(cardDto(card));
  }),
];

/* ---------------------------------------------------------------------------------- inbound helpers */

const slaBreached = (row: Inbound) =>
  row.slaBreachedAt !== null ||
  (row.firstRespondedAt === null && Date.parse(row.firstResponseDueAt) < Date.now()) ||
  (row.firstRespondedAt !== null && Date.parse(row.firstRespondedAt) > Date.parse(row.firstResponseDueAt));
const withSla = (row: Inbound): Inbound => ({ ...scoredInbound(row), slaBreached: slaBreached(row) });

/** Assignment (D-469): round robin when no rep is named; moving from another rep needs a reason. */
function assign(who: StaffPersona, row: Inbound, repUserId?: string, reason?: string): Inbound | Response {
  if (row.status === "converted_to_lead" || row.status === "disqualified")
    return problem(409, "sales.inbound_closed", "รายการนี้ปิดแล้ว");
  let rep: RepRecord | undefined;
  if (repUserId) {
    rep = repOfUser(repUserId);
    if (!rep || !rep.assignable || !rep.agent)
      return problem(422, "sales.rep_unavailable", "พนักงานขายคนนี้รับงานไม่ได้");
  } else {
    const open = (candidate: RepRecord) =>
      inboundRows.filter((r) => r.assignee?.id === candidate.userId && ["assigned", "contacted"].includes(r.status))
        .length;
    rep = reps
      .filter((candidate) => candidate.assignable && candidate.agent)
      .sort((a, b) => open(a) - open(b) || a.lastAssignedAt - b.lastAssignedAt)[0];
    if (!rep) return problem(409, "sales.no_rep_available", "ไม่มีพนักงานขายที่รับงานได้");
  }
  if (row.assignee && row.assignee.id !== rep.userId && !reason?.trim())
    return invalid("reason", "ระบุเหตุผลที่ย้ายงานจากพนักงานขายอีกคน", "required");
  if (row.assignee?.id === rep.userId) return row;
  rep.lastAssignedAt = Date.now();
  row.assignee = { id: rep.userId, displayName: rep.displayName };
  row.assignedAt = bangkokIso();
  row.status = row.status === "new" ? "assigned" : row.status;
  row.statusNote = reason?.trim() || row.statusNote;
  row.updatedAt = bangkokIso();
  // The lead is registered for the rep's employee agent; a contact that cannot be a lead keeps the assignment.
  const taken = ["+66899999999", "+66811111111"].includes(row.contactPhone ?? "");
  if (taken) row.leadRefusal = "unavailable";
  else if (row.leadId) {
    const lead = staffLeads.find((candidate) => candidate.id === row.leadId);
    if (lead) lead.agent = rep.agent!;
  } else {
    const lead = staffLead({
      id: nextId("slead"),
      agent: rep.agent!,
      contactName: row.contactName,
      organisationName: row.organisationName,
      phone: row.contactPhone,
      email: row.contactEmail,
      note: row.need,
      source: "staff",
    });
    staffLeads.unshift(lead);
    activities.set(lead.id, seedActivities(lead));
    row.leadId = lead.id;
    row.leadRefusal = null;
  }
  void who;
  return row;
}
