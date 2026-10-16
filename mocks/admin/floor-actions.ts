/**
 * What a production job and a shipment offer next (`nextActions`, U-B0.3), mirroring getpack-api's
 * rule tables at v0.6.0 — `src/modules/production/job-actions.ts`, `src/modules/logistics/
 * shipment-actions.ts` and the evaluator in `src/common/next-actions/next-actions.ts`: a rule is
 * offered when the reader holds all its permissions and its state check passes; a string verdict
 * offers it disabled with that reason (a message key).
 *
 * The partner mocks (`../partner/jobs.ts`, `../partner/shipments.ts`) and the back office's
 * (`./production.ts`, `./logistics.ts`) compute their lists here, from the same facts their
 * action handlers check.
 */

import type { Schemas } from "@/lib/api/types";

type NextAction = Schemas["NextActionDto"];

interface ActionRule<T> {
  key: string;
  permissions?: readonly string[];
  irreversible?: boolean;
  when: (entity: T) => boolean | string;
}

/** The actions an actor holding `permissions` may take on `entity`, in rule order. */
function evaluate<T>(entity: T, rules: readonly ActionRule<T>[], permissions: ReadonlySet<string>): NextAction[] {
  const out: NextAction[] = [];
  for (const rule of rules) {
    if (!(rule.permissions ?? []).every((permission) => permissions.has(permission))) continue;
    const verdict = rule.when(entity);
    if (verdict === false) continue;
    out.push({
      key: rule.key,
      irreversible: rule.irreversible ?? false,
      disabledReason: typeof verdict === "string" ? verdict : null,
    });
  }
  return out;
}

/* --------------------------------------------------------------------------- production jobs */

export interface JobFacts {
  status: string;
  jobKind: string;
}

const WORKING = ["accepted", "in_progress"];

const PARTNER_JOB_ACTIONS: ActionRule<JobFacts>[] = [
  { key: "job.accept", permissions: ["factory_jobs.respond"], when: (j) => j.status === "released" },
  {
    key: "job.reject",
    permissions: ["factory_jobs.respond"],
    irreversible: true,
    when: (j) => j.status === "released",
  },
  { key: "job.update_milestone", permissions: ["factory_milestones.update"], when: (j) => WORKING.includes(j.status) },
  { key: "job.record_qc", permissions: ["factory_qc.record"], when: (j) => WORKING.includes(j.status) },
  { key: "job.raise_issue", permissions: ["factory_issues.raise"], when: () => true },
  {
    key: "job.ship",
    permissions: ["factory_shipments.manage"],
    when: (j) => j.status === "completed" && j.jobKind !== "mockup",
  },
];

const ADMIN_JOB_ACTIONS: ActionRule<JobFacts>[] = [
  {
    key: "job.reassign",
    permissions: ["production.manage"],
    when: (j) => j.status === "released" || j.status === "rejected",
  },
  { key: "job.hold", permissions: ["production.manage"], when: (j) => WORKING.includes(j.status) },
  { key: "job.resume", permissions: ["production.manage"], when: (j) => j.status === "on_hold" },
];

export const partnerJobActions = (facts: JobFacts, permissions: ReadonlySet<string>) =>
  evaluate(facts, PARTNER_JOB_ACTIONS, permissions);
export const adminJobActions = (facts: JobFacts, permissions: ReadonlySet<string>) =>
  evaluate(facts, ADMIN_JOB_ACTIONS, permissions);

/* --------------------------------------------------------------------------------- shipments */

export interface ShipmentFacts {
  status: string;
  carrier: string;
  carrierRequested: boolean;
  /** The shipping gate's payment part: an instalment due before shipping is unpaid. */
  blockedByPayment: boolean;
  podReview: "pending" | "accepted" | "rejected" | null;
  exceptionResolved: boolean;
}

const MOVING = ["picked_up", "in_transit", "out_for_delivery", "failed"];
const fleet = (s: ShipmentFacts) => s.carrier === "factory_fleet";
const paid = (s: ShipmentFacts) => !s.blockedByPayment || "shipments.payment_pending";
const MANAGE = ["factory_shipments.manage"];
const STAFF = ["shipments.manage"];

const PARTNER_SHIPMENT_ACTIONS: ActionRule<ShipmentFacts>[] = [
  { key: "shipment.mark_ready", permissions: MANAGE, when: (s) => s.status === "draft" },
  { key: "shipment.dispatch", permissions: MANAGE, when: (s) => s.status === "ready" && fleet(s) && paid(s) },
  {
    key: "shipment.request_carrier",
    permissions: MANAGE,
    when: (s) => s.status === "ready" && fleet(s) && !s.carrierRequested,
  },
  { key: "shipment.update_status", permissions: MANAGE, when: (s) => fleet(s) && MOVING.includes(s.status) },
  {
    key: "shipment.record_pod",
    permissions: MANAGE,
    irreversible: true,
    when: (s) => fleet(s) && (MOVING.includes(s.status) || (s.status === "ready" && paid(s))),
  },
  {
    key: "shipment.cancel",
    permissions: MANAGE,
    irreversible: true,
    when: (s) => s.status === "draft" || s.status === "ready",
  },
];

const ADMIN_SHIPMENT_ACTIONS: ActionRule<ShipmentFacts>[] = [
  { key: "shipment.book_carrier", permissions: STAFF, when: (s) => s.status === "ready" && fleet(s) && paid(s) },
  { key: "shipment.split", permissions: STAFF, when: (s) => s.status === "draft" },
  {
    key: "shipment.resolve_exception",
    permissions: STAFF,
    when: (s) => s.status === "failed" || (s.status === "returned" && !s.exceptionResolved),
  },
  { key: "shipment.review_pod", permissions: STAFF, when: (s) => s.podReview === "pending" },
  { key: "shipment.update_status", permissions: STAFF, when: (s) => MOVING.includes(s.status) },
  {
    key: "shipment.record_pod",
    permissions: STAFF,
    irreversible: true,
    when: (s) => MOVING.includes(s.status) || (s.status === "ready" && paid(s)),
  },
  {
    key: "shipment.cancel",
    permissions: STAFF,
    irreversible: true,
    when: (s) => s.status === "draft" || s.status === "ready",
  },
];

export const partnerShipmentActions = (facts: ShipmentFacts, permissions: ReadonlySet<string>) =>
  evaluate(facts, PARTNER_SHIPMENT_ACTIONS, permissions);
export const adminShipmentActions = (facts: ShipmentFacts, permissions: ReadonlySet<string>) =>
  evaluate(facts, ADMIN_SHIPMENT_ACTIONS, permissions);
