/**
 * Loyalty P4 (D-506): the co-funding offers and contributions the mock keeps in memory, shared by the admin
 * (`./loyalty-p4.ts`), partner (`../partner/loyalty-p4.ts`) and capacity-deal (`./marketing.ts`, `./loyalty-p3.ts`)
 * handlers. No MSW and no other mock module is imported here, so the marketing seed can read `fundingOf` while it
 * loads without an import cycle.
 *
 * The seed is API-CHANGES-P4's UAT case on the P3 capacity-deal draft (`prm` 40): one offer proposed to the launch
 * factory F001 (the partner owner persona), one accepted from factory B (40 %, cap ฿2,000) with one accrued and one
 * netted contribution; and, for the partner list, an earlier accepted fixed offer and a declined one of F001.
 * Every name and figure is fake.
 */

import type {
  AdminCofundingContribution,
  AdminCofundingOffer,
  CapacityDealFunding,
} from "@/lib/api/requests/admin-loyalty-p4";
import type {
  CofundingOfferStatus,
  PartnerCofundingOffer,
  PartnerCofundingOfferDetail,
} from "@/lib/api/requests/partner-loyalty-p4";

import { bangkokIso, mockId } from "../support";

export const CAPACITY_DEAL_ID = mockId("prm", 40);
export const F001 = "00000000-0000-4000-8000-0000000000f1";
export const FACTORY_B = mockId("fac", 2);
const MARKETING = { id: "00000000-0000-4000-8000-00000000510c", displayName: "ฝ่ายการตลาด ตัวอย่าง (ข้อมูลจำลอง)" };
const OWNER = { id: mockId("pus", 1), displayName: "เจ้าของโรงงาน ตัวอย่าง (ข้อมูลจำลอง)" };

export const FACTORY_NAMES: Record<string, string> = {
  [F001]: "โรงงานกล่องไทย (ข้อมูลจำลอง)",
  [FACTORY_B]: "โรงงาน ตัวอย่าง B (ข้อมูลจำลอง)",
  [mockId("fac", 3)]: "โรงงาน ตัวอย่าง C (ข้อมูลจำลอง)",
};

export interface DealSnapshot {
  name: string;
  productTypeCode: string;
  productTypeName: string;
  weekStart: string;
  discountPct: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface OfferRow {
  id: string;
  promotionId: string;
  factoryId: string;
  mode: "pct_of_discount" | "fixed_per_order";
  sharePct: string | null;
  fixedAmount: string | null;
  capAmount: string;
  validFrom: string;
  validTo: string;
  respondBy: string;
  status: CofundingOfferStatus;
  note: string | null;
  proposedAt: string;
  answeredAt: string | null;
  answeredBy: { id: string; displayName: string } | null;
  declineReason: string | null;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  rowVersion: number;
  deal: DealSnapshot;
}

export interface ContributionRow {
  id: string;
  offerId: string;
  orderCode: string;
  jobNumber: string;
  discountAmount: string;
  shareAmount: string;
  capped: boolean;
  status: "accrued" | "netted" | "reversed" | "refunded";
  accruedAt: string;
  nettedAt: string | null;
  billingStatementNumber: string | null;
  reversedAt: string | null;
  reverseReason: AdminCofundingContribution["reverseReason"];
}

const CORRUGATED: DealSnapshot = {
  name: "สั่งกล่องลูกฟูกสัปดาห์นี้ ลด 5% (ข้อมูลจำลอง)",
  productTypeCode: "corrugated_rsc",
  productTypeName: "กล่องลูกฟูก",
  weekStart: "2026-11-09",
  discountPct: "5",
  startsAt: "2026-11-09T00:00:00+07:00",
  endsAt: "2026-11-15T23:59:59+07:00",
  status: "draft",
};

const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);
const grouped = (amount: string) =>
  Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** The API's `termsText` (th) — the web shows it as it comes and never composes terms. */
export function termsTextOf(offer: Pick<OfferRow, "mode" | "sharePct" | "fixedAmount" | "capAmount">): string {
  const share =
    offer.mode === "pct_of_discount"
      ? `${Number(offer.sharePct)} % ของส่วนลดดีล`
      : `฿${grouped(offer.fixedAmount ?? "0")} ต่อออเดอร์`;
  return `${share} สูงสุด ฿${grouped(offer.capAmount)}`;
}

