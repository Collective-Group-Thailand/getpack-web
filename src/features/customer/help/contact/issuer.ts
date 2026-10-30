import type { Schemas } from "@/lib/api/types";

type Issuer = Schemas["IssuerDto"];

/**
 * Whether the entity settings the API sends (`PublicConfigDto.issuer`, D-458) are still the seed's stand-ins rather
 * than the company's real registration: an all-zero tax id, or a name or address the seed marks as fake
 * ("(ข้อมูลปลอม)", "(fake data)" — `prisma/seed/dev-seed.ts`, `prisma/seed/uat/uat-seed.ts` in getpack-api). The
 * storefront then shows no company block at all rather than placeholder legal data; staff fill the real values in
 * the entity settings.
 */
export function isPlaceholderIssuer(issuer: Issuer | null | undefined): boolean {
  if (!issuer) return false;
  if (issuer.taxId && /^0+$/.test(issuer.taxId)) return true;
  const fake = /ข้อมูลปลอม|\(fake/i;
  return [issuer.legalNameTh, issuer.legalNameEn, issuer.addressTh].some((value) => !!value && fake.test(value));
}

/** The issuer, or null while it is still a placeholder. */
export function realIssuer(issuer: Issuer | null | undefined): Issuer | null {
  return issuer && !isPlaceholderIssuer(issuer) ? issuer : null;
}
