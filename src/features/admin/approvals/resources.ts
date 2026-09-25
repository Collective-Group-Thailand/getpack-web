/**
 * The approvals lists. A plain module, not a Client Component module: the Server Component that
 * renders the first page calls `fetch`, and an export of a `"use client"` module is only a
 * reference on the server.
 */

import { defineList } from "../console/resource";
import { POLICY_ICONS, type Approval } from "./presentation";

export const POLICIES = Object.keys(POLICY_ICONS);

export const approvalsList = defineList<Approval>({
  key: "approval",
  fetch: async ({ contract }, query) => (await contract.GET("/v1/admin/approvals", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  defaults: { sort: "createdAt", order: "desc" },
});
