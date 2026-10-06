/**
 * The moderator's round sheet for the UAT dataset (`./uat.ts`): per participant, what to sign in
 * with and which seeded records each task card starts from. `docs/ux/uat-round-data.md` §2 is this
 * table, and `uat.test.ts` fails when the two disagree.
 *
 * Only meaningful with `MOCK_DATASET=uat` loaded (the test sets it before importing).
 */

import { customers, orders } from "./admin/commerce";
import { customerByPersona } from "./store/customers";
import { mockDeepLink } from "./store/launchpad";
import { UAT_PARTICIPANTS, uatPersona, type UatParticipant } from "./uat";

export interface UatCard {
  participant: UatParticipant;
  /** T8–T10: delivered yesterday (3 % short, within tolerance), with its tax invoice / receipt. */
  delivered: { code: string; taxInvoice: string };
  /** T7: in production, and the path its notification's link opens (`/l/<token>`, D-299). */
  inProduction: { code: string; link: string };
  /** T11: the factory job waiting for acceptance. */
  job: string;
}

export function uatCards(): UatCard[] {
  return UAT_PARTICIPANTS.map((participant) => {
    const commerce = customers.find((customer) => customer.phone === participant.phone);
    if (!commerce) throw new Error(`${participant.code}: no commerce customer — is MOCK_DATASET=uat set?`);
    const own = orders.filter((order) => order.customer.id === commerce.id);
    const delivered = own.find((order) => order.shipments.some((shipment) => shipment.status === "delivered"));
    const inProduction = own.find((order) => order.jobs.some((job) => job.status === "in_progress"));
    const waiting = own.flatMap((order) => order.jobs).find((job) => job.status === "released");
    const invoice = delivered?.documents.find((document) => document.type === "tr");
    if (!delivered || !invoice || !inProduction || !waiting)
      throw new Error(`${participant.code}: a seeded order is missing`);
    const customerId = customerByPersona(uatPersona(participant)).id;
    return {
      participant,
      delivered: { code: delivered.orderCode, taxInvoice: invoice.number },
      inProduction: {
        code: inProduction.orderCode,
        link: `/l/${mockDeepLink({ path: `/account/orders/${inProduction.id}`, customerId })}`,
      },
      job: waiting.jobNo,
    };
  });
}

/** The §2 table of `docs/ux/uat-round-data.md`, one row per participant. */
export function uatSheetRows(): string[] {
  return uatCards().map(
    ({ participant: p, delivered, inProduction, job }) =>
      `| ${p.code} | ${p.segment} | ${p.name} | ${p.phone} | ${delivered.code} · ${delivered.taxInvoice} | ${inProduction.code} | \`${inProduction.link}\` | ${job} |`,
  );
}
