import { defineStatusMap } from "./types";
import type {
  RateLineAcceptance,
  ChangeRequestStatus,
  BankAccountStatus,
  FactoryStatus,
  KycStatus,
  OnboardingStepStatus,
  ProposalLineDecision,
  ProposalStatus,
  SiteVisitResult,
} from "./contract";

/** A partner factory: at least one site visit before trial → active (D-011, D-041). */
export const FACTORY_STATUS = defineStatusMap<FactoryStatus>({
  applied: { tone: "info", icon: "inbox", labelKey: "factory.applied" },
  under_review: { tone: "warning", icon: "eye", labelKey: "factory.underReview" },
  trial: { tone: "primary", icon: "timer", labelKey: "factory.trial" },
  active: { tone: "success", icon: "check", labelKey: "factory.active" },
  suspended: { tone: "danger", icon: "pause", labelKey: "factory.suspended" },
  offboarded: { tone: "neutral", icon: "archive", labelKey: "factory.offboarded" },
});

/** One onboarding step of a factory (D-011). */
export const ONBOARDING_STEP_STATUS = defineStatusMap<OnboardingStepStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "onboardingStep.pending" },
  in_progress: { tone: "primary", icon: "refresh", labelKey: "onboardingStep.inProgress" },
  submitted: { tone: "info", icon: "send", labelKey: "onboardingStep.submitted" },
  approved: { tone: "success", icon: "check", labelKey: "onboardingStep.approved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "onboardingStep.rejected" },
  waived: { tone: "neutral", icon: "minus", labelKey: "onboardingStep.waived" },
});

/** A KYC document of a factory or company (D-011, D-120). */
export const KYC_STATUS = defineStatusMap<KycStatus>({
  pending: { tone: "neutral", icon: "clock", labelKey: "kyc.pending" },
  verified: { tone: "success", icon: "shield", labelKey: "kyc.verified" },
  rejected: { tone: "danger", icon: "ban", labelKey: "kyc.rejected" },
  expired: { tone: "warning", icon: "hourglass", labelKey: "kyc.expired" },
});

/** A price-list proposal or rate-card version (D-040, D-042). */
export const PROPOSAL_STATUS = defineStatusMap<ProposalStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "proposal.draft" },
  submitted: { tone: "info", icon: "send", labelKey: "proposal.submitted" },
  under_review: { tone: "warning", icon: "eye", labelKey: "proposal.underReview" },
  countered: { tone: "warning", icon: "scale", labelKey: "proposal.countered" },
  approved: { tone: "success", icon: "check", labelKey: "proposal.approved" },
  partially_approved: { tone: "warning", icon: "checklist", labelKey: "proposal.partiallyApproved" },
  rejected: { tone: "danger", icon: "ban", labelKey: "proposal.rejected" },
  withdrawn: { tone: "neutral", icon: "undo", labelKey: "proposal.withdrawn" },
  accepted_by_factory: { tone: "success", icon: "handshake", labelKey: "proposal.acceptedByFactory" },
});

/** The decision on one line of a proposal (D-040). */
export const PROPOSAL_LINE_STATUS = defineStatusMap<ProposalLineDecision>({
  pending: { tone: "neutral", icon: "clock", labelKey: "proposalLine.pending" },
  accepted: { tone: "success", icon: "check", labelKey: "proposalLine.accepted" },
  rejected: { tone: "danger", icon: "ban", labelKey: "proposalLine.rejected" },
  countered: { tone: "warning", icon: "scale", labelKey: "proposalLine.countered" },
});

/** A factory's bank account (D-033): a change is dual-approved after a call-back. */
export const BANK_ACCOUNT_STATUS = defineStatusMap<BankAccountStatus>({
  pending_approval: { tone: "warning", icon: "hourglass", labelKey: "bankAccount.pendingApproval" },
  active: { tone: "success", icon: "check", labelKey: "bankAccount.active" },
  superseded: { tone: "neutral", icon: "history", labelKey: "bankAccount.superseded" },
  rejected: { tone: "danger", icon: "ban", labelKey: "bankAccount.rejected" },
});

/** A site visit's outcome (D-041). */
export const SITE_VISIT_RESULT = defineStatusMap<SiteVisitResult>({
  pass: { tone: "success", icon: "check", labelKey: "siteVisit.pass" },
  conditional: { tone: "warning", icon: "warning", labelKey: "siteVisit.conditional" },
  fail: { tone: "danger", icon: "ban", labelKey: "siteVisit.fail" },
});

/** A factory's request to the Partner team (D-011): the team answers, nothing changes until it does. */
export const CHANGE_REQUEST_STATUS = defineStatusMap<ChangeRequestStatus>({
  open: { tone: "info", icon: "inbox", labelKey: "changeRequest.open" },
  in_progress: { tone: "primary", icon: "refresh", labelKey: "changeRequest.inProgress" },
  done: { tone: "success", icon: "check", labelKey: "changeRequest.done" },
  declined: { tone: "neutral", icon: "ban", labelKey: "changeRequest.declined" },
});

/** A factory's answer to one line of a shipping payout card (D-013, D-042). */
export const RATE_LINE_ACCEPTANCE = defineStatusMap<RateLineAcceptance>({
  pending: { tone: "neutral", icon: "clock", labelKey: "rateLine.pending" },
  accepted: { tone: "success", icon: "check", labelKey: "rateLine.accepted" },
  countered: { tone: "warning", icon: "scale", labelKey: "rateLine.countered" },
});