function seed(): { offers: OfferRow[]; contributions: ContributionRow[] } {
  const base = {
    note: null,
    answeredAt: null,
    answeredBy: null,
    declineReason: null,
    withdrawnAt: null,
    withdrawReason: null,
    rowVersion: 1,
  };
  const offers: OfferRow[] = [
    {
      ...base,
      id: mockId("cfo", 1),
      promotionId: CAPACITY_DEAL_ID,
      factoryId: F001,
      mode: "pct_of_discount",
      sharePct: "40.00",
      fixedAmount: null,
      capAmount: "20000.00",
      validFrom: CORRUGATED.startsAt,
      validTo: CORRUGATED.endsAt,
      respondBy: bangkokIso(3 * 24 * 60),
      status: "proposed",
      note: "ช่วงโรงงานว่างสัปดาห์ที่ 2 ของเดือน",
      proposedAt: bangkokIso(-60),
      deal: CORRUGATED,
    },
    {
      ...base,
      id: mockId("cfo", 2),
      promotionId: CAPACITY_DEAL_ID,
      factoryId: FACTORY_B,
      mode: "pct_of_discount",
      sharePct: "40.00",
      fixedAmount: null,
      capAmount: "2000.00",
      validFrom: CORRUGATED.startsAt,
      validTo: CORRUGATED.endsAt,
      respondBy: "2026-11-07T23:59:59+07:00",
      status: "accepted",
      proposedAt: "2026-11-04T08:00:00+07:00",
      answeredAt: "2026-11-05T10:12:00+07:00",
      answeredBy: { id: mockId("pus", 31), displayName: "คุณวิชัย (ข้อมูลจำลอง)" },
      rowVersion: 2,
      deal: CORRUGATED,
    },
    {
      ...base,
      id: mockId("cfo", 3),
      promotionId: mockId("prm", 41),
      factoryId: F001,
      mode: "fixed_per_order",
      sharePct: null,
      fixedAmount: "150.00",
      capAmount: "12000.00",
      validFrom: "2026-11-02T00:00:00+07:00",
      validTo: "2026-11-08T23:59:59+07:00",
      respondBy: "2026-10-31T23:59:59+07:00",
      status: "accepted",
      proposedAt: "2026-10-28T09:00:00+07:00",
      answeredAt: "2026-10-29T14:30:00+07:00",
      answeredBy: OWNER,
      rowVersion: 2,
      deal: {
        name: "สั่งกล่องฝาพับสัปดาห์นี้ ลด 8% (ข้อมูลจำลอง)",
        productTypeCode: "folding_carton",
        productTypeName: "กล่องฝาพับ",
        weekStart: "2026-11-02",
        discountPct: "8",
        startsAt: "2026-11-02T00:00:00+07:00",
        endsAt: "2026-11-08T23:59:59+07:00",
        status: "active",
      },
    },
    {
      ...base,
      id: mockId("cfo", 4),
      promotionId: mockId("prm", 42),
      factoryId: F001,
      mode: "pct_of_discount",
      sharePct: "30.00",
      fixedAmount: null,
      capAmount: "10000.00",
      validFrom: "2026-10-26T00:00:00+07:00",
      validTo: "2026-11-01T23:59:59+07:00",
      respondBy: "2026-10-24T23:59:59+07:00",
      status: "declined",
      proposedAt: "2026-10-21T09:00:00+07:00",
      answeredAt: "2026-10-24T11:00:00+07:00",
      answeredBy: OWNER,
      declineReason: "ช่วงนี้ต้นทุนวัตถุดิบสูง ขอไม่ร่วมรอบนี้",
      rowVersion: 2,
      deal: {
        ...CORRUGATED,
        weekStart: "2026-10-26",
        startsAt: "2026-10-26T00:00:00+07:00",
        endsAt: "2026-11-01T23:59:59+07:00",
        status: "ended",
      },
    },
  ];
  const contribution = (
    n: number,
    offerId: string,
    order: string,
    job: string,
    discount: string,
    share: string,
    status: ContributionRow["status"],
    netted: string | null = null,
  ): ContributionRow => ({
    id: mockId("cfc", n),
    offerId,
    orderCode: order,
    jobNumber: job,
    discountAmount: discount,
    shareAmount: share,
    capped: false,
    status,
    accruedAt: "2026-11-10T11:00:00+07:00",
    nettedAt: status === "netted" ? "2026-11-18T16:40:00+07:00" : null,
    billingStatementNumber: netted,
    reversedAt: status === "reversed" ? "2026-11-11T09:00:00+07:00" : null,
    reverseReason: status === "reversed" ? "order_cancelled" : null,
  });
  const contributions: ContributionRow[] = [
    contribution(1, mockId("cfo", 2), "GP-2611-00123", "JB-26-00456", "1200.00", "480.00", "netted", "BS-26-00088"),
    contribution(2, mockId("cfo", 2), "GP-2611-00131", "JB-26-00471", "900.00", "360.00", "accrued"),
    contribution(3, mockId("cfo", 3), "GP-2611-00098", "JB-26-00402", "1600.00", "150.00", "netted", "BS-26-00081"),
    contribution(4, mockId("cfo", 3), "GP-2611-00102", "JB-26-00410", "960.00", "150.00", "netted", "BS-26-00081"),
    contribution(5, mockId("cfo", 3), "GP-2611-00140", "JB-26-00480", "600.00", "150.00", "reversed"),
  ];
  return { offers, contributions };
}

let state = seed();

export const cofunding = {
  get offers() {
    return state.offers;
  },
  get contributions() {
    return state.contributions;
  },
};

