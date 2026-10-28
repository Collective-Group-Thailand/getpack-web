import { pushToDataLayer } from "./datalayer";

/**
 * What customers do in their orders (account pack Phases 2–3, C6) — through the catalogue wrapper's channel
 * (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor accepted analytics (`pk_consent`). Nothing identifies
 * a person or a factory: a tab, a customer status, an action key, a document type.
 */
export interface AccountEvents {
  /** A status tab of the orders list was opened. */
  orders_tab: { tab: string };
  /** The orders list was searched (the length only — never the text, which may be a PO number). */
  orders_search: { length: number };
  /** An action on a card of the orders list or of its "ต้องทำตอนนี้" strip. */
  orders_action: { action: string; status: string };
  /** The filtered list was exported. */
  orders_export: { tab: string; format: "csv" };
  /** An order page was opened. */
  order_view: { status: string };
  /** A production or delivery photo was opened. */
  order_photo_open: { kind: "production" | "delivery" };
  /** A document of the order was downloaded. */
  order_doc_download: { type: string };
  /** Photos or details were added to the order's claim. */
  order_claim_add: { status: string };
  /** "สั่งซ้ำ" from the order page. */
  order_reorder: { status: string };
  /** A message about the order was started. */
  order_message_send: { status: string };
}

export type AccountEventName = keyof AccountEvents;

export function trackAccount<K extends AccountEventName>(event: K, properties: AccountEvents[K]): void {
  pushToDataLayer(event, properties);
}
