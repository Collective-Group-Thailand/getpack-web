/**
 * The published partners surface (packio-api B2.2), mocked statefully: factories and their
 * onboarding (D-011, D-041, D-171), KYC, bank accounts (D-033), capability and machines,
 * delivery zones, capacity, the commercial configuration — pricing arrangement (D-042),
 * participations (D-043), tolerance (D-021, D-163) and payout policy (D-022, D-164) — agreements,
 * site visits, price lists and price proposals (D-040, D-044). Typed by `Schemas`.
 *
 * The factories are the ones the other mocks already name (F001–F004 in orders and RFQs), plus
 * applicants. Versioned terms follow the contract: a new version is `approved` when no approval is
 * needed, else `proposed` with an approval opened in the approvals mock — tolerance and payout
 * overrides and mode changes go to their policies (D-173, `partner_pricing_mode_change`).
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, type StaffPersona } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import { PRODUCT_TYPES } from "./catalog";
import { FACTORY } from "./commerce";
import { registerQueue } from "./console";
import { openApproval } from "./platform";
import { etagOf } from "./tables";

type Factory = Schemas["FactoryDto"];
type Step = Schemas["OnboardingStepDto"];
type Proposal = Schemas["PriceProposalDto"];
type ProposalLine = Schemas["PriceProposalLineDto"];
type PriceList = Schemas["PriceListDto"];
type Row = Schemas["PriceRowDto"];

const DAY = 24 * 60;
export const typeId = (code: string) => PRODUCT_TYPES.find((type) => type.code === code)!.id;
const now = () => bangkokIso();

const STEPS: Schemas["OnboardingStep"][] = [
  "application",
  "kyc",
  "bank_account",
  "capability",
  "capacity",
  "delivery_zones",
  "pricing_arrangement",
  "tolerance",
  "payout_policy",
  "agreement",
  "site_visit",
  "trial",
  "activation",
];

/* ---------------------------------------------------------------------------------- seeds */

type Seed = {
  id: string;
  code: string;
  legalName: string;
  tradeName: string;
  status: Factory["status"];
  mode: Factory["onboardingMode"];
  /** Product type code → tier (D-043). The RFQ mock reads the same map. */
  tiers: Record<string, Schemas["ParticipationTier"]>;
  ownership: Schemas["PriceOwnershipMode"];
  trialJobs?: number;
};

const SEEDS: Seed[] = [
  {
    id: FACTORY.id,
    code: "F001",
    legalName: "บริษัท โรงงานพาร์ตเนอร์ ตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    tradeName: FACTORY.name,
    status: "active",
    mode: "self_service",
    tiers: { folding_carton: "A", paper_bag: "C", custom_tape: "C", pop_display: "C", food_packaging: "B" },
    ownership: "factory_price_list",
  },
  {
    id: mockId("fac", 2),
    code: "F002",
    legalName: "บริษัท โรงงานกล่องแข็ง ตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    tradeName: "โรงงานกล่องแข็ง ตัวอย่าง (ข้อมูลจำลอง)",
    status: "active",
    mode: "assisted",
    tiers: { rigid_box: "C", paper_bag: "B", tube: "C", pop_display: "C" },
    ownership: "platform_rate_card",
  },
  {
    id: mockId("fac", 3),
    code: "F003",
    legalName: "บริษัท โรงงานบรรจุภัณฑ์อาหาร ตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    tradeName: "โรงงานบรรจุภัณฑ์อาหาร ตัวอย่าง (ข้อมูลจำลอง)",
    status: "active",
    mode: "self_service",
    tiers: { food_packaging: "C", paper_bag: "C", tube: "C" },
    ownership: "factory_price_list",
  },
  {
    id: mockId("fac", 4),
    code: "F004",
    legalName: "ห้างหุ้นส่วน โรงงานสิ่งพิมพ์ ตัวอย่าง (ข้อมูลจำลอง)",
    tradeName: "โรงงานสิ่งพิมพ์ ตัวอย่าง (ข้อมูลจำลอง)",
    status: "trial",
    mode: "assisted",
    tiers: { folding_carton: "B", rigid_box: "C", custom_tape: "C", other: "C" },
    ownership: "platform_rate_card",
    trialJobs: 2,
  },
  {
    id: mockId("fac", 5),
    code: "F005",
    legalName: "บริษัท ลูกฟูกใหม่ ตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    tradeName: "ลูกฟูกใหม่ ตัวอย่าง (ข้อมูลจำลอง)",
    status: "applied",
    mode: "self_service",
    tiers: { corrugated: "A" },
    ownership: "factory_price_list",
  },
  {
    id: mockId("fac", 6),
    code: "F006",
    legalName: "บริษัท ฉลากดี ตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    tradeName: "ฉลากดี ตัวอย่าง (ข้อมูลจำลอง)",
    status: "under_review",
    mode: "assisted",
    tiers: { label_sticker: "A", tag_sleeve: "B" },
    ownership: "platform_rate_card",
  },
  {
    id: mockId("fac", 7),
    code: "F007",
    legalName: "บริษัท ซองพิมพ์ ตัวอย่าง จำกัด (ข้อมูลจำลอง)",
    tradeName: "ซองพิมพ์ ตัวอย่าง (ข้อมูลจำลอง)",
    status: "suspended",
    mode: "self_service",
    tiers: { flexible_pouch: "A" },
    ownership: "factory_price_list",
  },
];

/** The tier of each factory per product type code (D-043) — the RFQ desk asks the same thing. */
export const PARTICIPATION: Record<string, Record<string, Schemas["ParticipationTier"]>> = Object.fromEntries(
  SEEDS.filter((seed) => ["active", "trial"].includes(seed.status)).map((seed) => [seed.id, seed.tiers]),
);

/* --------------------------------------------------------------------------------- stores */

export type Store = {
  factory: Factory;
  steps: Step[];
  addresses: Schemas["FactoryAddressDto"][];
  contacts: Schemas["FactoryContactDto"][];
  kyc: Schemas["KycDocumentDto"][];
  banks: Schemas["BankAccountDto"][];
  capabilities: Schemas["CapabilityDto"][];
  machines: Schemas["MachineDto"][];
  zones: Schemas["DeliveryZoneDto"][];
  config: Schemas["FactoryConfigurationDto"];
  agreements: Schemas["AgreementStatusDto"][];
  visits: Schemas["SiteVisitDto"][];
  priceLists: PriceList[];
  overrides: Map<string, number>;
};

/** Every factory by id. The partner surface (`mocks/partner`) reads and writes the same rows. */
export const stores = new Map<string, Store>();
let seq = 100;
export const nextId = (ns: string) => mockId(ns, seq++);

const ZONES = [
  ["BKK", "กรุงเทพฯ และปริมณฑล"],
  ["CEN", "ภาคกลาง"],
  ["N", "ภาคเหนือ"],
  ["NE", "ภาคตะวันออกเฉียงเหนือ"],
  ["E", "ภาคตะวันออก"],
  ["S", "ภาคใต้"],
].map(([code, nameTh], index) => ({ id: mockId("zon", index + 1), code: code!, nameTh: nameTh!, nameEn: code! }));

const version = <T extends object>(values: T, reason = "ตกลงกับโรงงานตอนเริ่มต้น") => ({
  approvalRequestId: null,
  effectiveFrom: bangkokIso(-DAY * 60),
  reason,
  status: "approved" as const,
  versionNo: 1,
  ...values,
});