export function resetCofundingMock() {
  state = seed();
}

/** Accrued = accrued + netted (reversed and refunded ones gave their room back). */
export function accruedOf(offerId: string): string {
  return baht(
    state.contributions
      .filter((row) => row.offerId === offerId && (row.status === "accrued" || row.status === "netted"))
      .reduce((sum, row) => sum + satang(row.shareAmount), 0),
  );
}

const ordersOf = (offerId: string) =>
  state.contributions.filter((row) => row.offerId === offerId && row.status !== "reversed").length;

function terms(offer: OfferRow) {
  const accrued = accruedOf(offer.id);
  const remaining = Math.max(0, satang(offer.capAmount) - satang(accrued));
  return {
    id: offer.id,
    promotionId: offer.promotionId,
    factory: { id: offer.factoryId, name: FACTORY_NAMES[offer.factoryId] ?? "โรงงาน (ข้อมูลจำลอง)" },
    mode: offer.mode,
    sharePct: offer.sharePct,
    fixedAmount: offer.fixedAmount,
    capAmount: offer.capAmount,
    validFrom: offer.validFrom,
    validTo: offer.validTo,
    respondBy: offer.respondBy,
    status: offer.status,
    accruedAmount: accrued,
    capRemaining: baht(remaining),
    capReached: remaining === 0,
    ordersCount: ordersOf(offer.id),
    note: offer.note,
    proposedAt: offer.proposedAt,
    answeredAt: offer.answeredAt,
    declineReason: offer.declineReason,
    withdrawReason: offer.withdrawReason,
    termsText: termsTextOf(offer),
  };
}

export function adminOfferOf(offer: OfferRow): AdminCofundingOffer {
  return {
    ...terms(offer),
    proposedBy: MARKETING,
    answeredBy: offer.answeredBy,
    withdrawnAt: offer.withdrawnAt,
    rowVersion: offer.rowVersion,
  };
}

/** Open past `respondBy` → the job's `expired` (the hourly job, applied on read here). */
export function expireDue() {
  const now = bangkokIso(0);
  for (const offer of state.offers)
    if (offer.status === "proposed" && offer.respondBy < now) {
      offer.status = "expired";
      offer.rowVersion += 1;
    }
}

export function partnerOfferOf(offer: OfferRow, canDecide: boolean): PartnerCofundingOffer {
  const open = offer.status === "proposed" && offer.respondBy >= bangkokIso(0) && canDecide;
  return { ...terms(offer), deal: offer.deal, nextActions: open ? ["accept", "decline"] : [] };
}

export function partnerOfferDetailOf(offer: OfferRow, canDecide: boolean): PartnerCofundingOfferDetail {
  return {
    ...partnerOfferOf(offer, canDecide),
    orders: state.contributions
      .filter((row) => row.offerId === offer.id)
      .slice(0, 50)
      .map((row) => ({
        orderCode: row.orderCode,
        jobNumber: row.jobNumber,
        discountAmount: row.discountAmount,
        shareAmount: row.shareAmount,
        status: row.status,
        billingStatementNumber: row.billingStatementNumber,
        capped: row.capped,
      })),
  };
}

export function adminContributionOf(row: ContributionRow): AdminCofundingContribution {
  const offer = state.offers.find((candidate) => candidate.id === row.offerId)!;
  return {
    id: row.id,
    offerId: row.offerId,
    promotionId: offer.promotionId,
    factory: { id: offer.factoryId, name: FACTORY_NAMES[offer.factoryId] ?? "โรงงาน (ข้อมูลจำลอง)" },
    orderCode: row.orderCode,
    jobNumber: row.jobNumber,
    discountAmount: row.discountAmount,
    shareAmount: row.shareAmount,
    capped: row.capped,
    status: row.status,
    accruedAt: row.accruedAt,
    nettedAt: row.nettedAt,
    billingStatementNumber: row.billingStatementNumber,
    reversedAt: row.reversedAt,
    reverseReason: row.reverseReason,
    refundedAt: null,
  };
}

/** `funding` of a capacity deal: getpack by default plus each offer with its status (D-506). */
export function fundingOf(promotionId: string): CapacityDealFunding {
  const offers = state.offers.filter((offer) => offer.promotionId === promotionId);
  const accepted = offers.filter((offer) => offer.status === "accepted");
  return {
    defaultFunder: "getpack",
    offers: offers.map((offer) => ({
      offerId: offer.id,
      factoryName: FACTORY_NAMES[offer.factoryId] ?? "โรงงาน (ข้อมูลจำลอง)",
      status: offer.status,
      termsText: termsTextOf(offer),
      capAmount: offer.capAmount,
      accruedAmount: accruedOf(offer.id),
    })),
    acceptedCount: accepted.length,
    factoryShareToDate: baht(accepted.reduce((sum, offer) => sum + satang(accruedOf(offer.id)), 0)),
  };
}
