/**
 * The order screen's tabs. A plain module: the page (a Server Component) validates `?tab=`
 * against this list, and an export of a `"use client"` module is only a reference on the server.
 */
export const ORDER_TABS = [
  "summary",
  "items",
  "payments",
  "artwork",
  "production",
  "shipments",
  "documents",
  "claims",
] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
