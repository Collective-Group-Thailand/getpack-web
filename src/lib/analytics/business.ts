import { pushToDataLayer } from "./datalayer";

/**
 * The business, contact and getpack Factory pages (business redesign Phases 1–3, C10) — through the one
 * analytics channel (GLOBAL-RULES §5): GTM's `dataLayer`, only after the visitor accepted analytics
 * (`pk_consent`). Nothing identifies a person: a CTA target, a threshold the visitor set, a count, an intent
 * key, a reply channel, a volume bucket, capability keys. Never names, phones, e-mails, companies or messages.
 */
export interface BusinessEvents {
  biz_cta: { target: string };
  biz_sim_change: { threshold: number };
  biz_roi_change: { quotes: number; hours: number; approvals: number; hourly_cost: number };
  biz_doc_check: { n: number };
  biz_sales_submit: { volume: string };
  contact_intent: { intent: string };
  contact_answer_open: { q: string };
  contact_submit: { intent: string; channel: string };
  contact_track: { type: "order" | "ticket" };
  fx_cta: { target: string };
  fx_apply_submit: { capabilities: number };
}

export type BusinessEventName = keyof BusinessEvents;

export function trackBusiness<K extends BusinessEventName>(event: K, properties: BusinessEvents[K]): void {
  pushToDataLayer(event, properties);
}
