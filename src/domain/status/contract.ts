/**
 * The status vocabularies, in the one place that has to change when the contract grows them.
 *
 * `00-master-plan.md` §5 wants every status map typed against a generated contract enum, so
 * that a value the backend adds fails `pnpm typecheck` until it has a tone, an icon and a
 * label. Two sources, marked on every line:
 *
 * - **contract** — the enum is a named component in `contract/openapi.json` already, so the
 *   type *is* `Schemas["…"]` and the compiler checks the map against the real vocabulary.
 * - **schema** — packio-api's approved `docs/schema-design.md` §4 (the enum catalogue, approved
 *   2026-09-23), where every value is listed and "each becomes a named OpenAPI component
 *   (PascalCase) when it appears in the contract. Values are only ever added." The endpoint
 *   that will carry it has not shipped, so the union is copied here verbatim — and when it
 *   does ship, the line becomes `Schemas["…"]` and any drift arrives as a type error.
 *
 * F1 had to propose seven of these vocabularies because the backend had none; the schema
 * design has since settled all of them, and its values replace those proposals (F2, 2026-09-25).
 * This is still the only file to edit.
 */

import type { Schemas } from "@/lib/api/types";

/** A customer order (one configuration). Driven by facts — instalments, artwork, jobs, shipments — not set by hand (B3.1). **Source: contract** (U-F0.2). */
export type OrderStatus = Schemas["OrderStatus"];

/** One checkout: a group of orders with one payment schedule (B3.1). **Source: schema** (`order_group_status`). */
export type OrderGroupStatus =
  "pending_company_approval" | "waiting_payment" | "in_progress" | "completed" | "cancelled";

/** One payment attempt against an instalment (B3.2, D-061). **Source: contract** (B5.2). */
export type PaymentStatus = Schemas["PaymentStatus"];

/** One instalment of an order group's payment schedule (D-020, D-122). **Source: schema** (`instalment_status`). */
export type InstalmentStatus = "pending" | "due" | "partially_paid" | "paid" | "overdue" | "cancelled" | "refunded";

/** A bank-transfer slip: verified automatically, only failures reach Finance (D-061). **Source: contract** (B5.2). */
export type SlipStatus = Schemas["SlipStatus"];

/** A refund, which needs approval (B3.2, D-169). **Source: contract** (B5.2). */
export type RefundStatus = Schemas["RefundStatus"];

/** A saved instant or CS quote, valid 15 days with the price locked (D-051). **Source: contract** (U-F0.2). */
export type QuoteStatus = Schemas["QuoteStatus"];

/** A discount memo, above the CS limit (D-052, D-162). **Source: schema** (`memo_status`). */
export type MemoStatus = "draft" | "pending_approval" | "approved" | "rejected" | "withdrawn" | "expired" | "applied";

/** A B2B company account (D-120). **Source: contract** (U-F0.3). */
export type CompanyStatus = Schemas["CompanyStatus"];

/** A company's credit standing (D-121, D-122). **Source: contract** (U-F0.3). */
export type CreditStatus = Schemas["CreditStatus"];

/** A campaign with a THB budget; auto-stops when exhausted (D-154). **Source: contract** (U-F0.3). */
export type CampaignStatus = Schemas["CampaignStatus"];

/** A coupon, automatic or referral promotion (D-053). **Source: contract** (U-F0.3). */
export type PromotionStatus = Schemas["PromotionStatus"];

/** One coupon code (D-053). **Source: contract** (U-F0.3). */
export type CouponStatus = Schemas["CouponStatus"];

/** Whether a promotion code a customer holds or checks can be used now (D-053). **Source: contract** (U-F0.4). */
export type PromotionOfferStatus = Schemas["PromotionOfferStatus"];

/** One line of the points ledger (D-132): pending until completion + claim window. **Source: contract** (U-F0.2). */
export type PointsStatus = Schemas["PointsStatus"];

/** A company's monthly statement (D-125, B5.2). **Proposed** in contract request `admin.company-credit`. */
export type StatementStatus = "open" | "paid" | "overdue";