/** Twelve digits plus the Thai tax id check digit, so the partner zone's checksum accepts them. */
function withCheckDigit(twelve: string): string {
  const sum = [...twelve].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
  return `${twelve}${(11 - (sum % 11)) % 10}`;
}

function stepsFor(seed: Seed): Step[] {
  // An applicant has not submitted its application yet (D-171: the Partner team created the
  // factory and invited its owner, who fills it in), so nothing is complete.
  const progress: Record<Factory["status"], number> = {
    applied: 0,
    under_review: 5,
    trial: 11,
    active: 13,
    suspended: 13,
    offboarded: 13,
  };
  const done = progress[seed.status];
  return STEPS.map((step, index) => ({
    step,
    status: index < done ? "approved" : index === done ? "in_progress" : "pending",
    completedAt: index < done ? bangkokIso(-DAY * (40 - index)) : null,
    enteredByStaff: seed.mode === "assisted" && index < done && index > 0,
    // Under review, the capability and capacity Packio entered still wait for the factory's
    // sign-off (the D-100 note) — what the partner zone's "review & sign off" is for.
    factorySignedOffAt:
      seed.mode === "assisted" && index < done && index > 0 && !(seed.status === "under_review" && index >= 3)
        ? bangkokIso(-DAY * (39 - index))
        : null,
    notes: null,
  }));
}

function build(seed: Seed, index: number): Store {
  const types = Object.keys(seed.tiers);
  const steps = stepsFor(seed);
  const factory: Factory = {
    id: seed.id,
    code: seed.code,
    legalName: seed.legalName,
    tradeName: seed.tradeName,
    taxId: withCheckDigit(`010555${String(100000 + index * 7919).slice(0, 6)}`),
    branchCode: "00000",
    juristicType: seed.legalName.startsWith("ห้างหุ้นส่วน") ? "partnership" : "company",
    isVatRegistered: true,
    vatRegisteredOn: "2018-01-15",
    lineGroupId: null,
    onboardingMode: seed.mode,
    status: seed.status,
    statusChangedAt: bangkokIso(-DAY * (10 + index)),
    activatedAt: ["active", "suspended"].includes(seed.status) ? bangkokIso(-DAY * 200) : null,
    offboardedAt: null,
    trialJobsCompleted: seed.trialJobs ?? (seed.status === "active" ? 3 : 0),
    onboarding: { done: steps.filter((step) => step.status === "approved").length, total: steps.length },
    updatedAt: bangkokIso(-DAY * (2 + index)),
  };
  const kycTypes: Schemas["KycDocType"][] = [
    "company_certificate",
    "vat_registration_pp20",
    "director_id",
    "bank_book",
  ];
  return {
    factory,
    steps,
    addresses: [
      {
        id: nextId("fad"),
        kind: "registered",
        line1: `${10 + index} ถนนตัวอย่าง (ข้อมูลจำลอง)`,
        line2: null,
        postcode: ["10110", "10400", "74000", "20000", "12000", "10500", "11000"][index] ?? "10110",
        subdistrictId: null,
        lat: null,
        lng: null,
      },
      {
        id: nextId("fad"),
        kind: "plant",
        line1: `นิคมอุตสาหกรรมตัวอย่าง ซอย ${index + 1} (ข้อมูลจำลอง)`,
        line2: null,
        postcode: "74000",
        subdistrictId: null,
        lat: 13.55,
        lng: 100.27,
      },
    ],
    contacts: [
      {
        id: nextId("fct"),
        name: `ผู้ประสานงาน ${seed.code} (ข้อมูลจำลอง)`,
        roleTitle: "ผู้จัดการฝ่ายขาย",
        phone: `02${String(5550000 + index * 11)}`,
        email: `contact.${seed.code.toLowerCase()}@factory.invalid`,
        isPrimary: true,
      },
    ],
    kyc: kycTypes.map((docType, at) => ({
      id: nextId("kyc"),
      docType,
      fileId: nextId("kyf"),
      issuedOn: "2025-01-10",
      expiresOn: docType === "director_id" ? "2030-01-01" : null,
      status: seed.status === "applied" ? "pending" : seed.status === "under_review" && at > 1 ? "pending" : "verified",
      verifiedAt:
        seed.status === "applied" || (seed.status === "under_review" && at > 1) ? null : bangkokIso(-DAY * 30),
      note: null,
    })),
    banks:
      seed.status === "applied"
        ? []
        : [
            {
              id: nextId("bnk"),
              bankCode: "014",
              accountName: seed.legalName,
              accountNoLast4: String(4321 + index).slice(-4),
              branchName: "สาขาตัวอย่าง",
              status: "active",
              duplicateOfOtherVendor: false,
              approvalRequestId: null,
              effectiveFrom: bangkokIso(-DAY * 100),
              createdAt: bangkokIso(-DAY * 110),
              verification: {
                calledAt: bangkokIso(-DAY * 105),
                calledNumberMasked: "02-xxx-x111",
                outcome: "confirmed",
              },
            },
          ],
    capabilities: types.map((code) => ({
      id: nextId("cap"),
      productTypeId: typeId(code),
      productTypeCode: code,
      printTypeId: null,
      minOrderQty: 500,
      maxOrderQty: 200000,
      maxSheetWidthMm: 720,
      maxSheetLengthMm: 1020,
      status: "active",
    })),
    machines: [
      {
        id: nextId("mch"),
        name: "Heidelberg Speedmaster (ข้อมูลจำลอง)",
        printTypeId: null,
        maxWidthMm: 720,
        maxLengthMm: 1020,
        details: "4 สี + เคลือบ",
        status: "active",
      },
      {
        id: nextId("mch"),
        name: "เครื่องไดคัท Bobst (ข้อมูลจำลอง)",
        printTypeId: null,
        maxWidthMm: 760,
        maxLengthMm: 1060,
        details: null,
        status: "active",
      },
    ],
    zones: ZONES.map((zone, at) => ({
      zoneId: zone.id,
      zoneCode: zone.code,
      schemeCode: "standard",
      serves: at < 3 + (index % 3),
      extraLeadDays: at === 0 ? 0 : at,
    })),
    config: {
      pricingArrangement: { current: version({ ownershipMode: seed.ownership }), upcoming: [] },
      participations: types.map((code) => ({
        productTypeId: typeId(code),
        productTypeCode: code,
        current: version({
          tier: seed.tiers[code]!,
          envelopeNote: seed.tiers[code] === "B" ? "ขนาดมาตรฐานเท่านั้น" : null,
        }),
        upcoming: [],
      })),
      tolerances: [
        {
          productTypeId: null,
          productTypeCode: null,
          current: version({ shortagePct: "5.0000", overagePct: "5.0000" }),
          upcoming:
            seed.code === "F002"
              ? [
                  {
                    approvalRequestId: mockId("appr", 4900),
                    effectiveFrom: bangkokIso(DAY * 14),
                    reason: "โรงงานขอเผื่อจำนวนเสียงานกล่องแข็ง",
                    status: "proposed",
                    versionNo: 2,
                    shortagePct: "8.0000",
                    overagePct: "5.0000",
                  },
                ]
              : [],
        },
      ],
      capacities: types.map((code) => ({
        productTypeId: typeId(code),
        productTypeCode: code,
        current: version({ capacityUnit: "sheets" as const, weeklyCapacity: String(8000 + index * 1500) + ".000" }),
        upcoming: [],
      })),
      payoutPolicy: {
        current: version({
          advancePct: "30.0000",
          advanceTrigger: "job_accepted" as const,
          balanceTrigger: "after_pod_and_claim_window" as const,
          claimWindowDays: 7,
          paymentTermsDays: 30,
          // D-022: 5 % retention; D-164: released 30 days after the claim window closes.
          retentionPct: "5.0000",
          retentionReleaseDays: 30,
        }),
        upcoming: [],
      },
    },
    agreements: [
      {
        key: "partner_agreement",
        name: "สัญญาพาร์ตเนอร์ Packio",
        versionNo: 2,
        effectiveFrom: bangkokIso(-DAY * 120),
        accepted: !["applied", "under_review"].includes(seed.status),
        acceptedAt: ["applied", "under_review"].includes(seed.status) ? null : bangkokIso(-DAY * 90),
        method: ["applied", "under_review"].includes(seed.status)
          ? null
          : seed.mode === "assisted"
            ? "signed_upload"
            : "e_acceptance",
        textTh: "ข้อความสัญญา (ข้อมูลจำลอง)",
        textEn: null,
      },
      {
        key: "data_processing",
        name: "ข้อตกลงการประมวลผลข้อมูลส่วนบุคคล (PDPA)",
        versionNo: 1,
        effectiveFrom: bangkokIso(-DAY * 120),
        accepted: ["active", "suspended"].includes(seed.status),
        acceptedAt: ["active", "suspended"].includes(seed.status) ? bangkokIso(-DAY * 90) : null,
        method: ["active", "suspended"].includes(seed.status) ? "e_acceptance" : null,
        textTh: "ข้อความข้อตกลง (ข้อมูลจำลอง)",
        textEn: null,
      },
    ],
    visits: ["active", "suspended", "trial"].includes(seed.status)
      ? [
          {
            id: nextId("svt"),
            visitedOn: bangkokIso(-DAY * 80).slice(0, 10),
            result: seed.status === "trial" ? "conditional" : "pass",
            checklistVersion: "2026.1",
            checklist: {
              safety: "pass",
              qualityControl: "pass",
              storage: seed.status === "trial" ? "fix" : "pass",
              capacityVerified: "pass",
            },
            inspectorIds: [],
            photoFileIds: [nextId("svp")],
            notes: seed.status === "trial" ? "ต้องจัดพื้นที่เก็บกระดาษให้ห่างความชื้น" : null,
            createdAt: bangkokIso(-DAY * 80),
          },
        ]
      : [],
    priceLists: types.map((code, at): PriceList => {
      const listId = nextId("prl");
      // Under review with assisted onboarding: the tier-B list Packio entered waits for the
      // factory's sign-off before it applies (D-100 note); the tier-A type waits for the rate
      // card Packio sent (proposal 4, D-042 a).
      const pendingEntry = seed.status === "under_review" && seed.mode === "assisted";
      return {
        id: listId,
        productTypeId: typeId(code),
        productTypeCode: code,
        current:
          seed.status === "applied" || pendingEntry
            ? null
            : {
                id: mockId("plv", index * 10 + at + 1),
                versionNo: 1,
                status: "approved",
                origin:
                  seed.ownership === "platform_rate_card"
                    ? "platform_rate_card"
                    : seed.mode === "assisted"
                      ? "assisted_entry"
                      : "factory_proposal",
                effectiveFrom: bangkokIso(-DAY * 60),
                reason: "ราคาเริ่มต้น",
                basedOnVersionNo: null,
                proposalId: null,
                contentSha256: "a".repeat(64),
                lineCount: 24,
                factoryAcceptedAt: seed.ownership === "platform_rate_card" ? bangkokIso(-DAY * 61) : null,
                factorySignedOffAt: seed.mode === "assisted" ? bangkokIso(-DAY * 61) : null,
                createdAt: bangkokIso(-DAY * 62),
              },
        upcoming:
          pendingEntry && seed.tiers[code] === "B"
            ? [
                {
                  id: mockId("plv", index * 10 + at + 1),
                  versionNo: 1,
                  status: "pending_acceptance",
                  origin: "assisted_entry",
                  effectiveFrom: bangkokIso(DAY * 3),
                  reason: "ราคาที่ทีมพาร์ตเนอร์กรอกแทนโรงงานจากใบราคาที่ได้รับ",
                  basedOnVersionNo: null,
                  proposalId: null,
                  contentSha256: "b".repeat(64),
                  lineCount: 6,
                  factoryAcceptedAt: null,
                  factorySignedOffAt: null,
                  createdAt: bangkokIso(-DAY * 2),
                },
              ]
            : [],
      };
    }),
    overrides: new Map(),
  };
}

