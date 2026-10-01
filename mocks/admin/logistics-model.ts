/**
 * The shape the fake claims are kept in — a mock-only model, wider than any one published claim. The
 * published claims are `AdminClaimDto`, `PartnerClaimDto` and `StoreClaimDto`; `./logistics.ts`,
 * `mocks/partner/account.ts` and `mocks/store/fulfilment.ts` turn a row into each on the way out, so
 * the three zones read the same rows (what the factory answers shows on the claims desk).
 *
 * Plain types over the contract's enums: the rows no longer lean on the request definitions the
 * zones migrated off (U-F0.4).
 */

import type { Schemas } from "@/lib/api/types";

type FileRef = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  url: string | null;
};
type UserRef = { id: string; displayName: string };

export interface ClaimDetail {
  id: string;
  claimNo: string;
  type: Schemas["ClaimType"];
  origin: Schemas["ClaimOrigin"];
  status: Schemas["ClaimStatus"];
  order: { id: string; orderCode: string };
  customer: { id: string; customerCode: string; displayName: string; companyName: string | null };
  factory: { id: string; code: string; name: string } | null;
  requestedResolution: Schemas["ClaimResolutionKind"];
  claimedAmount: string | null;
  liability: Schemas["ClaimLiability"];
  submittedAt: string;
  /** The SLA of the current step on the business calendar (not published: U2.5). */
  slaDueAt: string | null;
  shipment: { id: string; shipmentNo: string } | null;
  description: string;
  receivedAt: string;
  windowEndsAt: string;
  claimedQuantity: number | null;
  evidence: { productPhotos: FileRef[]; cartonPhotos: FileRef[] };
  /** What D-083 gives by rule, and whether a person overrode it. */
  liabilityByRule: Schemas["ClaimLiability"];
  liabilityRule: string;
  liabilityOverride: { by: UserRef; reason: string; at: string } | null;
  /** The artwork the customer approved, when liability may turn on it (D-083). */
  approvedProof: { id: string; versionNo: number; approvedAt: string } | null;
  factoryResponse: { response: Schemas["FactoryClaimResponse"]; note: string | null; at: string } | null;
  /** Files the factory attached to its answer (`claim.factory_evidence`). */
  factoryEvidenceFileIds?: string[];
  decision: { by: UserRef; at: string; reason: string } | null;
  resolutions: {
    action: Schemas["ClaimAction"];
    amount: string | null;
    reference: string | null;
    executedAt: string;
    executedBy: UserRef;
  }[];
  /** The fixture's thread (no message thread is published, D-225). */
  messages: { at: string; author: string; audience: "customer" | "factory" | "internal"; body: string }[];
  allowedActions: string[];
  allowedResolutions: Schemas["ClaimAction"][];
}
