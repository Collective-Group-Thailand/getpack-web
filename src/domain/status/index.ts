/**
 * `src/domain/status` — how a status looks and reads, for every zone.
 *
 * `./contract.ts` holds the vocabularies and where each one comes from — that is the file to
 * edit when `packio-api` publishes an enum, and the only one.
 *
 * Nothing here imports from a feature or an app route: a status means the same thing in the
 * customer's order page, the admin queue and the partner job card.
 */

export { defineStatusMap, statusMeta, UNKNOWN_STATUS, type StatusMeta, type StatusTone } from "./types";

export type {
  ApprovalStatus,
  ApprovalStepStatus,
  ArtworkStatus,
  AuditOutcome,
  CampaignStatus,
  CatalogStatus,
  ClaimStatus,
  CompanyStatus,
  ConfigVersionStatus,
  ConsultationStatus,
  ContentStatus,
  CouponStatus,
  CreditStatus,
  DesignRoundStatus,
  DesignServiceStatus,
  DocumentStatus,
  FactoryStatus,
  FileScanStatus,
  InspectionStatus,
  InstalmentStatus,
  JobStatus,
  KycStatus,
  MemoStatus,
  MilestoneStatus,
  OnboardingStepStatus,
  OrderGroupStatus,
  OrderStatus,
  PayableStatus,
  PaymentStatus,
  PayoutStatus,
  PreflightStatus,
  PromotionStatus,
  ProofStatus,
  ProposalLineDecision,
  ProposalStatus,
  QuoteStatus,
  ReferralStatus,
  RefundStatus,
  RfqQuoteStatus,
  RfqStatus,
  SettingConfirmation,
  ShipmentStatus,
  SlipStatus,
  UserStatus,
} from "./contract";

// Imported rather than re-exported straight through, because `STATUS_MAPS` below needs them
// in scope; `export { … } from` would not put them there.
import { ARTWORK_STATUS } from "./artwork";
import { CATALOG_STATUS, CONTENT_STATUS } from "./catalogue";
import { CLAIM_STATUS } from "./claim";
import {
  COMPANY_STATUS,
  CREDIT_STATUS,
  MEMO_STATUS,
  ORDER_GROUP_STATUS,
  QUOTE_STATUS,
  REFUND_STATUS,
  SLIP_STATUS,
} from "./commerce";
import { DOCUMENT_STATUS } from "./document";
import {
  DESIGN_ROUND_STATUS,
  DESIGN_SERVICE_STATUS,
  DRAWING_STATUS,
  INSPECTION_STATUS,
  MILESTONE_STATUS,
  PREFLIGHT_STATUS,
  SUBMISSION_STATUS,
} from "./fulfilment";
import { INSTALMENT_STATUS } from "./instalment";
import { JOB_STATUS } from "./job";
import { CAMPAIGN_STATUS, COUPON_STATUS, PROMOTION_STATUS, REFERRAL_STATUS } from "./marketing";
import { ORDER_STATUS } from "./order";
import {
  BANK_ACCOUNT_STATUS,
  FACTORY_STATUS,
  KYC_STATUS,
  ONBOARDING_STEP_STATUS,
  PROPOSAL_LINE_STATUS,
  PROPOSAL_STATUS,
  SITE_VISIT_RESULT,
} from "./partners";
import { PAYMENT_STATUS } from "./payment";
import { PAYABLE_STATUS, PAYOUT_STATUS } from "./payout";
import {
  APPROVAL_STATUS,
  APPROVAL_STEP_STATUS,
  AUDIT_OUTCOME_STATUS,
  FILE_SCAN_STATUS,
  SETTING_CONFIRMATION_STATUS,
  SETTING_VERSION_STATUS,
  USER_STATUS,
} from "./platform";
import { PROOF_STATUS } from "./proof";
import { CONSULTATION_STATUS, RFQ_QUOTE_STATUS, RFQ_STATUS } from "./rfq";
import { SHIPMENT_STATUS } from "./shipment";

