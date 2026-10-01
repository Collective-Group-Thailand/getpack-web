import type { Schemas } from "@/lib/api/types";

/*
 * Interim action rules for the admin entities that carry no `nextActions` in contract v0.6.0
 * (`entity.next-actions` covers orders, jobs, RFQs, shipments, claims, statements, payout runs and
 * documents — their screens render the API's list). Campaigns, promotions, coupons, prepress and
 * submissions stay here until packio-api publishes theirs; each rule is still the API's to refuse.
 */

/**
 * A lifecycle action on a campaign or a promotion, as the published operations name them
 * (`activate | pause | end`). `activate` on a paused one resumes it, so the screen words it
 * "resume" — the contract has no separate `resume` (triage `admin.campaigns`, `admin.promotions`).
 */
export interface AdminLifecycleAction {
  action: Schemas["PromotionAction"];
  resumes?: boolean;
}

const CAMPAIGN_LIFECYCLE: Record<Schemas["CampaignStatus"], readonly Schemas["PromotionAction"][]> = {
  draft: ["activate"],
  scheduled: ["pause", "end"],
  active: ["pause", "end"],
  paused: ["activate", "end"],
  exhausted: ["end"],
  ended: [],
};

const PROMOTION_LIFECYCLE: Record<Schemas["PromotionStatus"], readonly Schemas["PromotionAction"][]> = {
  draft: ["activate"],
  active: ["pause", "end"],
  paused: ["activate", "end"],
  ended: [],
};

const lifecycle = (actions: readonly Schemas["PromotionAction"][], paused: boolean): AdminLifecycleAction[] =>
  actions.map((action) => (paused && action === "activate" ? { action, resumes: true } : { action }));

/**
 * The actions a campaign offers (D-154), from its status and `campaigns.manage`.
 *
 * CONTRACT-GAP admin.campaigns — `CampaignDto` carries no `allowedActions` (packio-api U-B0.2), so
 * the campaign screen decides here what the workflow allows. An exhausted campaign is reopened by
 * raising its budget, not by an action. The API still refuses what it will not do.
 */
export function adminCampaignActions(
  status: Schemas["CampaignStatus"],
  can: (permission: string) => boolean,
): AdminLifecycleAction[] {
  return can("campaigns.manage") ? lifecycle(CAMPAIGN_LIFECYCLE[status], status === "paused") : [];
}

/**
 * The actions a promotion offers (D-053), from its status and `promotions.manage`.
 *
 * CONTRACT-GAP admin.promotions — `PromotionDto` carries no `allowedActions` (packio-api U-B0.2).
 * A coupon promotion without codes is still offered `activate`: the API answers
 * `promotions.no_codes`, and the screen shows it.
 */
export function adminPromotionActions(
  status: Schemas["PromotionStatus"],
  can: (permission: string) => boolean,
): AdminLifecycleAction[] {
  return can("promotions.manage") ? lifecycle(PROMOTION_LIFECYCLE[status], status === "paused") : [];
}

/**
 * What can be done to one coupon code (`admin.promotions.setCouponStatus`): an active code can be
 * disabled (leaked, misused), a disabled one enabled again; a used-up code has nothing left to
 * stop. Never on an ended promotion, and only with `promotions.manage`.
 */
export function adminCouponActions(
  coupon: { status: Schemas["CouponStatus"] },
  promotionStatus: Schemas["PromotionStatus"],
  can: (permission: string) => boolean,
): Schemas["CouponAction"][] {
  if (promotionStatus === "ended" || !can("promotions.manage")) return [];
  if (coupon.status === "active") return ["disable"];
  return coupon.status === "disabled" ? ["enable"] : [];
}

/* ------------------------------------------------------------------------------------ prepress */

/** What the prepress workspace knows about an order's artwork when it decides what to offer. */
export interface AdminPrepressFacts {
  artworkStatus: Schemas["ArtworkStatus"];
  /** The newest artwork submission's status, `null` before the first one. */
  latestSubmission: Schemas["SubmissionStatus"] | null;
  /** The newest proof's status, `null` before the first one. */
  latestProof: Schemas["ProofStatus"] | null;
  /** The hired design's status, `null` when the order did not hire one (or it is not found). */
  designService: Schemas["DesignServiceStatus"] | null;
}

export interface AdminPrepressAction {
  key: `prepress.${string}`;
  irreversible?: boolean;
}

/**
 * The actions prepress is offered on an order's workspace (F2 2.4, B4.1).
 *
 * CONTRACT-GAP admin.prepress — no workspace aggregate and no `nextActions` are published; the
 * workspace is composed from the artwork, proof, template and design-service resources, so what it
 * offers is read here from their statuses, in one place: a proof once the newest file is accepted
 * and no proof waits (D-070), a design round while one is in progress, a requote while the design
 * is open (D-071), the template while the order waits for it or for files. Assigning is still a
 * request (`admin.prepress-actions`). Every action stays the API's to refuse.
 */
export function adminPrepressActions(
  facts: AdminPrepressFacts,
  can: (permission: string) => boolean,
): AdminPrepressAction[] {
  const actions: AdminPrepressAction[] = [];
  const review = can("prepress.review");
  const design = can("design_services.manage");
  if (
    review &&
    facts.latestSubmission === "accepted_for_proof" &&
    (facts.latestProof === null || facts.latestProof === "changes_requested")
  ) {
    actions.push({ key: "prepress.upload_proof", irreversible: true });
  }
  if (design && facts.designService === "in_progress") {
    actions.push({ key: "prepress.deliver_round", irreversible: true });
  }
  if (review && (facts.artworkStatus === "awaiting_template" || facts.artworkStatus === "awaiting_upload")) {
    actions.push({ key: "prepress.send_template", irreversible: true });
  }
  // Routine and exceptional actions follow the stage's own work, so neither leads the header.
  if (review) actions.push({ key: "prepress.assign" });
  if (can("drawings.generate")) actions.push({ key: "prepress.draw_dieline" });
  if (design && (facts.designService === "in_progress" || facts.designService === "revision_requested")) {
    actions.push({ key: "prepress.requote_design", irreversible: true });
  }
  return actions;
}

/** Why a submission cannot be accepted yet — a code the screen puts into words. */
export type AdminSubmissionBlock = "preflight_blocked" | "preflight_pending";

export interface AdminSubmissionAction {
  key: "submission.accept" | "submission.reject";
  blockedBy?: AdminSubmissionBlock;
}

/**
 * Accept or send back one artwork submission (D-070): only a submitted file, only for
 * `prepress.review`. A blocking preflight result cannot be accepted, nor one still running —
 * packio-api answers `artwork.preflight_blocked` / `artwork.preflight_pending` to both.
 */
export function adminSubmissionActions(
  submission: Pick<Schemas["ArtworkSubmissionDto"], "status" | "preflightStatus">,
  can: (permission: string) => boolean,
): AdminSubmissionAction[] {
  if (submission.status !== "submitted" || !can("prepress.review")) return [];
  const blockedBy: AdminSubmissionBlock | undefined =
    submission.preflightStatus === "blocked"
      ? "preflight_blocked"
      : submission.preflightStatus === "pending" || submission.preflightStatus === "running"
        ? "preflight_pending"
        : undefined;
  return [{ key: "submission.accept", ...(blockedBy ? { blockedBy } : {}) }, { key: "submission.reject" }];
}
