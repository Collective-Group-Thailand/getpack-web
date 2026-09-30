import type { NextAction } from "@/domain/status/next-action";
import type { Schemas } from "@/lib/api/types";

/** What the storefront knows about an order when it decides what to offer. */
export interface OrderFacts {
  status: Schemas["OrderStatus"];
  artworkStatus: Schemas["ArtworkStatus"];
  designOption: Schemas["DesignOption"];
  /** A shipment of the order was delivered. */
  delivered: boolean;
  /** An instalment of the order's group is due now. */
  instalmentDue: boolean;
}

/**
 * The actions a customer is offered on an order, from its facts.
 *
 * CONTRACT-GAP entity.next-actions — no published order carries `nextActions` (packio-api delivers
 * them in U-B0.3), so until then the storefront reads the order's status, artwork status and
 * deliveries here, in one place, and offers what the workflow (D-073, D-081, D-082, D-153) would.
 * This only decides which buttons to show: every action is still the API's to refuse, with a
 * problem the page shows. Delete this module when the orders carry their own list.
 */
export function orderActions(order: OrderFacts): NextAction[] {
  const actions: NextAction[] = [];
  const open = order.status !== "cancelled" && order.status !== "completed";
  if (open && order.instalmentDue) actions.push({ key: "order.pay_instalment" });
  if (open && (order.artworkStatus === "awaiting_upload" || order.artworkStatus === "changes_requested"))
    actions.push({ key: order.designOption === "hired_design" ? "order.design_brief" : "order.upload_artwork" });
  if (open && order.artworkStatus === "proof_sent") actions.push({ key: "order.approve_proof" });
  if (order.status === "shipping" && order.delivered) actions.push({ key: "order.confirm_receipt" });
  const received = (order.status === "shipping" && order.delivered) || order.status === "completed";
  if (received) actions.push({ key: "order.open_claim" });
  // D-153: a delivered job can be ordered again, before or after its receipt is confirmed.
  if (received) actions.push({ key: "order.reorder" });
  return actions;
}

/** What the storefront knows about an order's artwork when it decides what to offer. */
export interface ArtworkFacts {
  artworkStatus: Schemas["ArtworkStatus"];
  designOption: Schemas["DesignOption"];
  /** The newest submission's preflight and review, if there is one. */
  latest: Pick<Schemas["ArtworkSubmissionDto"], "preflightStatus" | "status"> | null;
  /** A proof waits for the customer's decision. */
  proofPending: boolean;
  designServiceStatus: Schemas["DesignServiceStatus"] | null;
}

/** What the artwork page offers (CONTRACT-GAP entity.next-actions — see `orderActions`). */
export interface ArtworkActions {
  upload: boolean;
  reviewProof: boolean;
  submitBrief: boolean;
  /** Approve the delivered design, or ask for another round (D-071). */
  reviewDesign: boolean;
}

/**
 * The artwork a customer may send (D-070) and what they may decide on it (D-071, D-073): a new file
 * while none is accepted — or the last was blocked or sent back — and no proof waits; a proof to
 * review; the design brief, then the delivered design, for hired design.
 */
export function artworkActions(artwork: ArtworkFacts): ArtworkActions {
  const hired = artwork.designOption === "hired_design";
  const needsFile =
    ["awaiting_upload", "changes_requested", "awaiting_template", "uploaded"].includes(artwork.artworkStatus) ||
    artwork.latest?.preflightStatus === "blocked" ||
    artwork.latest?.status === "rejected";
  return {
    upload: !hired && needsFile && !artwork.proofPending && artwork.artworkStatus !== "approved",
    reviewProof: artwork.proofPending,
    submitBrief: artwork.designServiceStatus === "brief_pending",
    reviewDesign: artwork.designServiceStatus === "delivered" && artwork.proofPending,
  };
}

/**
 * Whether a sent quotation can be accepted now (D-051): the RFQ is quoted and the quotation is
 * the one sent (CONTRACT-GAP entity.next-actions — see `orderActions`).
 */
export function canAcceptQuotation(
  rfq: Pick<Schemas["RfqDto"], "status">,
  quotation: Pick<Schemas["RfqQuotationDto"], "status">,
): boolean {
  return rfq.status === "quoted" && quotation.status === "sent";
}