export {
  APPROVAL_STATUS,
  APPROVAL_STEP_STATUS,
  ARTWORK_STATUS,
  AUDIT_OUTCOME_STATUS,
  BANK_ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  CATALOG_STATUS,
  CLAIM_STATUS,
  COMPANY_STATUS,
  CONSULTATION_STATUS,
  CONTENT_STATUS,
  COUPON_STATUS,
  CREDIT_STATUS,
  DESIGN_ROUND_STATUS,
  DESIGN_SERVICE_STATUS,
  DOCUMENT_STATUS,
  DRAWING_STATUS,
  FACTORY_STATUS,
  FILE_SCAN_STATUS,
  INSPECTION_STATUS,
  INSTALMENT_STATUS,
  JOB_STATUS,
  KYC_STATUS,
  MEMO_STATUS,
  MILESTONE_STATUS,
  ONBOARDING_STEP_STATUS,
  ORDER_GROUP_STATUS,
  ORDER_STATUS,
  PAYABLE_STATUS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  PREFLIGHT_STATUS,
  PROMOTION_STATUS,
  PROOF_STATUS,
  PROPOSAL_LINE_STATUS,
  PROPOSAL_STATUS,
  QUOTE_STATUS,
  REFERRAL_STATUS,
  REFUND_STATUS,
  RFQ_QUOTE_STATUS,
  RFQ_STATUS,
  SETTING_CONFIRMATION_STATUS,
  SETTING_VERSION_STATUS,
  SHIPMENT_STATUS,
  SITE_VISIT_RESULT,
  SUBMISSION_STATUS,
  SLIP_STATUS,
  USER_STATUS,
};

export { nextActionMeta, primaryAction, UNKNOWN_ACTION, type NextAction, type NextActionMeta } from "./next-action";

/**
 * Every map in this folder, keyed by domain — for the tests that assert completeness and for
 * a Storybook page that renders the whole vocabulary at once. Screens import the map they
 * need by name; this is not a lookup table for rendering.
 */
export const STATUS_MAPS = {
  approval: APPROVAL_STATUS,
  approvalStep: APPROVAL_STEP_STATUS,
  artwork: ARTWORK_STATUS,
  auditOutcome: AUDIT_OUTCOME_STATUS,
  bankAccount: BANK_ACCOUNT_STATUS,
  campaign: CAMPAIGN_STATUS,
  catalog: CATALOG_STATUS,
  claim: CLAIM_STATUS,
  company: COMPANY_STATUS,
  consultation: CONSULTATION_STATUS,
  content: CONTENT_STATUS,
  coupon: COUPON_STATUS,
  credit: CREDIT_STATUS,
  designRound: DESIGN_ROUND_STATUS,
  designService: DESIGN_SERVICE_STATUS,
  document: DOCUMENT_STATUS,
  drawing: DRAWING_STATUS,
  factory: FACTORY_STATUS,
  fileScan: FILE_SCAN_STATUS,
  inspection: INSPECTION_STATUS,
  instalment: INSTALMENT_STATUS,
  job: JOB_STATUS,
  kyc: KYC_STATUS,
  memo: MEMO_STATUS,
  milestone: MILESTONE_STATUS,
  onboardingStep: ONBOARDING_STEP_STATUS,
  order: ORDER_STATUS,
  orderGroup: ORDER_GROUP_STATUS,
  payable: PAYABLE_STATUS,
  payment: PAYMENT_STATUS,
  payout: PAYOUT_STATUS,
  preflight: PREFLIGHT_STATUS,
  promotion: PROMOTION_STATUS,
  proof: PROOF_STATUS,
  proposal: PROPOSAL_STATUS,
  proposalLine: PROPOSAL_LINE_STATUS,
  quote: QUOTE_STATUS,
  referral: REFERRAL_STATUS,
  refund: REFUND_STATUS,
  rfq: RFQ_STATUS,
  rfqQuote: RFQ_QUOTE_STATUS,
  settingConfirmation: SETTING_CONFIRMATION_STATUS,
  settingVersion: SETTING_VERSION_STATUS,
  shipment: SHIPMENT_STATUS,
  siteVisit: SITE_VISIT_RESULT,
  slip: SLIP_STATUS,
  submission: SUBMISSION_STATUS,
  user: USER_STATUS,
} as const;
