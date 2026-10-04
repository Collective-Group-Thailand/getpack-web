import type { Schemas } from "@/lib/api/types";

import type { AnalyticsProperties, FunnelEvent } from "./events";

/**
 * The app's funnel vocabulary onto packio-api's ingest (`store.analytics.ingest`, contract
 * v0.6.0, triage `analytics.events`): a batch of `AnalyticsEventDto` in five names, each with a
 * closed property schema (packio-api `modules/analytics/event-schemas.ts`). Backend names win.
 *
 * - page_view, product_viewed → `page_view` (pageType from the route pattern);
 * - configurator_opened / configuration_changed → `configurator_step`;
 * - quote_shown → `quote_shown` (exact quantity and `instant`; the server bands the quantity);
 * - cart_item_added, reorder_added_to_cart → `add_to_cart` (exact quantity);
 * - checkout_started → `checkout_step started`; order_placed → `checkout_step placed` with its group.
 *
 * The rest — quote_abandoned, rfq_submitted, order_paid, the studio, claim and reorder journey steps
 * — are not sent: packio-api derives RFQs, orders, payments and abandonment from its own facts,
 * and the journey funnels wait for U5.B6 (`admin.analytics-journeys`, D-219). An event whose
 * required property the call site did not give is dropped rather than sent wrong.
 */

export type IngestEvent = Schemas["AnalyticsEventDto"];

export interface Visitor {
  anonymousId: string;
  sessionId: string;
}

type PageType =
  "home" | "category" | "product" | "configurator" | "cart" | "checkout" | "account" | "content" | "other";

/** The page type packio-api reports by, from a route pattern (`/products/[key]`). */
export function pageTypeOf(route: string | undefined): PageType {
  if (!route) return "other";
  const path = route.replace(/^\/en(?=\/|$)/, "") || "/";
  if (path === "/") return "home";
  if (path.startsWith("/configure")) return "configurator";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/account") || path.startsWith("/business")) return "account";
  if (path.startsWith("/products/")) return "product";
  if (path === "/products" || path.startsWith("/categories")) return "category";
  if (/^\/(articles|faq|help|about|legal|policies)/.test(path)) return "content";
  return "other";
}

type Mapped = Pick<IngestEvent, "name" | "properties">;

function map(name: FunnelEvent, props: AnalyticsProperties): Mapped | null {
  switch (name) {
    case "page_view":
      return { name: "page_view", properties: { pageType: pageTypeOf(props.route) } };
    case "product_viewed":
      return { name: "page_view", properties: { pageType: "product" } };
    case "configurator_opened":
      return { name: "configurator_step", properties: { step: "opened", stepIndex: 0 } };
    case "configuration_changed":
      return { name: "configurator_step", properties: { step: "changed" } };
    case "quote_shown":
      if (props.quantity === undefined) return null;
      return {
        name: "quote_shown",
        properties: {
          quantity: props.quantity,
          instant: props.quoteMode !== "rfq",
          ...(props.leadTimeDays !== undefined ? { leadTimeDays: props.leadTimeDays } : {}),
          ...(props.unitPrice !== undefined ? { unitPrice: props.unitPrice } : {}),
        },
      };
    case "cart_item_added":
    case "reorder_added_to_cart":
      return props.quantity === undefined ? null : { name: "add_to_cart", properties: { quantity: props.quantity } };
    case "studio_started":
    case "studio_box_confirmed":
    case "studio_first_artwork":
    case "studio_checks_clean":
    case "studio_ordered":
      return { name, properties: studioProperties(props) };
    case "studio_add_to_cart":
      return props.quantity === undefined
        ? null
        : { name, properties: { ...studioProperties(props), quantity: props.quantity } };
    case "checkout_started":
      return { name: "checkout_step", properties: { step: "started" } };
    case "order_placed":
      return props.orderGroupId
        ? { name: "checkout_step", properties: { step: "placed", orderGroupId: props.orderGroupId } }
        : null;
    default:
      return null;
  }
}

/** D-286: a studio event carries the print method and the style family, and nothing else. */
function studioProperties(props: AnalyticsProperties): Record<string, string> {
  return {
    ...(props.printMethod ? { printMethod: props.printMethod } : {}),
    ...(props.styleFamily && /^[a-z][a-z0-9_]{0,59}$/.test(props.styleFamily) ? { styleFamily: props.styleFamily } : {}),
  };
}

/** One ingest event, or `null` when packio-api takes no such event (or it lacks what it requires). */
export function toIngestEvent(
  name: FunnelEvent,
  props: AnalyticsProperties,
  visitor: Visitor,
  now: Date,
  eventId: string,
): IngestEvent | null {
  const mapped = map(name, props);
  if (!mapped) return null;
  return {
    eventId,
    ...mapped,
    occurredAt: now.toISOString(),
    anonymousId: visitor.anonymousId,
    sessionId: visitor.sessionId,
    ...(props.route ? { pagePath: props.route } : {}),
    ...(props.productType ? { productTypeCode: props.productType } : {}),
    ...(props.postcode ? { postcode: props.postcode } : {}),
  };
}