/** The review of a proof of delivery (D-013): an accepted factory POD makes the payout eligible. **Proposed** in contract request `admin.shipments`. */
export type PodReviewStatus = "pending" | "accepted" | "rejected";

/** A member of a B2B company account (D-120). **Source: contract** (U-F0.3). */
export type MemberStatus = Schemas["MemberStatus"];

/** One referral, rewarded only after the referee's first order passes the claim window (D-136). **Source: contract** (U-F0.2). */
export type ReferralStatus = Schemas["ReferralStatus"];

/** The artwork of one order item. Production waits on this and on payment independently (D-073). **Source: contract** (U-F0.3). */
export type ArtworkStatus = Schemas["ArtworkStatus"];
export type SampleStatus = Schemas["SampleStatus"];
export type SampleKind = Schemas["SampleKind"];
export type CallOffStatus = Schemas["CallOffStatus"];
export type CallOffReleaseStatus = Schemas["CallOffReleaseStatus"];

/** A proof version sent to the customer (B4.1). **Source: contract** (U-F0.3). */
export type ProofStatus = Schemas["ProofStatus"];

/** The automated preflight of an artwork submission: blocks on size or bleed, warns on resolution or RGB (D-070). **Source: contract** (U-F0.3). */
export type PreflightStatus = Schemas["PreflightStatus"];

/** One version of the artwork a customer submitted, before and after prepress looked at it (B4.1). **Source: contract** (U-F0.3). */
export type SubmissionStatus = Schemas["SubmissionStatus"];

/** Drawing a dieline with `@packio/dieline`; `engine_unavailable` until the engine is deployed (B4.1). **Source: contract** (U-F0.3). */
export type DrawingStatus = Schemas["DrawingStatus"];

/** A hired design job: 3 free revision rounds, then paid (D-071). **Source: contract** (U-F0.3). */
export type DesignServiceStatus = Schemas["DesignServiceStatus"];

/** One round of a hired design; a paid round waits for payment (D-071). **Source: contract** (U-F0.3). */
export type DesignRoundStatus = Schemas["DesignRoundStatus"];

/** A request for quote, with an SLA per category (D-100, D-043). **Source: schema** (`rfq_status`). */
export type RfqStatus = "submitted" | "in_review" | "need_info" | "quoted" | "accepted" | "declined" | "expired";

/** A quote composed for an RFQ (B2.5). **Source: schema** (`rfq_quote_status`). */
export type RfqQuoteStatus = "draft" | "sent" | "accepted" | "superseded" | "expired";

/** A request to a factory for its price on an RFQ (B2.5). **Source: schema** (`consultation_status`). */
export type ConsultationStatus = "requested" | "responded" | "declined" | "expired";

/** A production job at a partner factory: accept within 1 business day (D-074). Lateness is a property the API reports beside the status, not a status. **Source: schema** (`production_job_status`). */
export type JobStatus = "released" | "accepted" | "rejected" | "in_progress" | "on_hold" | "completed" | "cancelled";

/** One stage of a job's route (D-075). **Source: schema** (`milestone_status`). */
export type MilestoneStatus = "pending" | "in_progress" | "completed" | "skipped";

/** A Packio QC inspection, chosen by risk-based sampling (D-076). **Source: schema** (`inspection_status`). */
export type InspectionStatus = "planned" | "in_progress" | "passed" | "failed" | "waived";

/** A delivery — by the factory's own fleet with mandatory POD, or a fallback carrier (D-013, D-114). **Source: schema** (`shipment_status`). */
export type ShipmentStatus =
  | "draft"
  | "ready"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | "cancelled";

/** A claim within 7 days of receipt; liability per D-083 (D-082). **Source: schema** (`claim_status`). */
export type ClaimStatus =
  "submitted" | "under_review" | "need_info" | "factory_review" | "approved" | "rejected" | "resolved" | "closed";

/** A payout run: Finance proposes, C-Level approves (D-022, D-166). **Source: schema** (`payout_run_status`). */
export type PayoutStatus =
  | "draft"
  | "proposed"
  | "pending_approval"
  | "approved"
  | "file_generated"
  | "sent"
  | "confirmed"
  | "partially_failed"
  | "posted"
  | "cancelled";

