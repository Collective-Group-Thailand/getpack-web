/**
 * The shape the fake RFQs are kept in — a fixture model, not an API type.
 *
 * A row is the page aggregate the RFQ desk once asked for (`rfqDetail` in
 * `src/lib/api/requests/admin-rfq.ts`, still what the `implement` requests answer). The published
 * desk reads `StaffRfqDto`, and the customer `RfqDto`: `./rfq.ts` and `../store/rfq.ts` turn a row
 * into those on the way out. The thread is kept beside the rows, one list per RFQ, shared by both.
 */

import type { z } from "zod";

import type { consultation, rfqDetail, rfqQuote, rfqQuoteLine } from "@/lib/api/requests/admin-rfq";
import type { Schemas } from "@/lib/api/types";

export type RfqRow = z.output<typeof rfqDetail>;
export type ConsultationRow = z.output<typeof consultation>;
export type QuoteRow = z.output<typeof rfqQuote>;
export type QuoteLineRow = z.output<typeof rfqQuoteLine>;

/** One message of an RFQ's thread. A customer's message may have no named author. */
export interface RfqMessageRow {
  id: string;
  authorKind: "customer" | "staff";
  author: { id: string; displayName: string } | null;
  visibility: Schemas["MessageVisibility"];
  body: string;
  createdAt: string;
}
