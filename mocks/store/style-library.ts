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
  // C1e (§13.3): a trust-section document is served only while the content shows it; the mock holds no real files,
  // so a referenced one answers with an empty placeholder PDF and anything else is 404.
  http.get("*/v1/store/style-library/documents/:fileId", ({ params }) => {
    const path = `/v1/store/style-library/documents/${String(params.fileId)}`;
    const { certifications, foodGrade } = styleLibraryContent().trust;
    const shown = [...certifications, ...foodGrade].some((d) => d.documentUrl === path);
    return shown
      ? new HttpResponse("%PDF-1.4\n%%EOF\n", { headers: { "Content-Type": "application/pdf" } })
      : HttpResponse.json({ code: "http.not_found", status: 404, title: "Not found" }, { status: 404 });
  }),
];
