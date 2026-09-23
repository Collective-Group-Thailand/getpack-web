/**
 * The status vocabularies, in the one place that has to change when the contract grows them.
 *
 * `00-master-plan.md` §5 wants every status map typed against a generated contract enum, so
 * that a value the backend adds fails `pnpm typecheck` until it has a tone, an icon and a
 * label. `packio-api` has published its auth surface (B1.3) and nothing else: there is no
 * `OrderStatus` component in `contract/openapi.json` yet, so there is nothing to import.
 *
 * Rather than scatter eleven hand-written unions through eleven map files — each one a
 * response type written by hand, which CLAUDE.md forbids — they are declared here, once.
 * When the enums land, each line becomes
 *
 * ```ts
 * export type OrderStatus = Schemas["OrderStatus"];
 * ```
 *
 * and every map in this folder is re-checked against the real vocabulary by the compiler.
 * That is the whole point of the indirection: one file to edit, and the differences arrive as
 * type errors naming the exact values that moved, which is what ADR-0006 was written for.
 *
 * ## Provenance
 *
 * Nothing here is freely invented. Each union is marked with where its values come from:
 *
 * - **legacy** — `docs/legacy/00-domain-context.md` §5.2, the enumerations Locopack actually
 *   ran on, which CLAUDE.md admits as a logic reference (D-005). Numeric ids become
 *   `snake_case` names per api-conventions §3.
 * - **accounting** — `docs/accounting-design.md`.
 * - **proposed** — assembled from the vocabulary the F2/F5/F6 prompts and the decision log
 *   already use for that workflow. These are a **request to the backend**, logged as
 *   `status.enums` in `docs/contract-requests.md`, not a claim about the contract.
 */

/**
 * Customer order lifecycle. **Source: legacy** (`order_status` 1, 2, 3, 7, 4, 5, 6).
 *
 * Legacy's `deleted` (8) is deliberately absent: it was a soft-delete flag rather than
 * something a person is ever shown, and Packio starts with no rows to hide (D-005).
 *
 * Artwork is *not* a phase of this enum. Legacy tracked it on a second axis (`graphic_status`)
 * and so does Packio — see `ArtworkStatus` — because production waits on artwork approval and
 * payment independently (D-073).
 */
export type OrderStatus =
  "waiting_payment" | "waiting_payment_review" | "paid" | "in_production" | "shipping" | "completed" | "cancelled";

/**
 * **Source: legacy** (`payment_status` 1, 2, 3), **extended: proposed**.
 *
 * Legacy carried only the three happy-path values. `failed` is required by D-061 (slips are
 * verified automatically; only failures reach Finance) and `refunded` by the credit-note and
 * refund postings in `accounting-design.md` §6 (P19, P20) — a payment that has been refunded
 * cannot keep reading as `paid`.
 */
export type PaymentStatus = "pending" | "awaiting_verification" | "paid" | "failed" | "refunded";

/**
 * One instalment of an order's payment schedule. **Proposed** (D-110 instalments, D-122
 * overdue handling: reminders 7 days before and on the due date, > 7 days overdue blocks new
 * credit orders).
 */
export type InstalmentStatus = "scheduled" | "due" | "overdue" | "paid" | "waived" | "cancelled";

/**
 * The artwork workflow. **Source: legacy** (`graphic_status` 0–5).
 *
 * Legacy's ids in order: 0 designing/waiting template, 1 uploaded, 2 submitted for check,
 * 3 rejected / changes requested, 4 approved and waiting the customer's production confirm,
 * 5 customer confirmed and ready to produce.
 */
export type ArtworkStatus =
  "waiting_artwork" | "uploaded" | "in_review" | "changes_requested" | "approved" | "production_confirmed";

/**
 * A proof sent to the customer for approval. **Proposed** (D-110 proof annotations and version
 * compare; F2.4 prepress queue).
 */
export type ProofStatus = "preparing" | "sent" | "in_review" | "changes_requested" | "approved" | "expired";

/** A quote-on-request. **Proposed** (D-100 RFQ with an SLA, D-043 tier C, F2.3 RFQ workspace). */
export type RfqStatus = "submitted" | "in_review" | "quoted" | "accepted" | "declined" | "expired";

/**
 * A production job at a partner factory. **Proposed** (D-074 accept within 1 business day,
 * D-075 stage updates, D-076 QC; the queue filters F5.2 names are รอรับงาน / กำลังผลิต /
 * รอ QC / พร้อมส่ง / ล่าช้า).
 *
 * `delayed` is not here: F5.2 lists it as a filter, but being late is a property of a promised
 * date against the clock, not a state a factory moves a job into. The API decides lateness and
 * the UI renders it beside the status.
 */
export type JobStatus =
  | "pending_acceptance"
  | "accepted"
  | "rejected"
  | "in_production"
  | "awaiting_qc"
  | "ready_to_ship"
  | "shipped"
  | "completed"
  | "on_hold"
  | "cancelled";

/**
 * A delivery. **Proposed** (D-013 factory fleet with mandatory POD, D-114 the common
 * `CarrierAdapter` fallback — so the vocabulary has to fit both a factory van and a carrier).
 */
export type ShipmentStatus =
  | "pending"
  | "booked"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | "cancelled";

/**
 * A customer claim. **Proposed** (D-082 7-day window with photo evidence, D-083 liability
 * rules, F2.8 claims queue and decision).
 */
export type ClaimStatus =
  "submitted" | "in_review" | "awaiting_evidence" | "approved" | "rejected" | "resolved" | "withdrawn";

/**
 * Money owed to a factory. **Proposed** (D-022 payout schedule with retention, D-093 bank
 * files per run, F5.3 and F6 payout runs).
 */
export type PayoutStatus =
  "scheduled" | "pending_approval" | "approved" | "processing" | "paid" | "failed" | "on_hold" | "cancelled";

/**
 * An accounting document — quotation, invoice, receipt, credit note, WHT certificate.
 * **Source: accounting** (`accounting-design.md` §5: gapless series per (entity, type, period);
 * "voided documents keep their number with status `void` and a reason").
 */
export type DocumentStatus = "draft" | "issued" | "sent" | "void" | "replaced";
