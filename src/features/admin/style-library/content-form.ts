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

/**
 * C1e (DECISIONS-STAGE-A §13.3, D-450): pictures are uploaded files (purpose `image`) served by the public catalogue
 * image route; documents are uploaded files served by `store.styleLibrary.getDocument`, or an external https link
 * (documents only). The setting's `IMAGE_URL_PATTERN` / `DOCUMENT_URL_PATTERN` are the authority.
 */
export const IMAGE_PREFIX = "/v1/store/catalog/images/";
export const DOCUMENT_PREFIX = "/v1/store/style-library/documents/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HTTPS = /^https:\/\/\S+$/;

export const imagePath = (fileId: string) => `${IMAGE_PREFIX}${fileId}`;
export const documentPath = (fileId: string) => `${DOCUMENT_PREFIX}${fileId}`;

/** The uploaded file a content path points at, or null (empty, an external link, anything else). */
export function fileIdOf(url: string | null | undefined, prefix: string): string | null {
  if (!url || !url.startsWith(prefix)) return null;
  const id = url.slice(prefix.length);
  return UUID.test(id) ? id : null;
}

/** How a document field is filled: an uploaded file, an external https link, or nothing yet. */
export type DocumentSource = "file" | "link";
export const documentSourceOf = (url: string | null | undefined): DocumentSource =>
  url && !fileIdOf(url, DOCUMENT_PREFIX) && !blank(url) ? "link" : "file";

const isImage = (v: string) => fileIdOf(v, IMAGE_PREFIX) !== null;
const isDocument = (v: string) => fileIdOf(v, DOCUMENT_PREFIX) !== null || HTTPS.test(v);
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

export type ContentError = { path: string; code: "required" | "url" | "upload" | "date" | "tooMany" };

const blank = (v: string | null | undefined) => !v || !v.trim();
const optional = (v: string | null | undefined) => (blank(v) ? null : v!.trim());

/** What blocks a save, by path (`trust.certifications.0.documentUrl`). */
export function contentErrors(c: LibraryContent): ContentError[] {
  const errors: ContentError[] = [];
  // C1e: a picture must be an uploaded file; a document an uploaded file or an https link.
  const image = (path: string, v: string | null | undefined) => {
    if (blank(v)) errors.push({ path, code: "required" });
    else if (!isImage(v!.trim())) errors.push({ path, code: "upload" });
  };
  const document = (path: string, v: string | null | undefined) => {
    if (!blank(v) && !isDocument(v!.trim())) errors.push({ path, code: "url" });
  };
  const t = c.trust;
  for (const [key, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][])
    if (t[key].length > max) errors.push({ path: `trust.${key}`, code: "tooMany" });
  t.certifications.forEach((x, i) => {
    if (blank(x.title.th)) errors.push({ path: `trust.certifications.${i}.title`, code: "required" });
    if (!blank(x.expiresOn) && !DATE.test(x.expiresOn!.trim()))
      errors.push({ path: `trust.certifications.${i}.expiresOn`, code: "date" });
    document(`trust.certifications.${i}.documentUrl`, x.documentUrl);
  });
  t.foodGrade.forEach((x, i) => {
    if (blank(x.title.th)) errors.push({ path: `trust.foodGrade.${i}.title`, code: "required" });
    document(`trust.foodGrade.${i}.documentUrl`, x.documentUrl);
  });
  t.productionPhotos.forEach((x, i) => {
    image(`trust.productionPhotos.${i}.url`, x.url);
    if (blank(x.alt.th)) errors.push({ path: `trust.productionPhotos.${i}.alt`, code: "required" });
  });
  t.customerLogos.forEach((x, i) => {
    if (blank(x.name)) errors.push({ path: `trust.customerLogos.${i}.name`, code: "required" });
    image(`trust.customerLogos.${i}.logoUrl`, x.logoUrl);
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
