import { queryKeys } from "@/lib/api/query-keys";

/** The artwork of one order, shared by the artwork page, the design panel and the proof viewer. */
export const artworkKey = (orderId: string) => queryKeys.related("customer", "orders", orderId, "artwork");
