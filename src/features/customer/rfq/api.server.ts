import "server-only";

import { getRfqForm, type RfqForm } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type StoreRfq = Schemas["RfqDto"];

/** The API's `null`: a 404 (not this customer's) is "not there" to a page. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** The signed-in customer's RFQs (`store.rfqs.list`) — never cached: one customer's data. */
export async function listMyRfqs(page = 1): Promise<StoreRfq[]> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/rfqs", {
    params: { query: { page, perPage: 20 } },
  });
  return data!.data;
}

export interface MyRfq {
  rfq: StoreRfq;
  /** The saved quotation an acceptance made (`acceptedQuoteId`), which goes to the cart. */
  accepted: Schemas["SavedQuoteDto"] | null;
  /**
   * The category's form, to put the answers in words. CONTRACT-GAP store.rfqs — the RFQ's `spec`
   * is the raw answers by key; their labels are the form's (`store.rfq-forms`).
   */
  form: RfqForm | null;
}

/** One of their RFQs with its thread; `null` when it is not theirs (the API's 404). */
export async function getMyRfq(rfqId: string): Promise<MyRfq | null> {
  const api = await serverApi("customer");
  const rfq = await orNull(
    api.GET("/v1/store/rfqs/{rfqId}", { params: { path: { rfqId } } }).then(({ data }) => data!),
  );
  if (!rfq) return null;
  const [accepted, form] = await Promise.all([
    rfq.acceptedQuoteId
      ? orNull(
          api
            .GET("/v1/store/quotes/{quoteId}", { params: { path: { quoteId: rfq.acceptedQuoteId } } })
            .then(({ data }) => data!),
        )
      : Promise.resolve(null),
    getRfqForm(rfq.productTypeCode).catch(() => null),
  ]);
  return { rfq, accepted, form };
}

/** The answers in words: each key by its field's label, each choice by its option's. */
export function specInWords(
  rfq: StoreRfq,
  form: RfqForm | null,
  locale: string,
  yesNo: { yes: string; no: string },
): { term: string; description: string }[] {
  return Object.entries(rfq.spec as Record<string, unknown>).map(([key, value]) => {
    const field = form?.fields.find((candidate) => candidate.key === key);
    const option = (raw: unknown) => {
      const found = field?.options.find((candidate) => candidate.value === raw);
      return found ? pick(locale, found.labelTh, found.labelEn) : String(raw);
    };
    const words =
      typeof value === "boolean"
        ? value
          ? yesNo.yes
          : yesNo.no
        : Array.isArray(value)
          ? value.map(option).join(", ")
          : `${option(value)}${field?.unit ? ` ${field.unit}` : ""}`;
    return { term: field ? pick(locale, field.labelTh, field.labelEn) : key, description: words };
  });
}
