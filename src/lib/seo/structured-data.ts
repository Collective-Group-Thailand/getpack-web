import { BRAND_COMPANY, BRAND_NAME, BRAND_TAGLINE } from "@/ui/brand";

/**
 * Organization structured data (schema.org), for the storefront only.
 *
 * Deliberately thin. Structured data is a claim made to a search engine, and a claim that is
 * not backed by something real is worse than none — so there are no ratings, no review counts
 * and no contact numbers here. Those arrive in F3 from the API, when the data behind them
 * exists (design-system.md §5: "trust elements only from real data — never fabricated").
 */
export interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": "Organization";
  name: string;
  legalName: string;
  description: string;
  url: string;
  logo: string;
}

export function organizationSchema(origin: string): OrganizationSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    // Packio is the brand; Collective Group (Thailand) is the legal entity that issues every
    // document (D-010, D-092), and a search engine should know which is which.
    legalName: BRAND_COMPANY,
    description: BRAND_TAGLINE,
    url: origin,
    logo: `${origin}/icon.svg`,
  };
}
