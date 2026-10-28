/**
 * The style library page's staff-managed content (`store.styleLibrary.getSettings`, D-448). The
 * mock's quick search terms are its own examples; the trust block is empty, as it is until
 * Marketing enters real certificates, photos and permitted logos — so the page shows only the
 * tax-invoice tile (D-010).
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { styleLibraryContent } from "../admin/style-library-content";

export const styleLibraryHandlers: HttpHandler[] = [
  http.get("*/v1/store/style-library/settings", () => {
    const content = styleLibraryContent();
    return HttpResponse.json({
      quickSearch: content.quickSearch,
      compareLimit: 3,
      materialSwatches: content.materialSwatches,
      trust: {
        certifications: content.trust.certifications.map(({ title, number, issuer, expiresOn, documentUrl }) => ({
          title,
          number,
          issuer,
          expiresOn,
          documentUrl,
        })),
        foodGrade: content.trust.foodGrade,
        productionPhotos: content.trust.productionPhotos,
        customerLogos: content.trust.customerLogos.map(({ name, logoUrl }) => ({ name, logoUrl })),
        taxInvoiceNote: content.trust.taxInvoiceNote,
      },
    } satisfies Schemas["StoreStyleLibrarySettingsDto"]);
  }),
];
