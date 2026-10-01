import type { Schemas } from "@/lib/api/types";

export type CompanyRole = Schemas["CompanyRole"];

/**
 * What a member's roles open in the company's pages — the API's own map (`CompanyDto.can`, D-140;
 * brand assets D-227). The storefront reads it as sent; every action is still the API's to refuse.
 */
export type CompanyCapabilities = Schemas["CompanyCapabilitiesDto"];
