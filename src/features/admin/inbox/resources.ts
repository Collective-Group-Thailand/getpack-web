/** The CS inbox list (U5.3, D-300), in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";

import { defineList } from "../console/resource";

export type Conversation = Schemas["ConversationDto"];

export const inboxList = defineList<Conversation>({
  key: "conversation",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/conversations", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.customer?.displayName ?? row.id,
  defaults: { filterKeys: ["status", "assigned", "subjectType", "channel", "sla"] },
  staleTime: STALE_TIME.live,
});

/** Where a subject or context card opens in the back office. */
export function adminRecordHref(card: { type: string; id: string }): string | null {
  switch (card.type) {
    case "order":
      return `/orders/${card.id}`;
    case "rfq":
      return `/rfq/${card.id}`;
    case "quote":
      return `/quotations/${card.id}`;
    case "design":
      return `/designs/${card.id}`;
    default:
      return null;
  }
}