SEEDS.forEach((seed, index) => stores.set(seed.id, build(seed, index)));

/* ------------------------------------------------------------------------------ proposals */

export const COMPONENTS: Schemas["PriceComponentDto"][] = [
  {
    component: "material_prices",
    group: "materials",
    dimensions: [
      { key: "materialId", type: "ref", nullable: false, scale: null },
      { key: "qtyFrom", type: "integer", nullable: false, scale: null },
      { key: "qtyTo", type: "integer", nullable: true, scale: null },
    ],
    values: [{ key: "rate", type: "decimal", nullable: false, scale: 6 }],
  },
  {
    component: "print_prices",
    group: "process_rates",
    dimensions: [
      { key: "printTypeId", type: "ref", nullable: false, scale: null },
      { key: "colours", type: "integer", nullable: false, scale: null },
    ],
    values: [
      { key: "setup", type: "decimal", nullable: false, scale: 2 },
      { key: "perSheet", type: "decimal", nullable: false, scale: 6 },
    ],
  },
  {
    component: "finish_prices",
    group: "process_rates",
    dimensions: [{ key: "finishId", type: "ref", nullable: false, scale: null }],
    values: [
      { key: "perSqm", type: "decimal", nullable: false, scale: 6 },
      { key: "minimum", type: "decimal", nullable: false, scale: 2 },
    ],
  },
  {
    component: "print_wastes",
    group: "waste",
    dimensions: [{ key: "qtyFrom", type: "integer", nullable: false, scale: null }],
    values: [{ key: "sheets", type: "integer", nullable: false, scale: null }],
  },
  {
    component: "factory_margins",
    group: "commercial_terms",
    dimensions: [{ key: "printTypeId", type: "ref", nullable: false, scale: null }],
    values: [{ key: "pct", type: "decimal", nullable: false, scale: 4 }],
  },
];

const ART = "0192f3a0-7c1e-7d2a-9b1f-00000000d003";
export const line = (
  id: number,
  component: Schemas["PriceComponent"],
  action: ProposalLine["action"],
  current: Record<string, unknown> | null,
  proposed: Record<string, unknown> | null,
): ProposalLine => ({
  id: mockId("ppl", id),
  lineKey: `${component}-${id}`.padEnd(64, "0").slice(0, 64),
  component,
  action,
  currentValues: current,
  proposedValues: proposed,
  counterValues: null,
  decision: "pending",
  decidedAt: null,
  comment: null,
});

export const counts = (lines: ProposalLine[]) => ({
  total: lines.length,
  pending: lines.filter((item) => item.decision === "pending").length,
  accepted: lines.filter((item) => item.decision === "accepted").length,
  rejected: lines.filter((item) => item.decision === "rejected").length,
  countered: lines.filter((item) => item.decision === "countered").length,
});

