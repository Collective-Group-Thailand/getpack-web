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

/** A customer order (one configuration). Driven by facts — instalments, artwork, jobs, shipments — not set by hand (B3.1). **Source: schema** (`order_status`). */
export type OrderStatus =
  | "waiting_payment"
  | "paid_for_production"
  | "artwork_approved"
  | "in_production"
  | "shipping"
  | "completed"
  | "cancelled";

/** One checkout: a group of orders with one payment schedule (B3.1). **Source: schema** (`order_group_status`). */
export type OrderGroupStatus =
  "pending_company_approval" | "waiting_payment" | "in_progress" | "completed" | "cancelled";

/** One payment attempt against an instalment (B3.2, D-061). **Source: schema** (`payment_status`). */
export type PaymentStatus =
  | "initiated"
  | "pending"
  | "awaiting_verification"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "partially_refunded";

/** One instalment of an order group's payment schedule (D-020, D-122). **Source: schema** (`instalment_status`). */
export type InstalmentStatus = "pending" | "due" | "partially_paid" | "paid" | "overdue" | "cancelled" | "refunded";

/** A bank-transfer slip: verified automatically, only failures reach Finance (D-061). **Source: schema** (`slip_status`). */
export type SlipStatus = "pending" | "passed" | "failed" | "manual_review" | "manual_approved" | "manual_rejected";

/** A refund, which needs approval (B3.2, D-169). **Source: schema** (`refund_status`). */
export type RefundStatus =
  "requested" | "pending_approval" | "approved" | "processing" | "succeeded" | "failed" | "rejected";

/** A saved instant or CS quote, valid 15 days with the price locked (D-051). **Source: schema** (`quote_status`). */
export type QuoteStatus = "calculated" | "saved" | "shared" | "converted" | "expired" | "superseded";

/** A discount memo, above the CS limit (D-052, D-162). **Source: schema** (`memo_status`). */
export type MemoStatus = "draft" | "pending_approval" | "approved" | "rejected" | "withdrawn" | "expired" | "applied";

/** A B2B company account (D-120). **Source: schema** (`company_status`). */
export type CompanyStatus = "applied" | "kyc_review" | "active" | "suspended" | "closed";

/** A company's credit standing (D-121, D-122). **Source: schema** (`credit_status`). */
export type CreditStatus = "prepaid" | "eligible" | "credit" | "blocked_overdue";

/** A campaign with a THB budget; auto-stops when exhausted (D-154). **Source: schema** (`campaign_status`). */
export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "exhausted" | "ended";

/** A coupon, automatic or referral promotion (D-053). **Source: schema** (`promotion_status`). */
export type PromotionStatus = "draft" | "active" | "paused" | "ended";

/** One coupon code (D-053). **Source: schema** (`coupon_status`). */
export type CouponStatus = "active" | "used_up" | "disabled";

/** One referral, rewarded only after the referee's first order passes the claim window (D-136). **Source: schema** (`referral_status`). */
export type ReferralStatus = "pending" | "qualified" | "rewarded" | "rejected_fraud" | "under_review";

/** The artwork of one order item. Production waits on this and on payment independently (D-073). **Source: schema** (`artwork_status`). */
export type ArtworkStatus =
  "awaiting_template" | "awaiting_upload" | "uploaded" | "in_review" | "proof_sent" | "changes_requested" | "approved";

/** A proof version sent to the customer (B4.1). **Source: schema** (`proof_status`). */
export type ProofStatus = "pending_customer" | "approved" | "changes_requested" | "superseded";

/** The automated preflight of an artwork submission: blocks on size or bleed, warns on resolution or RGB (D-070). **Source: schema** (`preflight_status`). */
export type PreflightStatus = "pending" | "running" | "passed" | "passed_with_warnings" | "blocked" | "error";

/** One version of the artwork a customer submitted, before and after prepress looked at it (B4.1). **Source: schema** (`submission_status`). */
export type SubmissionStatus = "submitted" | "superseded" | "accepted_for_proof" | "rejected";

/** Drawing a dieline with `@packio/dieline`; `engine_unavailable` until the engine is deployed (B4.1). **Source: schema** (`drawing_status`). */
export type DrawingStatus = "queued" | "running" | "succeeded" | "failed" | "engine_unavailable";

/** A hired design job: 3 free revision rounds, then paid (D-071). **Source: schema** (`design_service_status`). */
export type DesignServiceStatus =
  "brief_pending" | "in_progress" | "delivered" | "revision_requested" | "approved" | "cancelled" | "requoted";

/** One round of a hired design; a paid round waits for payment (D-071). **Source: schema** (`design_round_status`). */
export type DesignRoundStatus = "awaiting_payment" | "in_progress" | "delivered" | "approved" | "changes_requested";

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

/** Money owed to a factory, before it joins a run (D-022). **Source: schema** (`payable_status`). */
export type PayableStatus = "open" | "eligible" | "in_run" | "paid" | "cancelled";

/** A customer document — tax invoice, receipt, credit note. A voided document keeps its number (accounting-design §5). **Source: schema** (`customer_document_status`). */
export type DocumentStatus = "issued" | "void";

/** A partner factory: at least one site visit before trial → active (D-011, D-041). **Source: schema** (`factory_status`). */
export type FactoryStatus = "applied" | "under_review" | "trial" | "active" | "suspended" | "offboarded";

/** One onboarding step of a factory (D-011). **Source: schema** (`onboarding_step_status`). */
export type OnboardingStepStatus = "pending" | "in_progress" | "submitted" | "approved" | "rejected" | "waived";

/** A KYC document of a factory or company (D-011, D-120). **Source: schema** (`kyc_status`). */
export type KycStatus = "pending" | "verified" | "rejected" | "expired";

/** A price-list proposal or rate-card version (D-040, D-042). **Source: schema** (`proposal_status`). */
export type ProposalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "countered"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "withdrawn"
  | "accepted_by_factory";

/** The decision on one line of a proposal (D-040). **Source: schema** (`proposal_line_decision`). */
export type ProposalLineDecision = "pending" | "accepted" | "rejected" | "countered";

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

/** A version of an effective-dated setting (ADR-0005, D-063). **Source: contract** (`ConfigVersionStatus`). */
export type ConfigVersionStatus = Schemas["ConfigVersionStatus"];

/** Whether a decision-backed value is confirmed or still awaiting sign-off (the ⚖ items). **Source: contract** (`SettingConfirmation`). */
export type SettingConfirmation = Schemas["SettingConfirmation"];

/** The outcome recorded for an audited action. **Source: contract** (`AuditOutcome`). */
export type AuditOutcome = Schemas["AuditOutcome"];

/** The malware scan of an uploaded file; only `clean` downloads. **Source: contract** (`FileScanStatus`). */
export type FileScanStatus = Schemas["FileScanStatus"];
