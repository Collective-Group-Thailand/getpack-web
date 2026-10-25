/**
 * The style library page's staff-managed content (`store.style-library.settings`). The mock's
 * quick search terms are its own examples; the trust block is empty, as it is until Marketing
 * enters real certificates, photos and permitted logos — so the page shows no trust section.
 */

import { mockRequest } from "../route";

export const styleLibraryHandlers = [
  // CONTRACT-REQUEST store.style-library.settings
  mockRequest("GET /v1/store/style-library/settings", () => ({
    quickSearch: [
      { label: { th: "เมลเลอร์", en: "Mailer" }, query: "เมลเลอร์" },
      { label: { th: "แม่เหล็ก", en: "Magnetic" }, query: "แม่เหล็ก" },
      { label: { th: "กล่องเค้ก", en: "Cake box" }, query: "กล่องเค้ก" },
      { label: { th: "กล่องผลไม้", en: "Fruit box" }, query: "กล่องผลไม้" },
    ],
    compareLimit: 3,
    materialSwatches: [],
    trust: { certifications: [], foodGrade: [], productionPhotos: [], customerLogos: [], taxInvoiceNote: null },
  })),
];