export function proposal(
  n: number,
  factoryId: string,
  code: string,
  direction: Proposal["direction"],
  status: Proposal["status"],
  lines: ProposalLine[],
  comment: string,
): Proposal {
  const store = stores.get(factoryId)!;
  const list = store.priceLists.find((item) => item.productTypeCode === code) ?? store.priceLists[0]!;
  return {
    id: mockId("ppr", n),
    factoryId,
    factoryCode: store.factory.code,
    productTypeId: typeId(code),
    productTypeCode: code,
    priceListId: list.id,
    direction,
    origin: direction === "factory_to_packio" ? "factory_proposal" : "platform_rate_card",
    status,
    baseVersionNo: list.current?.versionNo ?? null,
    proposedEffectiveFrom: bangkokIso(DAY * 7),
    comment,
    approvalRequestId: status === "submitted" || status === "under_review" ? mockId("appr", 4800 + n) : null,
    submittedAt: status === "draft" ? null : bangkokIso(-DAY * 2),
    createdAt: bangkokIso(-DAY * 3),
    resultingVersion: null,
    lines,
    lineCounts: counts(lines),
  };
}

export const proposals: Proposal[] = [
  proposal(
    1,
    FACTORY.id,
    "folding_carton",
    "factory_to_packio",
    "submitted",
    [
      line(
        1,
        "material_prices",
        "change",
        { materialId: ART, qtyFrom: 1000, qtyTo: 4999, rate: "11.800000" },
        { materialId: ART, qtyFrom: 1000, qtyTo: 4999, rate: "12.500000" },
      ),
      line(
        2,
        "material_prices",
        "change",
        { materialId: ART, qtyFrom: 5000, qtyTo: null, rate: "11.200000" },
        { materialId: ART, qtyFrom: 5000, qtyTo: null, rate: "12.100000" },
      ),
      line(
        3,
        "print_prices",
        "change",
        { printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003", colours: 4, setup: "1200.00", perSheet: "0.850000" },
        { printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003", colours: 4, setup: "1350.00", perSheet: "0.900000" },
      ),
      line(4, "finish_prices", "add", null, {
        finishId: "0192f3a0-7c1e-7d2a-9b1f-00000000d005",
        perSqm: "6.500000",
        minimum: "450.00",
      }),
    ],
    "ราคากระดาษขึ้นตั้งแต่เดือนตุลาคม",
  ),
  proposal(
    2,
    mockId("fac", 2),
    "rigid_box",
    "packio_to_factory",
    "draft",
    [
      line(
        5,
        "factory_margins",
        "change",
        { printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003", pct: "18.0000" },
        { printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003", pct: "16.0000" },
      ),
    ],
    "ปรับอัตราตามตลาดไตรมาส 4",
  ),
  proposal(
    3,
    mockId("fac", 3),
    "food_packaging",
    "factory_to_packio",
    "approved",
    [
      {
        ...line(6, "print_wastes", "change", { qtyFrom: 1000, sheets: 80 }, { qtyFrom: 1000, sheets: 70 }),
        decision: "accepted",
        decidedAt: bangkokIso(-DAY),
      },
    ],
    "ลดของเสียจากเครื่องใหม่",
  ),
  // The rate card Packio sent F006 for its tier-A type during onboarding (D-042 a): the factory
  // accepts it whole, or line by line with counters, in the partner zone.
  {
    ...proposal(
      4,
      mockId("fac", 6),
      "label_sticker",
      "packio_to_factory",
      "submitted",
      [
        line(7, "material_prices", "add", null, {
          materialId: "0192f3a0-7c1e-7d2a-9b1f-00000000d003",
          qtyFrom: 1000,
          qtyTo: 9999,
          rate: "9.400000",
        }),
        line(8, "print_prices", "add", null, {
          printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003",
          colours: 4,
          setup: "900.00",
          perSheet: "0.620000",
        }),
        line(9, "finish_prices", "add", null, {
          finishId: "0192f3a0-7c1e-7d2a-9b1f-00000000d005",
          perSqm: "5.200000",
          minimum: "300.00",
        }),
        line(10, "factory_margins", "add", null, {
          printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003",
          pct: "15.0000",
        }),
      ],
      "อัตราตั้งต้นสำหรับสติกเกอร์ฉลาก",
    ),
    baseVersionNo: null,
    proposedEffectiveFrom: bangkokIso(DAY * 10),
  },
];

/** The factories as the coverage map and the RFQ desk read them: tier per type, and status. */
export function factoryTiers(): {
  factory: { id: string; code: string; name: string };
  status: string;
  tiers: { productTypeId: string; tier: Schemas["ParticipationTier"]; envelopeNote: string | null }[];
}[] {
  return [...stores.values()].map((store) => ({
    factory: {
      id: store.factory.id,
      code: store.factory.code,
      name: store.factory.tradeName ?? store.factory.legalName,
    },
    status: store.factory.status,
    tiers: store.config.participations
      .filter((item) => item.current)
      .map((item) => ({
        productTypeId: item.productTypeId,
        tier: item.current!.tier,
        envelopeNote: item.current!.envelopeNote,
      })),
  }));
}

/**
 * The coverage map for one product type, as packio-api's quote-path service computes it (D-043):
 * every factory not offboarded with a capability for the type, and the instant path — the type
 * quoted instantly and an active factory with an active capability at tier A with a price list in
 * force (tier B needs a configuration to match its envelope, so the map says `envelope_not_covered`).
 */
export function coverageOf(type: {
  id: string;
  code: string;
  quoteMode: Schemas["QuoteMode"];
}): Schemas["ProductTypeCoverageDto"] {
  const candidates = [...stores.values()]
    .filter((store) => store.factory.status !== "offboarded")
    .flatMap((store) => {
      const capability = store.capabilities.find((item) => item.productTypeId === type.id);
      if (!capability) return [];
      const tier = store.config.participations.find((item) => item.productTypeId === type.id)?.current?.tier ?? null;
      const list = store.priceLists.find((item) => item.productTypeId === type.id);
      const capacity = store.config.capacities.find((item) => item.productTypeId === type.id)?.current;
      return [
        {
          factoryId: store.factory.id,
          factoryCode: store.factory.code,
          factoryStatus: store.factory.status,
          capabilityStatus: capability.status,
          tier,
          priceListVersionNo: list?.current?.versionNo ?? null,
          weeklyCapacity: capacity?.weeklyCapacity ?? null,
          capacityUnit: capacity?.capacityUnit ?? null,
        },
      ];
    });
  const live = candidates.filter((item) => item.factoryStatus === "active" && item.capabilityStatus === "active");
  const priced = live.filter((item) => (item.tier === "A" || item.tier === "B") && item.priceListVersionNo !== null);
  const instantPath: Schemas["QuotePathReason"] =
    type.quoteMode !== "instant"
      ? "type_rfq_only"
      : live.length === 0
        ? "no_active_factory"
        : priced.length === 0
          ? "no_price_list"
          : priced.some((item) => item.tier === "A")
            ? "instant_available"
            : "envelope_not_covered";
  return {
    productTypeId: type.id,
    productTypeCode: type.code,
    quoteMode: type.quoteMode,
    instantPath,
    factories: candidates,
  };
}

registerQueue("partners.read", () => {
  const rows = [...stores.values()].filter((store) => ["applied", "under_review"].includes(store.factory.status));
  return {
    key: "partners.onboarding",
    path: "/admin/partners?status=applied",
    count: rows.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});
registerQueue("price_proposals.review", () => {
  const rows = proposals.filter(
    (item) => item.direction === "factory_to_packio" && ["submitted", "under_review"].includes(item.status),
  );
  return {
    key: "partners.proposals",
    path: "/admin/partners/proposals?direction=factory_to_packio",
    count: rows.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});

/* ------------------------------------------------------------------------------ handlers */

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = () => problem(404, "partners.factory_not_found", "ไม่พบโรงงานนี้");

function access(
  request: Request,
  permission: string,
  factoryId?: unknown,
): Response | { who: StaffPersona; store?: Store } {
  const who = staffPersonaOf(request);
  if (!who || !can(who, permission)) return forbidden();
  if (factoryId === undefined) return { who };
  const store = stores.get(String(factoryId));
  return store ? { who, store } : notFound();
}

export const touch = (store: Store) => {
  store.factory.updatedAt = new Date(Math.max(Date.now(), Date.parse(store.factory.updatedAt) + 1000) + 7 * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .concat("+07:00");
  store.factory.onboarding = {
    done: store.steps.filter((step) => ["approved", "waived"].includes(step.status)).length,
    total: store.steps.length,
  };
};

const withEtag = (factory: Factory) => HttpResponse.json(factory, { headers: { ETag: etagOf(factory as never) } });

function guard(request: Request, factory: Factory): Response | null {
  const match = request.headers.get("if-match");
  if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
  if (match !== etagOf(factory as never))
    return problem(412, "http.precondition_failed", "ข้อมูลโรงงานถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
  return null;
}

const TRANSITIONS: Record<Schemas["FactoryStatusAction"], [Factory["status"][], Factory["status"]]> = {
  "start-review": [["applied"], "under_review"],
  "return-to-applicant": [["under_review"], "applied"],
  "start-trial": [["under_review", "suspended"], "trial"],
  suspend: [["trial", "active"], "suspended"],
  reinstate: [["suspended"], "active"],
  offboard: [["applied", "under_review", "trial", "active", "suspended"], "offboarded"],
};

/** Writes a new version of a versioned term: approved at once, or proposed with an approval. */
export function writeVersion<T extends { current: unknown; upcoming: unknown[] }>(
  holder: T,
  values: Record<string, unknown>,
  body: { effectiveFrom?: string; reason: string },
  approval: { policy: string; who: StaffPersona; store: Store; subjectType: string } | null,
): Schemas["VersionWriteResultDto"] {
  const versions = [holder.current, ...holder.upcoming].filter(Boolean) as { versionNo: number }[];
  const versionNo = Math.max(0, ...versions.map((item) => item.versionNo)) + 1;
  const opened = approval
    ? openApproval({
        policy: approval.policy,
        subjectType: approval.subjectType,
        subjectId: approval.store.factory.id,
        requester: approval.who,
        payload: { factory: approval.store.factory.code, ...values, reason: body.reason },
      })
    : null;
  const effectiveFrom = body.effectiveFrom ?? now();
  const entry = {
    ...values,
    versionNo,
    effectiveFrom,
    reason: body.reason,
    status: opened ? "proposed" : "approved",
    approvalRequestId: opened?.id ?? null,
  };
  if (!opened && Date.parse(effectiveFrom) <= Date.now()) holder.current = entry;
  else holder.upcoming.push(entry);
  return { versionNo, status: opened ? "proposed" : "approved", approvalRequestId: opened?.id ?? null };
}

export const partnerHandlers: HttpHandler[] = [
  http.get("*/v1/admin/factories", ({ request }) => {
    const ok = access(request, "partners.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = [...stores.values()]
      .map((store) => store.factory)
      .filter((factory) => !status || factory.status === status)
      .filter((factory) => matchesQuery(q, factory.code, factory.legalName, factory.tradeName, factory.taxId));
    return HttpResponse.json(
      paginate(
        sortBy(rows, url.searchParams.get("sort") ?? "code", (url.searchParams.get("order") as "asc") ?? "asc"),
        {
          page: Number(url.searchParams.get("page") ?? 1),
          perPage: Number(url.searchParams.get("perPage") ?? 25),
        },
      ),
    );
  }),
  http.post("*/v1/admin/factories", async ({ request }) => {
    const ok = access(request, "partners.manage");
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["CreateFactoryDto"];
    if (
      [...stores.values()].some(
        (store) => store.factory.taxId === body.taxId && store.factory.branchCode === body.branchCode,
      )
    ) {
      return problem(409, "partners.duplicate_tax_id", "มีโรงงานเลขประจำตัวผู้เสียภาษีและสาขานี้แล้ว", [
        { path: "taxId", code: "unique", message: "ซ้ำกับโรงงานที่มีอยู่" },
      ]);
    }
    const id = nextId("fac");
    const code = `F${String(stores.size + 1).padStart(3, "0")}`;
    const seed: Seed = {
      id,
      code,
      legalName: body.legalName,
      tradeName: body.tradeName ?? body.legalName,
      status: "applied",
      mode: body.onboardingMode,
      tiers: {},
      ownership: "factory_price_list",
    };
    const store = build(seed, stores.size);
    Object.assign(store.factory, body, { status: "applied", updatedAt: now() });
    store.kyc = [];
    store.banks = [];
    store.visits = [];
    stores.set(id, store);
    return HttpResponse.json(store.factory, { status: 201, headers: { ETag: etagOf(store.factory as never) } });
  }),
  http.get("*/v1/admin/factories/:factoryId", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    if (ok instanceof Response) return ok;
    return withEtag(ok.store!.factory);
  }),
  http.patch("*/v1/admin/factories/:factoryId", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const refused = guard(request, ok.store!.factory);
    if (refused) return refused;
    Object.assign(ok.store!.factory, (await request.json()) as Schemas["UpdateFactoryDto"]);
    touch(ok.store!);
    return withEtag(ok.store!.factory);
  }),
  http.post("*/v1/admin/factories/:factoryId/actions/:action", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const store = ok.store!;
    const refused = guard(request, store.factory);
    if (refused) return refused;
    const rule = TRANSITIONS[params.action as Schemas["FactoryStatusAction"]];
    if (!rule) return problem(404, "http.not_found", "ไม่รู้จักการดำเนินการนี้");
    const { reason } = (await request.json()) as Schemas["ReasonBodyDto"];
    if (!reason || reason.trim().length < 3)
      return problem(422, "validation.failed", "ต้องระบุเหตุผล", [
        { path: "reason", code: "min", message: "อย่างน้อย 3 ตัวอักษร" },
      ]);
    if (!rule[0].includes(store.factory.status))
      return problem(409, "partners.invalid_transition", "เปลี่ยนสถานะนี้จากสถานะปัจจุบันไม่ได้");
    store.factory.status = rule[1];
    store.factory.statusChangedAt = now();
    if (rule[1] === "offboarded") store.factory.offboardedAt = now();
    touch(store);
    return withEtag(store.factory);
  }),
  http.post("*/v1/admin/factories/:factoryId/activation-requests", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const store = ok.store!;
    if (store.factory.status !== "trial")
      return problem(409, "partners.invalid_transition", "ขออนุมัติเปิดใช้งานได้เฉพาะโรงงานที่อยู่ระหว่างทดลอง");
    if (!store.visits.some((visit) => visit.result === "pass"))
      return problem(409, "partners.site_visit_required", "ต้องมีผลตรวจเยี่ยมโรงงานที่ผ่านก่อน (D-041)");
    const { reason } = (await request.json()) as Schemas["ReasonBodyDto"];
    const opened = openApproval({
      policy: "partner_activation",
      subjectType: "factory",
      subjectId: store.factory.id,
      requester: ok.who,
      payload: { factory: store.factory.code, name: store.factory.tradeName, reason },
    });
    return HttpResponse.json({ approvalRequestId: opened.id, status: store.factory.status }, { status: 201 });
  }),
  http.post("*/v1/admin/factories/:factoryId/owner-account", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["CreateOwnerAccountDto"];
    if (!body.initialPassword || body.initialPassword.length < 12)
      return problem(422, "validation.failed", "รหัสผ่านเริ่มต้นต้องมีอย่างน้อย 12 ตัวอักษร", [
        { path: "initialPassword", code: "min", message: "อย่างน้อย 12 ตัวอักษร" },
      ]);
    return HttpResponse.json({ userId: nextId("usr"), email: body.email, role: "factory_owner" }, { status: 201 });
  }),
  http.get("*/v1/admin/factories/:factoryId/onboarding-steps", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.steps);
  }),
  http.patch("*/v1/admin/factories/:factoryId/onboarding-steps/:step", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const step = ok.store!.steps.find((item) => item.step === params.step);
    if (!step) return problem(404, "http.not_found", "ไม่พบขั้นตอนนี้");
    const body = (await request.json()) as Schemas["UpdateOnboardingStepDto"];
    Object.assign(step, body, {
      completedAt: ["approved", "waived"].includes(body.status) ? now() : null,
      enteredByStaff: ok.store!.factory.onboardingMode === "assisted" ? true : step.enteredByStaff,
    });
    touch(ok.store!);
    return HttpResponse.json(step);
  }),
  ...(["addresses", "contacts", "machines"] as const).flatMap((kind) => {
    const key = kind === "addresses" ? "addresses" : kind === "contacts" ? "contacts" : "machines";
    const ns = { addresses: "fad", contacts: "fct", machines: "mch" }[kind];
    const idParam = { addresses: "addressId", contacts: "contactId", machines: "machineId" }[kind];
    return [
      http.get(`*/v1/admin/factories/:factoryId/${kind}`, ({ request, params }) => {
        const ok = access(request, "partners.read", params.factoryId);
        return ok instanceof Response ? ok : HttpResponse.json(ok.store![key]);
      }),
      http.post(`*/v1/admin/factories/:factoryId/${kind}`, async ({ request, params }) => {
        const ok = access(request, "partners.manage", params.factoryId);
        if (ok instanceof Response) return ok;
        const created = { id: nextId(ns), ...((await request.json()) as object) };
        (ok.store![key] as unknown[]).push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
      http.patch(`*/v1/admin/factories/:factoryId/${kind}/:${idParam}`, async ({ request, params }) => {
        const ok = access(request, "partners.manage", params.factoryId);
        if (ok instanceof Response) return ok;
        const row = (ok.store![key] as { id: string }[]).find((item) => item.id === params[idParam]);
        if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
        Object.assign(row, (await request.json()) as object);
        return HttpResponse.json(row);
      }),
    ];
  }),
  http.get("*/v1/admin/factories/:factoryId/kyc-documents", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.kyc);
  }),
  http.post("*/v1/admin/factories/:factoryId/kyc-documents", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["CreateKycDocumentDto"];
    const created: Schemas["KycDocumentDto"] = {
      id: nextId("kyc"),
      ...body,
      status: "pending",
      verifiedAt: null,
      note: null,
    } as Schemas["KycDocumentDto"];
    ok.store!.kyc.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post("*/v1/admin/factories/:factoryId/kyc-documents/:documentId/actions/review", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const doc = ok.store!.kyc.find((item) => item.id === params.documentId);
    if (!doc) return problem(404, "http.not_found", "ไม่พบเอกสารนี้");
    const body = (await request.json()) as Schemas["ReviewKycDocumentDto"];
    if (body.outcome === "rejected" && !body.note?.trim())
      return problem(422, "validation.failed", "ต้องระบุเหตุผลที่ไม่ผ่าน", [
        { path: "note", code: "required", message: "ต้องระบุเหตุผล" },
      ]);
    Object.assign(doc, {
      status: body.outcome,
      note: body.note ?? null,
      verifiedAt: body.outcome === "verified" ? now() : null,
    });
    return HttpResponse.json(doc);
  }),
  http.get("*/v1/admin/factories/:factoryId/bank-accounts", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.banks);
  }),
  http.post("*/v1/admin/factories/:factoryId/bank-accounts", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["ProposeBankAccountDto"];
    const store = ok.store!;
    const duplicate = [...stores.values()].some(
      (other) =>
        other !== store &&
        other.banks.some((bank) => bank.accountNoLast4 === body.accountNo.slice(-4) && bank.bankCode === body.bankCode),
    );
    const created: Schemas["BankAccountDto"] = {
      id: nextId("bnk"),
      bankCode: body.bankCode,
      accountName: body.accountName,
      accountNoLast4: body.accountNo.slice(-4),
      branchName: body.branchName ?? null,
      status: "pending_approval",
      duplicateOfOtherVendor: duplicate,
      approvalRequestId: null,
      effectiveFrom: null,
      createdAt: now(),
      verification: null,
    };
    // D-033: a vendor bank account change is dual-approved by Finance after a call-back.
    const opened = openApproval({
      policy: "vendor_bank_account_change",
      subjectType: "vendor_bank_account",
      subjectId: created.id,
      requester: ok.who,
      payload: { vendor: store.factory.tradeName ?? store.factory.legalName, bankLast4: created.accountNoLast4 },
    });
    created.approvalRequestId = opened.id;
    store.banks.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post("*/v1/admin/vendor-bank-accounts/:accountId/verification-calls", async ({ request, params }) => {
    const ok = access(request, "vendor_bank_accounts.verify");
    if (ok instanceof Response) return ok;
    const account = [...stores.values()].flatMap((store) => store.banks).find((bank) => bank.id === params.accountId);
    if (!account) return problem(404, "http.not_found", "ไม่พบบัญชีนี้");
    const body = (await request.json()) as Schemas["RecordVerificationCallDto"];
    account.verification = {
      calledAt: body.calledAt,
      calledNumberMasked: body.calledNumber.replace(/\d(?=\d{3})/g, "x"),
      outcome: body.outcome,
    };
    return HttpResponse.json(account);
  }),
  http.get("*/v1/admin/factories/:factoryId/capabilities", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.capabilities);
  }),
  http.post("*/v1/admin/factories/:factoryId/capabilities", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["CreateCapabilityDto"];
    const type = PRODUCT_TYPES.find((candidate) => candidate.id === body.productTypeId);
    if (!type)
      return problem(422, "validation.failed", "ไม่พบประเภทสินค้า", [
        { path: "productTypeId", code: "ref", message: "ไม่พบ" },
      ]);
    if (ok.store!.capabilities.some((item) => item.productTypeId === body.productTypeId))
      return problem(409, "partners.capability_exists", "มีความสามารถของประเภทนี้แล้ว");
    const created: Schemas["CapabilityDto"] = {
      id: nextId("cap"),
      productTypeCode: type.code,
      printTypeId: null,
      minOrderQty: null,
      maxOrderQty: null,
      maxSheetLengthMm: null,
      maxSheetWidthMm: null,
      status: "active",
      ...body,
    };
    ok.store!.capabilities.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.patch("*/v1/admin/factories/:factoryId/capabilities/:capabilityId", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const row = ok.store!.capabilities.find((item) => item.id === params.capabilityId);
    if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    Object.assign(row, (await request.json()) as Schemas["UpdateCapabilityDto"]);
    return HttpResponse.json(row);
  }),
  http.get("*/v1/admin/factories/:factoryId/delivery-zones", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.zones);
  }),
  http.put("*/v1/admin/factories/:factoryId/delivery-zones", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const { zones } = (await request.json()) as Schemas["ReplaceDeliveryZonesDto"];
    ok.store!.zones = ok.store!.zones.map((zone) => {
      const next = zones.find((item) => item.zoneId === zone.zoneId);
      return next
        ? { ...zone, serves: next.serves ?? zone.serves, extraLeadDays: next.extraLeadDays ?? zone.extraLeadDays }
        : zone;
    });
    return HttpResponse.json(ok.store!.zones);
  }),
  http.get("*/v1/admin/factories/:factoryId/configuration", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.config);
  }),
  http.get("*/v1/admin/factories/:factoryId/capacity", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const productTypeId = url.searchParams.get("productTypeId") ?? ok.store!.config.capacities[0]?.productTypeId;
    const capacity = ok.store!.config.capacities.find((item) => item.productTypeId === productTypeId);
    const weekly = Number(capacity?.current?.weeklyCapacity ?? 0);
    const weeks = Number(url.searchParams.get("weeks") ?? 8);
    const monday = new Date(Date.now() + 7 * 3_600_000);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const rows: Schemas["CapacityWeekDto"][] = Array.from({ length: weeks }, (_, index) => {
      const start = new Date(monday.getTime() + index * 7 * 86_400_000).toISOString().slice(0, 10);
      const override = ok.store!.overrides.get(`${productTypeId}:${start}`);
      const cap = override ?? weekly;
      const booked = Math.round(cap * Math.max(0, 0.85 - index * 0.12));
      return {
        weekStart: start,
        capacity: cap.toFixed(3),
        booked: booked.toFixed(3),
        free: (cap - booked).toFixed(3),
        source: override === undefined ? "version" : "override",
      };
    });
    return HttpResponse.json(rows);
  }),
  http.put("*/v1/admin/factories/:factoryId/capacity-overrides", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["SetCapacityOverrideDto"];
    ok.store!.overrides.set(`${body.productTypeId}:${body.weekStart}`, body.capacity);
    return HttpResponse.json([]);
  }),
  http.post("*/v1/admin/factories/:factoryId/capacity-versions", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["SetCapacityDto"];
    const holder = ok.store!.config.capacities.find((item) => item.productTypeId === body.productTypeId);
    if (!holder)
      return problem(422, "validation.failed", "โรงงานไม่มีความสามารถประเภทนี้", [
        { path: "productTypeId", code: "ref", message: "ไม่มี" },
      ]);
    return HttpResponse.json(
      writeVersion(
        holder,
        { capacityUnit: body.capacityUnit, weeklyCapacity: body.weeklyCapacity.toFixed(3) },
        body,
        null,
      ),
      { status: 201 },
    );
  }),
  http.post("*/v1/admin/factories/:factoryId/participations", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["SetParticipationDto"];
    let holder = ok.store!.config.participations.find((item) => item.productTypeId === body.productTypeId);
    if (!holder) {
      const type = PRODUCT_TYPES.find((candidate) => candidate.id === body.productTypeId)!;
      holder = { productTypeId: type.id, productTypeCode: type.code, current: null, upcoming: [] };
      ok.store!.config.participations.push(holder);
    }
    return HttpResponse.json(
      writeVersion(holder, { tier: body.tier, envelopeNote: body.envelopeNote ?? null }, body, null),
      {
        status: 201,
      },
    );
  }),
  http.post("*/v1/admin/factories/:factoryId/pricing-arrangement-versions", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["SetPricingArrangementDto"];
    const store = ok.store!;
    // Changing an active factory's mode is approved (policy `partner_pricing_mode_change`).
    const needs = ["active", "trial"].includes(store.factory.status);
    return HttpResponse.json(
      writeVersion(
        store.config.pricingArrangement,
        { ownershipMode: body.ownershipMode },
        body,
        needs ? { policy: "partner_pricing_mode_change", who: ok.who, store, subjectType: "factory" } : null,
      ),
      { status: 201 },
    );
  }),
  http.post("*/v1/admin/factories/:factoryId/tolerance-versions", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["SetToleranceDto"];
    const store = ok.store!;
    let holder = store.config.tolerances.find((item) => (item.productTypeId ?? null) === (body.productTypeId ?? null));
    if (!holder) {
      const type = PRODUCT_TYPES.find((candidate) => candidate.id === body.productTypeId);
      holder = { productTypeId: type?.id ?? null, productTypeCode: type?.code ?? null, current: null, upcoming: [] };
      store.config.tolerances.push(holder);
    }
    // D-173: a factory-specific tolerance override is approved by a Superadmin.
    return HttpResponse.json(
      writeVersion(holder, { shortagePct: body.shortagePct.toFixed(4), overagePct: body.overagePct.toFixed(4) }, body, {
        policy: "factory_tolerance_change",
        who: ok.who,
        store,
        subjectType: "factory",
      }),
      { status: 201 },
    );
  }),
  http.post("*/v1/admin/factories/:factoryId/payout-policy-versions", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["SetPayoutPolicyDto"];
    const store = ok.store!;
    return HttpResponse.json(
      writeVersion(
        store.config.payoutPolicy,
        {
          advancePct: body.advancePct.toFixed(4),
          advanceTrigger: body.advanceTrigger,
          balanceTrigger: body.balanceTrigger,
          claimWindowDays: body.claimWindowDays,
          paymentTermsDays: body.paymentTermsDays,
          retentionPct: body.retentionPct.toFixed(4),
          retentionReleaseDays: body.retentionReleaseDays,
        },
        body,
        { policy: "factory_payout_policy_change", who: ok.who, store, subjectType: "factory" },
      ),
      { status: 201 },
    );
  }),
  http.get("*/v1/admin/factories/:factoryId/agreements", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.agreements);
  }),
  http.post("*/v1/admin/factories/:factoryId/agreements/:key/signed-copies", async ({ request, params }) => {
    const ok = access(request, "partners.manage", params.factoryId);
    if (ok instanceof Response) return ok;
    const agreement = ok.store!.agreements.find((item) => item.key === params.key);
    if (!agreement) return problem(404, "http.not_found", "ไม่พบสัญญานี้");
    Object.assign(agreement, { accepted: true, acceptedAt: now(), method: "signed_upload" });
    return HttpResponse.json(ok.store!.agreements);
  }),
  http.get("*/v1/admin/factories/:factoryId/site-visits", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.visits);
  }),
  http.post("*/v1/admin/factories/:factoryId/site-visits", async ({ request, params }) => {
    const ok = access(request, "partners.site_visits.record", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["RecordSiteVisitDto"];
    const created: Schemas["SiteVisitDto"] = {
      id: nextId("svt"),
      ...body,
      photoFileIds: body.photoFileIds ?? [],
      notes: body.notes ?? null,
      createdAt: now(),
    };
    ok.store!.visits.unshift(created);
    const step = ok.store!.steps.find((item) => item.step === "site_visit");
    if (step && body.result === "pass") Object.assign(step, { status: "approved", completedAt: now() });
    touch(ok.store!);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get("*/v1/admin/factories/:factoryId/price-lists", ({ request, params }) => {
    const ok = access(request, "partners.read", params.factoryId);
    return ok instanceof Response ? ok : HttpResponse.json(ok.store!.priceLists);
  }),
  http.get("*/v1/admin/price-components", ({ request }) => {
    const ok = access(request, "partners.read");
    return ok instanceof Response ? ok : HttpResponse.json(COMPONENTS);
  }),
  http.get("*/v1/admin/price-list-versions/:versionId/lines", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "partners.read") || !can(who, "factory_cost.read")) return forbidden();
    const url = new URL(request.url);
    const component = url.searchParams.get("component") as Schemas["PriceComponent"] | null;
    const rows: Row[] = [
      {
        component: "material_prices",
        lineKey: "m1".padEnd(64, "0"),
        values: { materialId: ART, qtyFrom: 1000, qtyTo: 4999, rate: "11.800000" },
      },
      {
        component: "material_prices",
        lineKey: "m2".padEnd(64, "0"),
        values: { materialId: ART, qtyFrom: 5000, qtyTo: null, rate: "11.200000" },
      },
      {
        component: "print_prices",
        lineKey: "p1".padEnd(64, "0"),
        values: {
          printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003",
          colours: 4,
          setup: "1200.00",
          perSheet: "0.850000",
        },
      },
      {
        component: "factory_margins",
        lineKey: "f1".padEnd(64, "0"),
        values: { printTypeId: "0192f3a0-7c1e-7d2a-9b1f-00000000c003", pct: "18.0000" },
      },
    ].filter((row) => !component || row.component === component) as Row[];
    void params;
    return HttpResponse.json(paginate(rows, { page: 1, perPage: 100 }));
  }),
  http.get("*/v1/admin/price-proposals", ({ request }) => {
    const ok = access(request, "partners.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const rows = proposals
      .filter((item) => !url.searchParams.get("status") || item.status === url.searchParams.get("status"))
      .filter((item) => !url.searchParams.get("direction") || item.direction === url.searchParams.get("direction"))
      .filter((item) => !url.searchParams.get("factoryId") || item.factoryId === url.searchParams.get("factoryId"))
      .map(({ lines: _lines, ...summary }) => summary);
    return HttpResponse.json(
      paginate(sortBy(rows, "createdAt", "desc"), { page: Number(url.searchParams.get("page") ?? 1), perPage: 25 }),
    );
  }),
  http.post("*/v1/admin/factories/:factoryId/price-proposals", async ({ request, params }) => {
    const ok = access(request, "price_proposals.review", params.factoryId);
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["CreatePriceProposalDto"];
    const type = PRODUCT_TYPES.find((candidate) => candidate.id === body.productTypeId);
    if (!type)
      return problem(422, "validation.failed", "ไม่พบประเภทสินค้า", [
        { path: "productTypeId", code: "ref", message: "ไม่พบ" },
      ]);
    const created = proposal(
      100 + proposals.length,
      ok.store!.factory.id,
      type.code,
      "packio_to_factory",
      "draft",
      [],
      body.comment ?? "",
    );
    created.proposedEffectiveFrom = body.proposedEffectiveFrom ?? bangkokIso(DAY * 7);
    proposals.unshift(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get("*/v1/admin/price-proposals/:proposalId", ({ request, params }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "price_proposals.review") || !can(who, "factory_cost.read")) return forbidden();
    const item = proposals.find((candidate) => candidate.id === params.proposalId);
    return item ? HttpResponse.json(item) : problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
  }),
  http.put("*/v1/admin/price-proposals/:proposalId/lines", async ({ request, params }) => {
    const ok = access(request, "price_proposals.review");
    if (ok instanceof Response) return ok;
    const item = proposals.find((candidate) => candidate.id === params.proposalId);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    if (item.status !== "draft" || item.direction !== "packio_to_factory")
      return problem(409, "price.proposal_not_editable", "แก้ไขรายการได้เฉพาะฉบับร่างของ Packio");
    const { lines } = (await request.json()) as Schemas["ReplaceProposalLinesDto"];
    item.lines = lines.map((input, index) => ({
      ...line(
        9000 + index + Math.floor(Math.random() * 900),
        input.component,
        input.action,
        input.action === "add" ? null : (input.values ?? null),
        input.action === "remove" ? null : (input.values ?? null),
      ),
      ...(input.lineKey ? { lineKey: input.lineKey } : {}),
    }));
    item.lineCounts = counts(item.lines);
    return HttpResponse.json(item);
  }),
  http.post("*/v1/admin/price-proposals/:proposalId/actions/submit", ({ request, params }) => {
    const ok = access(request, "price_proposals.review");
    if (ok instanceof Response) return ok;
    if (!request.headers.get("idempotency-key"))
      return problem(400, "http.idempotency_key_required", "ต้องส่ง Idempotency-Key");
    const item = proposals.find((candidate) => candidate.id === params.proposalId);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    if (item.status !== "draft" || item.lines.length === 0)
      return problem(409, "price.proposal_not_submittable", "ส่งได้เฉพาะฉบับร่างที่มีรายการ");
    Object.assign(item, { status: "submitted", submittedAt: now() });
    return HttpResponse.json(item);
  }),
  http.post("*/v1/admin/price-proposals/:proposalId/actions/withdraw", async ({ request, params }) => {
    const ok = access(request, "price_proposals.review");
    if (ok instanceof Response) return ok;
    const item = proposals.find((candidate) => candidate.id === params.proposalId);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    if (item.direction !== "packio_to_factory" || !["draft", "submitted"].includes(item.status))
      return problem(409, "price.proposal_not_withdrawable", "ถอนได้เฉพาะข้อเสนอของ Packio ที่ยังไม่ได้ตอบ");
    item.status = "withdrawn";
    return HttpResponse.json(item);
  }),
  http.post("*/v1/admin/price-proposals/:proposalId/actions/decide", async ({ request, params }) => {
    const ok = access(request, "price_proposals.review");
    if (ok instanceof Response) return ok;
    const item = proposals.find((candidate) => candidate.id === params.proposalId);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    if (item.direction !== "factory_to_packio" || !["submitted", "under_review", "countered"].includes(item.status))
      return problem(409, "price.proposal_not_decidable", "ตัดสินได้เฉพาะข้อเสนอของโรงงานที่รอพิจารณา");
    const body = (await request.json()) as Schemas["DecideLinesDto"];
    for (const decision of body.lines) {
      const target = item.lines.find((candidate) => candidate.id === decision.lineId);
      if (!target)
        return problem(422, "validation.failed", "ไม่พบรายการ", [
          { path: "lines", code: "ref", message: decision.lineId },
        ]);
      if (decision.decision === "counter" && !decision.counterValues)
        return problem(422, "validation.failed", "ต้องระบุราคาที่เสนอกลับ", [
          { path: "lines", code: "required", message: "counterValues" },
        ]);
      Object.assign(target, {
        decision:
          decision.decision === "accept" ? "accepted" : decision.decision === "reject" ? "rejected" : "countered",
        counterValues: decision.decision === "counter" ? decision.counterValues : null,
        comment: decision.comment ?? null,
        decidedAt: now(),
      });
    }
    item.lineCounts = counts(item.lines);
    const { pending, accepted, rejected, countered, total } = item.lineCounts;
    item.status =
      pending > 0
        ? "under_review"
        : countered > 0
          ? "countered"
          : accepted === total
            ? "approved"
            : rejected === total
              ? "rejected"
              : "partially_approved";
    if (["approved", "partially_approved"].includes(item.status)) {
      item.resultingVersion = { id: nextId("plv"), versionNo: (item.baseVersionNo ?? 0) + 1, status: "approved" };
    }
    return HttpResponse.json(item);
  }),
];
