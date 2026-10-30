import { pick } from "@/features/customer/catalog/localize";
import type { Schemas } from "@/lib/api/types";

type Translate = (key: string, values?: Record<string, string>) => string;
type Params = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

/** The timeline types the storefront has words for, each with the params its sentence uses. */
const LABELLED: Record<string, (params: Params) => Record<string, string>> = {
  "order.placed": () => ({}),
  "payment.initiated": () => ({}),
  "payment.received": () => ({}),
  "instalment.due": (p) => ({ seq: text(p["seq"]) }),
  "artwork.submitted": () => ({}),
  "artwork.preflight_completed": () => ({}),
  "artwork.accepted_for_proof": () => ({}),
  "proof.sent": () => ({}),
  "proof.approved": () => ({}),
  "proof.changes_requested": () => ({}),
  "production.queued": () => ({}),
  "shipment.ready": () => ({}),
  "shipment.picked_up": () => ({}),
  "shipment.in_transit": () => ({}),
  "shipment.out_for_delivery": () => ({}),
  "shipment.delivered": () => ({}),
  "delivery.reconciled": () => ({}),
  "customer_document.issued": (p) => ({ number: text(p["docNumber"]) }),
  "claim.submitted": (p) => ({ claimNo: text(p["claimNo"]) }),
  "claim.under_review": (p) => ({ claimNo: text(p["claimNo"]) }),
  "order.receipt_confirmed": () => ({}),
  "order.cancelled": () => ({}),
};

/** `CustomerDocumentType`: invoice, tax invoice / receipt, receipt, credit note, debit note. */
const DOCUMENT_KINDS = new Set<string>(["iv", "tr", "rc", "cn", "dn"]);

/**
 * A timeline entry's title (`store.timeline.get`), or `null` when the entry is left out.
 *
 * The API sends what happened (`type`) with its params; a production milestone names itself
 * (`labelTh`/`labelEn`), the others are the storefront's words per type. Bookkeeping the customer
 * sees elsewhere — the schedule being drawn up, the group mirroring its order, a status change the
 * entries around it explain, an instalment marked paid beside "payment received" — and any type the
 * storefront has no words for are left out, never a bare "order updated" repeated at one time
 * (round 2, B13).
 *
 * CONTRACT-GAP store.orders — the contract does not list the types it sends.
 */
export function timelineTitle(t: Translate, locale: string, entry: Schemas["TimelineEntryDto"]): string | null {
  const params = (entry.params ?? {}) as Params;
  if (entry.type === "production.milestone_reached") {
    if (typeof params["labelTh"] !== "string") return null;
    // The stage words from the API's message, not the raw params: rows written before D-439 keep the
    // old step words ("โรงงานรับงานแล้ว"), which the API rewrites for the customer (never a factory, D-050).
    return t("timelineTypes.production_milestone", { stage: pick(locale, entry.messageTh, entry.messageEn) });
  }
  const values = LABELLED[entry.type];
  if (!values) return null;
  if (entry.type === "customer_document.issued") {
    const kind = text(params["docType"]);
    return t(`timelineTypes.document.${DOCUMENT_KINDS.has(kind) ? kind : "other"}`, values(params));
  }
  return t(`timelineTypes.${entry.type.replace(".", "_")}`, values(params));
}
