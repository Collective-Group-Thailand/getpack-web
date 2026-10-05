/**
 * Structural design requests (U3.6, D-273): CS assigns a request to a structural designer, but the
 * published contract names the designer by id only, and the staff list (`admin.users.list`) needs
 * `users.read`, which CS does not hold. Asked for: the staff who may take a request.
 */

import { z } from "zod";

import { request } from "./define";

export const adminStructuralRequests = {
  "GET /v1/admin/structural-requests/designers": request({
    request: "admin.structural-request-designers",
    summary: "The staff a structural design request can be assigned to (holders of structural_requests.design)",
    response: z.object({
      data: z.array(z.object({ id: z.string(), displayName: z.string() }).meta({ id: "StructuralDesignerDto" })),
    }),
  }),
} as const;
