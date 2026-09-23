/**
 * `src/domain/status` — how a status looks and reads, for every zone.
 *
 * F0.2 laid down the shape; F1 1.3 fills it. `./contract.ts` holds the eleven vocabularies
 * and the note on where each one came from — that is the file to edit when `packio-api`
 * publishes the enums, and the only one.
 *
 * Nothing here imports from a feature or an app route: a status means the same thing in the
 * customer's order page, the admin queue and the partner job card.
 */

export { defineStatusMap, statusMeta, UNKNOWN_STATUS, type StatusMeta, type StatusTone } from "./types";

export type {
  ArtworkStatus,
  ClaimStatus,
  DocumentStatus,
  InstalmentStatus,
  JobStatus,
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  ProofStatus,
  RfqStatus,
  ShipmentStatus,
} from "./contract";

// Imported rather than re-exported straight through, because `STATUS_MAPS` below needs them
// in scope; `export { … } from` would not put them there.
import { ARTWORK_STATUS } from "./artwork";
import { CLAIM_STATUS } from "./claim";
import { DOCUMENT_STATUS } from "./document";
import { INSTALMENT_STATUS } from "./instalment";
import { JOB_STATUS } from "./job";
import { ORDER_STATUS } from "./order";
import { PAYMENT_STATUS } from "./payment";
import { PAYOUT_STATUS } from "./payout";
import { PROOF_STATUS } from "./proof";
import { RFQ_STATUS } from "./rfq";
import { SHIPMENT_STATUS } from "./shipment";

export {
  ARTWORK_STATUS,
  CLAIM_STATUS,
  DOCUMENT_STATUS,
  INSTALMENT_STATUS,
  JOB_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  PROOF_STATUS,
  RFQ_STATUS,
  SHIPMENT_STATUS,
};

export { nextActionMeta, primaryAction, UNKNOWN_ACTION, type NextAction, type NextActionMeta } from "./next-action";

/**
 * Every map in this folder, keyed by domain — for the tests that assert completeness and for
 * a Storybook page that renders the whole vocabulary at once. Screens import the map they
 * need by name; this is not a lookup table for rendering.
 */
export const STATUS_MAPS = {
  artwork: ARTWORK_STATUS,
  claim: CLAIM_STATUS,
  document: DOCUMENT_STATUS,
  instalment: INSTALMENT_STATUS,
  job: JOB_STATUS,
  order: ORDER_STATUS,
  payment: PAYMENT_STATUS,
  payout: PAYOUT_STATUS,
  proof: PROOF_STATUS,
  rfq: RFQ_STATUS,
  shipment: SHIPMENT_STATUS,
} as const;
