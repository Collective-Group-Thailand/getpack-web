/**
 * What the style library page shows that staff — not code — decide (the `/styles` redesign,
 * `docs/design/styles-redesign/PLAN.md`): the quick search terms under the search box, how many
 * styles compare at once (D-246), the material swatches beside the filter, and the trust block (certificates, food-grade papers, production
 * photos, customer logos, the tax-invoice note). Marketing edits them in the back office; the page
 * renders whatever is there and **hides any part that is empty** — never a placeholder.
 *
 * One public read, cached like the catalogue's content.
 */

import { z } from "zod";

import { request } from "./define";

const localised = () => z.object({ th: z.string().min(1), en: z.string().nullable() });

export const styleLibrarySettings = z
  .object({
    /** "ค้นหาบ่อย": shown in this order; empty hides the row. */
    quickSearch: z.array(z.object({ label: localised(), query: z.string().min(1).max(120) })).max(12),
    /** Styles compared side by side (D-246: 3). The compare page and tray take this, not a constant. */
    compareLimit: z.number().int().min(2).max(6),
    /** What each material class looks like beside its filter: a board colour or a photo. A class without one shows no swatch. */
    materialSwatches: z.array(
      z.object({
        materialClass: z.string(),
        colour: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .nullable(),
        imageUrl: z.string().nullable(),
      }),
    ),
    trust: z.object({
      certifications: z.array(
        z.object({
          title: localised(),
          /** The certificate's own number ("FSC-C000000"); null when it has none. */
          number: z.string().nullable(),
          issuer: z.string().nullable(),
          documentUrl: z.string().nullable(),
        }),
      ),
      foodGrade: z.array(z.object({ title: localised(), documentUrl: z.string().nullable() })),
      productionPhotos: z.array(z.object({ url: z.string(), alt: localised() })),
      /** Only logos the customer agreed to show. */
      customerLogos: z.array(z.object({ name: z.string(), logoUrl: z.string() })),
      /** "ใบกำกับภาษีเต็มรูปแบบ…"; null hides the note. */
      taxInvoiceNote: localised().nullable(),
    }),
  })
  .meta({ id: "StoreStyleLibrarySettingsDto" });

export const storeStyleLibraryRequests = {
  "GET /v1/store/style-library/settings": request({
    request: "store.style-library.settings",
    summary: "The library page's staff-managed content: quick search terms, compare limit, trust block",
    decisions: ["D-246"],
    response: styleLibrarySettings,
    public: true,
  }),
} as const;
