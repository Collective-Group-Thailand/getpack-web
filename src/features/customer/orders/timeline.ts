import { pick } from "@/features/customer/catalog/localize";
import type { Schemas } from "@/lib/api/types";

/** The timeline types the storefront has words for (`myOrders.timelineTypes`). */
const KNOWN = new Set([
  "order.placed",
  "payment.received",
  "artwork.submitted",
  "proof.sent",
  "proof.approved",
  "proof.changes_requested",
  "shipment.picked_up",
  "shipment.in_transit",
  "shipment.out_for_delivery",
  "shipment.delivered",
  "order.receipt_confirmed",
  "order.cancelled",
]);

/**
 * A timeline entry's title (`store.timeline.get`): the API sends what happened (`type`) and an i18n
 * key with its params for the client to render. A production milestone names itself (its
 * `labelTh`/`labelEn` params); the others are the storefront's words per type.
 *
 * CONTRACT-GAP store.orders — the contract does not list the keys it sends, so an entry the
 * storefront has no words for says "updated" rather than showing a key.
 */
export function timelineTitle(
  t: (key: string, values?: Record<string, string>) => string,
  locale: string,
  entry: Schemas["TimelineEntryDto"],
): string {
  const params = entry.params as { labelTh?: unknown; labelEn?: unknown };
  if (entry.type === "production.milestone_reached" && typeof params.labelTh === "string")
    return t("timelineTypes.production_milestone", {
      stage: pick(locale, params.labelTh, typeof params.labelEn === "string" ? params.labelEn : null),
    });
  return KNOWN.has(entry.type) ? t(`timelineTypes.${entry.type.replace(".", "_")}`) : t("timelineTypes.other");
}
