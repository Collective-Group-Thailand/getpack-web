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

/* ------------------------------------------------------------------------------------ *
 * Page-level structured data (F3 3.1): Product, BreadcrumbList, FAQPage.
 *
 * The same rule as the Organization: nothing is claimed that the API did not say. A product
 * carries an offer only when the API returned a "starting from" price for it, and never a
 * rating or a review count.
 * ------------------------------------------------------------------------------------ */

export interface Crumb {
  name: string;
  /** Absolute URL; the last crumb (the page itself) may omit it. */
  url?: string;
}

export function breadcrumbSchema(crumbs: readonly Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.url ? { item: crumb.url } : {}),
    })),
  } as const;
}

export interface ProductSchemaInput {
  name: string;
  description?: string | null;
  url: string;
  images: readonly string[];
  sku?: string;
  category?: string;
  /** The API's "starting from" price per piece, as the decimal string it returned. */
  lowPrice?: string | null;
  currency?: string;
}

export function productSchema(input: ProductSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    ...(input.images.length > 0 ? { image: input.images } : {}),
    ...(input.sku ? { sku: input.sku } : {}),
    ...(input.category ? { category: input.category } : {}),
    brand: { "@type": "Brand", name: BRAND_NAME },
    ...(input.lowPrice
      ? {
          offers: {
            "@type": "AggregateOffer",
            lowPrice: input.lowPrice,
            priceCurrency: input.currency ?? "THB",
            seller: { "@type": "Organization", name: BRAND_NAME, legalName: BRAND_COMPANY },
          },
        }
      : {}),
  } as const;
}

export function faqPageSchema(entries: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  } as const;
}

/**
 * JSON for inside a `<script>`. `JSON.stringify` leaves `<` alone, so a product name holding
 * `</script>` would end the block and whatever follows would be parsed as HTML. Page-level
 * data comes from the API — content an admin typed — so every `<` is escaped.
 */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/* ------------------------------------------------------------------------------------ *
 * Site-wide and page-type data (SEO/AEO pass, 2026-10-14). The same rule: every value is
 * copy from `src/i18n` or data the API returned — nothing invented, no ratings.
 * ------------------------------------------------------------------------------------ */

/** The site as an entity, with its search box — what a search engine shows as a sitelinks search. */
export function webSiteSchema(origin: string, locale: string, searchPath = "/search") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: BRAND_NAME,
    url: origin,
    inLanguage: locale,
    publisher: { "@type": "Organization", name: BRAND_NAME, legalName: BRAND_COMPANY },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}${searchPath}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  } as const;
}

export interface WebPageInput {
  type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage" | "FAQPage" | "ItemPage";
  name: string;
  description?: string | null;
  url: string;
  locale: string;
  /** The answer-first paragraph, flagged for voice and AI answers (`speakable`). */
  speakableSelector?: readonly string[];
  dateModified?: string;
}

/** A page as an entity: its type, name, language and — for AEO — which part answers the question. */
export function webPageSchema(input: WebPageInput) {
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    inLanguage: input.locale,
    isPartOf: { "@type": "WebSite", name: BRAND_NAME },
    ...(input.speakableSelector
      ? { speakable: { "@type": "SpeakableSpecification", cssSelector: [...input.speakableSelector] } }
      : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
  } as const;
}

export interface HowToStepInput {
  name: string;
  text: string;
  url?: string;
}

/** The ordering process as a HowTo — the markup an answer engine reads for "how do I order". */
export function howToSchema(input: { name: string; description: string; steps: readonly HowToStepInput[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    step: input.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url ? { url: step.url } : {}),
    })),
  } as const;
}

export interface ListItemInput {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
}

/** A list of pages (categories, styles, articles) in the order shown. */
export function itemListSchema(items: readonly ListItemInput[], name?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(name ? { name } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
      ...(item.description ? { description: item.description } : {}),
      ...(item.image ? { image: item.image } : {}),
    })),
  } as const;
}

/** A glossary: every term with its definition, as a `DefinedTermSet`. */
export function definedTermSetSchema(input: { name: string; url: string; terms: readonly { term: string; definition: string }[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: input.name,
    url: input.url,
    hasDefinedTerm: input.terms.map((entry) => ({
      "@type": "DefinedTerm",
      name: entry.term,
      description: entry.definition,
      inDefinedTermSet: input.url,
    })),
  } as const;
}

/** What Packio offers as a service (the business page): named, by the brand, in Thailand. */
export function serviceSchema(input: { name: string; description: string; url: string; serviceType: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: input.url,
    serviceType: input.serviceType,
    areaServed: { "@type": "Country", name: "Thailand" },
    provider: { "@type": "Organization", name: BRAND_NAME, legalName: BRAND_COMPANY },
  } as const;
}