/** Money owed to a factory, before it joins a run (D-022). **Source: contract** (B5.3). */
export type PayableStatus = Schemas["PayableStatus"];

/** A customer document — tax invoice, receipt, credit note. A voided document keeps its number (accounting-design §4). **Source: contract** (B5.2). */
export type DocumentStatus = Schemas["CustomerDocumentStatus"];

/** A partner factory: at least one site visit before trial → active (D-011, D-041). **Source: contract** (B2.2). */
export type FactoryStatus = Schemas["FactoryStatus"];

/** One onboarding step of a factory (D-011). **Source: contract** (B2.2). */
export type OnboardingStepStatus = Schemas["OnboardingStepStatus"];

/** A KYC document of a factory or company (D-011, D-120). **Source: contract** (B2.2). */
export type KycStatus = Schemas["KycStatus"];

/** A price-list proposal or rate-card version (D-040, D-042). **Source: contract** (B2.2). */
export type ProposalStatus = Schemas["ProposalStatus"];

/** The decision on one line of a proposal (D-040). **Source: contract** (B2.2). */
export type ProposalLineDecision = Schemas["ProposalLineDecision"];

/** A catalogue record: product type, pattern, material, stock product (B2.1). **Source: schema** (`catalog_status`). */
export type CatalogStatus = "draft" | "active" | "inactive" | "archived";

/** CMS content: banners, articles, FAQs (B2.1). **Source: schema** (`content_status`). */
export type ContentStatus = "draft" | "published" | "archived";

/** A request in the generic approvals engine (ADR-0006). **Source: contract** (`ApprovalStatus`). */
export type ApprovalStatus = Schemas["ApprovalStatus"];

/** One step of an approval request. **Source: contract** (`ApprovalStepStatus`). */
export type ApprovalStepStatus = Schemas["ApprovalStepStatus"];

/** A staff, partner or customer account. **Source: contract** (`UserStatus`). */
export type UserStatus = Schemas["UserStatus"];

/** A version of an effective-dated setting or factory term — capacity, tier, tolerance, payout, pricing mode (ADR-0005, D-063). **Source: contract** (`ConfigVersionStatus`). */
export type ConfigVersionStatus = Schemas["ConfigVersionStatus"];

/** Whether a decision-backed value is confirmed or still awaiting sign-off (the ⚖ items). **Source: contract** (`SettingConfirmation`). */
export type SettingConfirmation = Schemas["SettingConfirmation"];

/** The outcome recorded for an audited action. **Source: contract** (`AuditOutcome`). */
export type AuditOutcome = Schemas["AuditOutcome"];

/** A launch-monitoring signal against its threshold (B6.3, D-113). **Source: contract** (`OpsSignalStatus`). */
export type OpsSignalStatus = Schemas["OpsSignalStatus"];

/** The malware scan of an uploaded file; only `clean` downloads. **Source: contract** (`FileScanStatus`). */
export type FileScanStatus = Schemas["FileScanStatus"];

/** A factory's bank account, dual-approved after a call-back (D-033). **Source: contract** (B2.2). */
export type BankAccountStatus = Schemas["BankAccountStatus"];

/** The outcome of a site visit, required before activation (D-041). **Source: contract** (B2.2). */
export type SiteVisitResult = Schemas["SiteVisitResult"];

/** A factory's request to the Partner team. **Source: contract** (U-B0.3). */
export type ChangeRequestStatus = Schemas["FactoryChangeRequestStatus"];

/** A factory's answer to one line of a shipping payout card (D-013, D-042). **Source: contract** (B2.2). */
export type RateLineAcceptance = Schemas["RateLineAcceptance"];

/** The factory's QC result (D-076). **Source: schema** (`qc_result`); proposed in contract request `partner.job-qc`. */
export type QcResult = "pass" | "fail" | "conditional";

/** An issue raised on a job. **Source: schema** (`issue_status`); proposed in contract request `partner.job-issues`. */
export type JobIssueStatus = "open" | "resolved";

