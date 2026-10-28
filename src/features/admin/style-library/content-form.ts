/**
 * The style library page content staff keep (`admin.styleLibrary.*`, DECISIONS-STAGE-A §11.5,
 * D-448): the trust section's rows as the editor holds them, and the checks that stop a save the
 * API would refuse (the setting's schema is the authority). Only real content: certificates,
 * documents, photos and permitted logos the business holds — nothing here invents any. Pure.
 */

import type { Schemas } from "@/lib/api/types";

export type LibraryContent = Schemas["StyleLibraryContentDto"];
export type Trust = Schemas["TrustContentDto"];
export type Certification = Trust["certifications"][number];
export type FoodGradeDoc = Trust["foodGrade"][number];
export type ProductionPhoto = Trust["productionPhotos"][number];
export type CustomerLogo = Trust["customerLogos"][number];

/** An https link or a path on getpack's own site (the setting's `CONTENT_URL_PATTERN`). */
export const CONTENT_URL = /^(https:\/\/\S+|\/\S*)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITS = { certifications: 20, foodGrade: 20, productionPhotos: 24, customerLogos: 40 } as const;

export const newCertification = (): Certification => ({
  title: { th: "", en: null },
  number: null,
  issuer: null,
  expiresOn: null,
  documentUrl: null,
});
export const newFoodGradeDoc = (): FoodGradeDoc => ({ title: { th: "", en: null }, documentUrl: null });
export const newPhoto = (): ProductionPhoto => ({ url: "", alt: { th: "", en: null } });
export const newLogo = (): CustomerLogo => ({ name: "", logoUrl: "", permission: "" });

export type ContentError = { path: string; code: "required" | "url" | "date" | "tooMany" };

const blank = (v: string | null | undefined) => !v || !v.trim();
const optional = (v: string | null | undefined) => (blank(v) ? null : v!.trim());

/** What blocks a save, by path (`trust.certifications.0.documentUrl`). */
export function contentErrors(c: LibraryContent): ContentError[] {
  const errors: ContentError[] = [];
  const url = (path: string, v: string | null | undefined, required: boolean) => {
    if (blank(v)) {
      if (required) errors.push({ path, code: "required" });
    } else if (!CONTENT_URL.test(v!.trim())) errors.push({ path, code: "url" });
  };
  const t = c.trust;
  for (const [key, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][])
    if (t[key].length > max) errors.push({ path: `trust.${key}`, code: "tooMany" });
  t.certifications.forEach((x, i) => {
    if (blank(x.title.th)) errors.push({ path: `trust.certifications.${i}.title`, code: "required" });
    if (!blank(x.expiresOn) && !DATE.test(x.expiresOn!.trim()))
      errors.push({ path: `trust.certifications.${i}.expiresOn`, code: "date" });
    url(`trust.certifications.${i}.documentUrl`, x.documentUrl, false);
  });
  t.foodGrade.forEach((x, i) => {
    if (blank(x.title.th)) errors.push({ path: `trust.foodGrade.${i}.title`, code: "required" });
    url(`trust.foodGrade.${i}.documentUrl`, x.documentUrl, false);
  });
  t.productionPhotos.forEach((x, i) => {
    url(`trust.productionPhotos.${i}.url`, x.url, true);
    if (blank(x.alt.th)) errors.push({ path: `trust.productionPhotos.${i}.alt`, code: "required" });
  });
  t.customerLogos.forEach((x, i) => {
    if (blank(x.name)) errors.push({ path: `trust.customerLogos.${i}.name`, code: "required" });
    url(`trust.customerLogos.${i}.logoUrl`, x.logoUrl, true);
    if (blank(x.permission)) errors.push({ path: `trust.customerLogos.${i}.permission`, code: "required" });
  });
  if (c.trust.taxInvoiceNote && blank(c.trust.taxInvoiceNote.th) && !blank(c.trust.taxInvoiceNote.en))
    errors.push({ path: "trust.taxInvoiceNote", code: "required" });
  return errors;
}

const localised = (v: { th: string; en: string | null }) => ({ th: v.th.trim(), en: optional(v.en) });

/** Trimmed, empty optional text as null, an empty tax note as none — the body the PUT sends. */
export function cleanContent(c: LibraryContent): LibraryContent {
  const note = c.trust.taxInvoiceNote;
  return {
    quickSearch: c.quickSearch,
    materialSwatches: c.materialSwatches,
    trust: {
      certifications: c.trust.certifications.map((x) => ({
        title: localised(x.title),
        number: optional(x.number),
        issuer: optional(x.issuer),
        expiresOn: optional(x.expiresOn),
        documentUrl: optional(x.documentUrl),
      })),
      foodGrade: c.trust.foodGrade.map((x) => ({ title: localised(x.title), documentUrl: optional(x.documentUrl) })),
      productionPhotos: c.trust.productionPhotos.map((x) => ({ url: x.url.trim(), alt: localised(x.alt) })),
      customerLogos: c.trust.customerLogos.map((x) => ({
        name: x.name.trim(),
        logoUrl: x.logoUrl.trim(),
        permission: x.permission.trim(),
      })),
      taxInvoiceNote: note && !blank(note.th) ? localised(note) : null,
    },
  };
}

/** True when a certificate's last valid day is before `today` (YYYY-MM-DD, Asia/Bangkok from the caller). */
export const isExpired = (c: Pick<Certification, "expiresOn">, today: string) =>
  !!c.expiresOn && DATE.test(c.expiresOn) && c.expiresOn < today;
