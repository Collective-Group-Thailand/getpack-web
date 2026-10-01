/**
 * The shape the fake RFQs are kept in — a fixture model, not an API type.
 *
 * A row is the page aggregate the RFQ desk once asked for (F2 2.3). Since U-F0.4 every operation
 * the desk calls is published and nothing answers this shape any more: the desk reads
 * `StaffRfqDto` and the customer `RfqDto`, which `./rfq.ts` and `../store/rfq.ts` project from a
 * row on the way out. The row keeps what the API computes (urgency, counts, suggested prices,
 * events) because the mock has to compute it from something. The thread is kept beside the rows,
 * one list per RFQ, shared by both zones.
 */

import type { Schemas } from "@/lib/api/types";

type UserRef = { id: string; displayName: string };
type FactoryRef = { id: string; code: string; name: string };

/** A file kept with the fixture; the published RFQ names it by id (`AttachedFileDto`). */
export interface RfqFileRow {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  url: string | null;
}

export interface ConsultationTierRow {
  quantity: number;
  /** Sell price per unit derived from the buy price — kept in the fixture, not published. */
  suggestedUnitPrice: string;
  /** The factory's own price — leaves only for `factory_cost.read` (D-141). */
  buyUnitPrice?: string;
}

export interface ConsultationRow {
  id: string;
  factory: FactoryRef;
  tier: Schemas["ParticipationTier"] | null;
  status: Schemas["ConsultationStatus"];
  note: string | null;
  requestedBy: UserRef;
  requestedAt: string;
  dueAt: string;
  respondedAt: string | null;
  response: { leadTimeDays: number; notes: string | null; tiers: ConsultationTierRow[] } | null;
  declineNote: string | null;
}

export interface QuoteLineRow {
  quantity: number;
  unitPrice: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  leadTimeDays: number;
  /** Copied from the consultation the line was priced from — kept in the fixture, not published. */
  suggestedUnitPrice: string | null;
  consultationId: string | null;
  factory?: FactoryRef | null;
  buyUnitPrice?: string;
  marginPct?: string;
  belowMarginFloor: boolean;
  /** Shipping before VAT, as the line was priced; `0.00` when none was given. */
  shippingNetAmount?: string;
}

export interface QuoteRow {
  id: string;
  versionNo: number;
  status: Schemas["RfqQuoteStatus"];
  /** `YYYY-MM-DD`. A draft keeps the policy validity it would get; it is published without one. */
  validUntil: string;
  customerNote: string | null;
  lines: QuoteLineRow[];
  currency: "THB";
  createdBy: UserRef;
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
}

export interface RfqEventRow {
  id: string;
  at: string;
  /** `rfq.<verb>`, e.g. `rfq.assigned`, `rfq.consultation_responded`, `rfq.quote_sent`. */
  kind: string;
  title: string;
  actor: UserRef | null;
}

/** An action as the rule table offers it, before the reader's permissions are applied. */
export interface RfqActionRow {
  key: string;
  irreversible?: boolean;
  disabledReason?: string | null;
}

export interface RfqRow {
  id: string;
  rfqCode: string;
  channel: Schemas["SalesChannel"];
  status: Schemas["RfqStatus"];
  productType: { code: string; name: string };
  customer: { id: string; customerCode: string; displayName: string; companyName: string | null };
  quantities: number[];
  dimensions: { lengthMm: number | null; widthMm: number | null; heightMm: number | null } | null;
  /** `YYYY-MM-DD`. */
  targetDate: string | null;
  province: string | null;
  assignee: UserRef | null;
  /** The category's first-response target in business hours (`rfq.sla_business_hours`). */
  slaTargetHours: number;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  urgency: "normal" | "due_soon" | "late";
  consultationCounts: { requested: number; responded: number };
  latestQuote: { id: string; versionNo: number; status: Schemas["RfqQuoteStatus"]; validUntil: string } | null;
  routedFromCalculator: boolean;
  submittedAt: string;
  contact: { phone: string | null; email: string | null };
  /** The spec in words, label and value (Thai). */
  spec: { label: string; value: string }[];
  specSchemaVersion: number;
  notes: string | null;
  deliveryPostcode: string;
  files: RfqFileRow[];
  routedFrom: { reason: string; calculator: string | null } | null;
  declineReason: { code: string; name: string } | null;
  declineNote: string | null;
  acceptedQuotation: { id: string; quoteCode: string; versionNo: number; quantity: number } | null;
  consultations: ConsultationRow[];
  /** Every version, newest first. At most one is a draft. */
  quotes: QuoteRow[];
  quoteDefaults: { validUntil: string };
  events: RfqEventRow[];
  nextActions: RfqActionRow[];
}

/** One message of an RFQ's thread. A customer's message may have no named author. */
export interface RfqMessageRow {
  id: string;
  authorKind: "customer" | "staff";
  author: { id: string; displayName: string } | null;
  visibility: Schemas["MessageVisibility"];
  body: string;
  /** Files staff attached (`StaffRfqMessageInputDto.fileIds`). */
  fileIds?: string[];
  createdAt: string;
}
