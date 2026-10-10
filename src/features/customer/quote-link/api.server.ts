import "server-only";

import { getLocale } from "next-intl/server";

import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { apiInternalUrl } from "@/lib/env/lazy-server";

/**
 * A factory's quotation as its customer opens it from the link (`store.quoteLinks.get`, D-360). Never cached: the
 * customer's answer changes it. `null` for an unknown, replaced or closed link.
 */
export async function getQuoteLink(token: string): Promise<Schemas["PublicQuotationDto"] | null> {
  const [baseUrl, locale] = await Promise.all([apiInternalUrl(), getLocale()]);
  const api = createApiClient({ baseUrl, locale, requestId: null, surfaceZone: "customer" });
  try {
    return (await api.GET("/v1/store/quote-links/{token}", { params: { path: { token } } })).data ?? null;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 410)) return null;
    throw error;
  }
}
