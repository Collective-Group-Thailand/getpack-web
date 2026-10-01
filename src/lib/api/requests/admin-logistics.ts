/**
 * What is left of the logistics desk's requests after U-F0.4 moved every shipment operation onto
 * the published contract (`admin.shipments.*`): the claim resolution vocabulary the store's claim
 * request and the claims fixture model still share. No request is defined here any more.
 */

import { z } from "zod";

export const claimResolutionKind = z
  .enum(["reprint", "partial_refund", "full_refund", "credit"])
  .meta({ id: "ClaimResolutionKind" });
