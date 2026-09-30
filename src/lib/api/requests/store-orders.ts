/**
 * The rest of the customer's account still waiting on the contract (PDPA requests and sign-in
 * methods; D-143, D-144). Orders, loyalty and store credit are published (U-F0.2) and are read
 * through the generated client.
 */

import { z } from "zod";

import { dateTime, request, uuid } from "./define";
import { signedUrl } from "./store-quotes";

/* ---------------------------------------------------------------------------- the account */

export const privacyRequest = z
  .object({
    id: uuid(),
    kind: z.enum(["export", "delete"]).meta({ id: "PrivacyRequestKind" }),
    status: z.enum(["received", "in_progress", "completed", "rejected"]).meta({ id: "PrivacyRequestStatus" }),
    /** What the privacy team said, e.g. why a deletion must wait for open orders or tax records. */
    note: z.string().nullable(),
    /** An export's download, while it lasts. */
    download: signedUrl.nullable(),
    requestedAt: dateTime(),
    /** The PDPA response deadline the API computed. */
    dueAt: dateTime(),
  })
  .meta({ id: "PrivacyRequestDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeOrderRequests = {
  "GET /v1/store/me/privacy-requests": request({
    request: "store.privacy",
    summary: "The customer's data-export and deletion requests (PDPA)",
    response: z.object({ data: z.array(privacyRequest) }),
  }),
  "POST /v1/store/me/privacy-requests": request({
    request: "store.privacy",
    summary: "Ask for a copy of one's data, or for its deletion; the privacy team answers within the PDPA deadline",
    body: z.object({ kind: z.enum(["export", "delete"]), reason: z.string().trim().max(1000).optional() }),
    response: privacyRequest,
    status: 201,
    idempotent: true,
  }),
  "DELETE /v1/store/me/identities/{provider}": request({
    request: "store.identities",
    summary: "Unlink a sign-in method (LINE, Google, Apple) — refused for the last one left",
    status: 204,
  }),
} as const;
