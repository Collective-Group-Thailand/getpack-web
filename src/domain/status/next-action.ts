/**
 * How an action the API has offered is presented — never which actions exist.
 *
 * `00-master-plan.md` §4 and ADR-0005 put authorisation in one place: the API. A screen that
 * decides for itself that "an order in `paid` may start production" has copied a business rule
 * into the browser, where it will drift from the backend and eventually offer a button that
 * 409s. So every entity carries its own list — `nextActions` / `allowedActions` — and this
 * module's only job is turning a key the API sent into a label, a tone and an icon.
 *
 * The consequence worth stating: an action key this table does not know still renders, as its
 * own key with a neutral tone, because hiding an action the API said was available is worse
 * than showing one that reads awkwardly. `pnpm typecheck` cannot catch a missing entry here —
 * the keys are data, not a union — so the fallback is the safety net.
 *
 * CONTRACT-REQUEST `entity.next-actions`: no endpoint publishes this list yet. The shape below
 * is what the UI needs and what `docs/contract-requests.md` asks for; F2–F6 wire it to real
 * responses as their screens arrive.
 */

import type { IconName } from "@/ui/icons";

import type { StatusTone } from "./types";

/** One action the API says this actor may take on this entity, right now. */
export interface NextAction {
  /** Stable, machine-readable, from the API — e.g. `order.approve_slip`. */
  key: string;
  /**
   * Whether taking it needs a typed confirmation that restates the target, and an
   * `Idempotency-Key` (Definition of Done, `00-master-plan.md` §8). The **API** marks this,
   * because whether an act can be undone is a backend fact.
   */
  irreversible?: boolean;
  /** Set by the API when this action is offered but currently blocked, with a reason. */
  disabledReason?: string | null;
}

export interface NextActionMeta {
  tone: StatusTone;
  icon: IconName;
  /** Key inside the `status` message namespace, under `action.`. */
  labelKey: string;
}

/**
 * Presentation for the action keys the product uses so far.
 *
 * Deliberately a flat table rather than one per domain: "approve" should look the same whether
 * it is a slip, a proof or a payout run, and splitting it per feature is how that stops being
 * true. Entries are added here as F2–F6 meet new keys.
 */
const ACTION_META: Record<string, NextActionMeta> = {
  approve: { tone: "success", icon: "check", labelKey: "action.approve" },
  reject: { tone: "danger", icon: "ban", labelKey: "action.reject" },
  cancel: { tone: "danger", icon: "close", labelKey: "action.cancel" },
  submit: { tone: "primary", icon: "send", labelKey: "action.submit" },
  pay: { tone: "primary", icon: "credit-card", labelKey: "action.pay" },
  upload: { tone: "primary", icon: "upload", labelKey: "action.upload" },
  request_changes: { tone: "warning", icon: "edit", labelKey: "action.requestChanges" },
  start_production: { tone: "primary", icon: "factory", labelKey: "action.startProduction" },
  ship: { tone: "primary", icon: "truck", labelKey: "action.ship" },
  confirm_receipt: { tone: "success", icon: "package-check", labelKey: "action.confirmReceipt" },
  reorder: { tone: "neutral", icon: "refresh", labelKey: "action.reorder" },
  claim: { tone: "warning", icon: "flag", labelKey: "action.claim" },
  // Work-queue verbs (F2 2.3 RFQ desk first; the same verbs will serve prepress and claims).
  start_review: { tone: "primary", icon: "eye", labelKey: "action.startReview" },
  assign: { tone: "neutral", icon: "user-plus", labelKey: "action.assign" },
  request_info: { tone: "warning", icon: "help", labelKey: "action.requestInfo" },
  decline: { tone: "danger", icon: "ban", labelKey: "action.decline" },
  create_order: { tone: "primary", icon: "cart", labelKey: "action.createOrder" },
  request_factory_cost: { tone: "primary", icon: "factory", labelKey: "action.requestFactoryCost" },
  compose_quote: { tone: "primary", icon: "edit", labelKey: "action.composeQuote" },
  edit_quote: { tone: "neutral", icon: "edit", labelKey: "action.editQuote" },
  send_quote: { tone: "primary", icon: "send", labelKey: "action.sendQuote" },
  record_acceptance: { tone: "success", icon: "check", labelKey: "action.recordAcceptance" },
  // Prepress (F2 2.4).
  send_template: { tone: "primary", icon: "send", labelKey: "action.sendTemplate" },
  deliver_round: { tone: "primary", icon: "send", labelKey: "action.deliverRound" },
  draw_dieline: { tone: "neutral", icon: "ruler", labelKey: "action.drawDieline" },
  requote_design: { tone: "warning", icon: "refresh", labelKey: "action.requoteDesign" },
  // The customer's own order actions (F3 3.4–3.6).
  "order.pay_instalment": { tone: "primary", icon: "credit-card", labelKey: "action.payInstalment" },
  "order.upload_artwork": { tone: "primary", icon: "upload", labelKey: "action.uploadArtwork" },
  "order.approve_proof": { tone: "primary", icon: "file-check", labelKey: "action.reviewProof" },
  "order.open_claim": { tone: "warning", icon: "flag", labelKey: "action.openClaim" },
};

/** Falls back to something visible and pressable rather than dropping the action. */
export const UNKNOWN_ACTION: NextActionMeta = {
  tone: "neutral",
  icon: "more",
  labelKey: "action.unknown",
};

/**
 * Presentation for one action key.
 *
 * The lookup tries the whole key first (`order.approve_slip`) and then the verb after the last
 * dot (`approve_slip` → `approve`), so a new domain gets sensible presentation for the verbs
 * the product already has without an entry per entity.
 */
export function nextActionMeta(key: string): NextActionMeta {
  const exact = ACTION_META[key];
  if (exact) return exact;

  const verb = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  return ACTION_META[verb] ?? ACTION_META[verb.split("_")[0] ?? ""] ?? UNKNOWN_ACTION;
}

/**
 * The single action a header should lead with, or `undefined`.
 *
 * design-system.md §1 allows one primary action per view, and §4 wants "status badge(s) + the
 * single next best action". The API's ordering is respected — it knows the workflow — so this
 * is the first action that is not currently blocked, not a re-ranking.
 */
export function primaryAction(actions: readonly NextAction[] | undefined): NextAction | undefined {
  return actions?.find((action) => !action.disabledReason);
}
