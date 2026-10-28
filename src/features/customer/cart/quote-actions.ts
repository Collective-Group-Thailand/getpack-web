"use client";

import { browserApi } from "@/lib/api/browser";

/** A PDF is rendered after the request is accepted (`202`); how long the cart waits for it. */
const PDF_POLL = { every: 1_000, tries: 10 } as const;

/**
 * The cart's "ใบเสนอราคา PDF" for a cart of one quotation (checkout redesign item 6, GLOBAL-RULES §5: the quotation
 * PDF and its 15-day lock are the configurator's existing ones, `store.quotes.requestPdf`). Resolves to the
 * quotation code and the signed URL; throws `pdf.pending` when it is still being rendered.
 */
export async function quotePdf(quoteId: string): Promise<{ code: string | null; url: string }> {
  const api = browserApi();
  const { data: requested } = await api.POST("/v1/store/quotes/{quoteId}/actions/request-pdf", {
    params: { path: { quoteId } },
  });
  for (let attempt = 0; attempt < PDF_POLL.tries; attempt += 1) {
    const { data } = await api.GET("/v1/store/quotes/{quoteId}/pdf", { params: { path: { quoteId } } });
    if (data!.status === "ready" && data!.url) return { code: requested!.quoteCode, url: data!.url };
    await new Promise((resolve) => setTimeout(resolve, PDF_POLL.every));
  }
  throw new Error("pdf.pending");
}

/**
 * "ส่งให้ผู้อนุมัติ" for a cart of one quotation: the quotation's existing read-only share link
 * (`store.quotes.share`), opened in the configurator like the configurator's own share.
 */
export async function quoteShareLink(
  quoteId: string,
  productSlug: string,
): Promise<{ url: string; expiresAt: string }> {
  const { data } = await browserApi().POST("/v1/store/quotes/{quoteId}/actions/share", {
    params: { path: { quoteId } },
  });
  return {
    url: `${window.location.origin}/configure/${encodeURIComponent(productSlug)}?share=${encodeURIComponent(data!.shareToken)}`,
    expiresAt: data!.expiresAt,
  };
}
