import type { Schemas } from "@/lib/api/types";

/** What the back office knows about an order when it decides what to offer. */
export interface AdminOrderFacts {
  status: Schemas["OrderStatus"];
  artworkStatus: Schemas["ArtworkStatus"];
  /** A slip of the order's group waits for Finance (read from the slip queue, `payments.verify_slip`). */
  slipToReview: boolean;
}

/** Why an offered action cannot be taken yet — a code the screen puts into words. */
export type AdminOrderBlock = "artwork_not_approved";

export interface AdminOrderAction {
  key: `order.${string}`;
  irreversible?: boolean;
  blockedBy?: AdminOrderBlock;
}

const BEFORE_PRODUCTION: readonly Schemas["OrderStatus"][] = [
  "waiting_payment",
  "paid_for_production",
  "artwork_approved",
];

/**
 * The actions staff are offered on an order, from its facts and what the actor may do.
 *
 * CONTRACT-GAP entity.next-actions — the published `AdminOrderDto` carries no `nextActions`
 * (packio-api delivers them in U-B0.3), so until then the order desk reads the status here, in one
 * place, and offers what the workflow would (D-060 cancel before production, D-061 slip review,
 * D-073 manual start as an exception). It only decides which buttons to show: every action is
 * still the API's to refuse, and the problem it answers is shown. Delete this when the order
 * carries its own list.
 */
export function adminOrderActions(order: AdminOrderFacts, can: (permission: string) => boolean): AdminOrderAction[] {
  const actions: AdminOrderAction[] = [];
  if (order.slipToReview && can("payments.verify_slip")) {
    actions.push({ key: "order.approve_slip", irreversible: true }, { key: "order.reject_slip" });
  }
  if (order.status === "waiting_payment" && can("orders.manage")) {
    actions.push({ key: "order.send_payment_reminder" }, { key: "order.record_slip", irreversible: true });
  }
  if (
    (order.status === "paid_for_production" || order.status === "artwork_approved") &&
    can("production.start_manual")
  ) {
    actions.push({
      key: "order.start_production",
      irreversible: true,
      ...(order.artworkStatus === "approved" ? {} : { blockedBy: "artwork_not_approved" as const }),
    });
  }
  if (BEFORE_PRODUCTION.includes(order.status) && can("orders.cancel")) {
    actions.push({ key: "order.cancel", irreversible: true });
  }
  return actions;
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

export interface AdminDesignActions {
  /** Saving in the designer (`admin.designs.save`, `catalog.manage`). */
  save: boolean;
  /** Making a staff copy (a request, `admin.design-documents`). */
  copy: boolean;
}

/**
 * What staff may do with a design opened in the back office (F4 C.2).
 *
 * CONTRACT-GAP admin.design-documents — the published design carries no `editable` flag and no
 * owner, and saving is allowed only on the staff author's own designs. The designer is therefore
 * editable for whoever holds the save permission, and packio-api refuses a save on anyone else's
 * design (the designer shows the failed save). Copying is offered to prepress.
 */
export function adminDesignActions(can: (permission: string) => boolean): AdminDesignActions {
  return { save: can("catalog.manage"), copy: can("prepress.review") };
}
