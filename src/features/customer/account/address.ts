import { pick } from "@/features/customer/catalog/localize";
import type { Schemas } from "@/lib/api/types";

export type Address = Schemas["AddressDto"];
export type TaxProfile = Schemas["TaxProfileDto"];

/** A province or sub-district by the name the reader's language has (`GeoRefDto`). */
export function geoName(locale: string, area: Schemas["GeoRefDto"] | null): string | null {
  return area ? pick(locale, area.nameTh, area.nameEn) : null;
}

/**
 * An address or a tax profile's address on one line, as the API holds it (`AddressDto`,
 * `TaxProfileDto`). There is no district: the published address does not carry one.
 */
export function addressLine(
  locale: string,
  address: Pick<Address, "line1" | "line2" | "subdistrict" | "province" | "postcode">,
): string {
  return [
    address.line1,
    address.line2,
    geoName(locale, address.subdistrict),
    geoName(locale, address.province),
    address.postcode,
  ]
    .filter(Boolean)
    .join(" ");
}