/** A factory billing statement (D-090). **Source: schema** (`billing_statement_status`); proposed in contract request `partner.billing-statements`. */
export type BillingStatementStatus = Schemas["BillingStatementStatus"];

/** The factory's own tax invoice against a statement, as the factory sees it. **Source: contract** (U-B0.3). */
export type VendorInvoiceStatus = Schemas["VendorInvoiceStatus"];

/** Whether Packio can claim the input VAT of a factory bill. **Source: contract** (B5.3). */
export type InputVatStatus = Schemas["InputVatStatus"];

/** One payout to a factory in a payout run. **Source: contract** (B5.3). */
export type PayoutItemStatus = Schemas["PayoutItemStatus"];

/** A person who acts for a factory; created active, with no invitation step. **Source: contract** (U-B0.3). */
export type FactoryUserStatus = Schemas["FactoryUserStatus"];

/** An open item of customer AR: one invoice or final tax invoice still owed (accounting-design §6). **Source: contract** (B5.2). */
export type ReceivableStatus = Schemas["ArItemStatus"];

/** A customer's 50 ทวิ, chased until it arrives (accounting-design §2). **Source: contract** (B5.2). */
export type WhtCertificateStatus = Schemas["WhtCertStatus"];

/** A credit note asked for, issued only once a Finance Manager approves (D-169). **Source: contract** (B5.2). */
export type CreditNoteRequestStatus = Schemas["CreditNoteRequestStatus"];

/**
 * What became of a notification packio-api sent: a payment reminder (D-122) or a customer document
 * sent again (D-143). **Source: contract** (`NotificationStatus`, U-B0.3).
 */
export type DunningStatus = Schemas["NotificationStatus"];

/** A factory purchase order, one per released job (§6, D-022). **Source: contract** (B5.3). */
export type PurchaseOrderStatus = Schemas["PoStatus"];

/** A payout run as Finance works it: proposed, approved by C-Level, paid (D-022, D-166). **Source: contract** (B5.3). */
export type PayoutRunStatus = Schemas["PayoutRunStatus"];

/** A tax invoice or bill as Finance records it (§2). **Source: contract** (B5.3). */
export type VendorBillStatus = Schemas["VendorInvoiceStatus"];

/** A bank statement line and what became of it (§6). **Source: contract** (B5.3). */
export type BankMatchStatus = Schemas["BankMatchStatus"];

/** A gateway settlement, posted once it meets its bank line (P04). **Source: contract** (B5.3). */
export type SettlementStatus = Schemas["SettlementStatus"];

/** Money nobody has claimed yet, parked in 1140 (P29). **Source: contract** (B5.3). */
export type UnidentifiedReceiptStatus = Schemas["UnidentifiedReceiptStatus"];

/** A journal entry: drafted, checked by another person, posted (§1, §8). **Source: contract** (B5.1). */
export type JournalStatus = Schemas["JournalStatus"];

/** A fiscal period: `open ⇄ soft_closed → closed → locked` (§1.4). **Source: contract** (B5.1). */
export type PeriodStatus = Schemas["PeriodStatus"];

/** A recurring journal definition, approved once and posted monthly (§8). **Source: contract** (B5.1). */
export type RecurringJournalStatus = Schemas["RecurringJournalStatus"];

/** A tax report or working paper: final only at a GL difference of 0 (§7 step 7). **Source: contract** (B5.4). */
export type TaxReportStatus = Schemas["TaxReportStatus"];

/** A return on the tax calendar: open until it is filed (§6). **Source: contract** (B5.4). */
export type TaxCalendarStatus = Schemas["TaxCalendarStatus"];

/** A fixed asset in the register (D-150). **Source: contract** (B5.5). */
export type AssetStatus = Schemas["AssetStatus"];

/** A month's close checklist: worked, reviewed by another person, closed, locked (§7). **Source: contract** (B5.6). */
export type CloseStatus = Schemas["CloseStatus"];

/** One step of the close: a blocking check fails, it is done, or a Finance Manager waives it (§7). **Source: contract** (B5.6). */
export type CloseTaskStatus = Schemas["CloseTaskStatus"];
