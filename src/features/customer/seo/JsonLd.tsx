import { getNonce } from "@/lib/security/nonce";
import { jsonLdText } from "@/lib/seo";

/**
 * One block of structured data, nonced like `OrganizationJsonLd` (the CSP refuses an unnonced
 * script of any type), with `<` escaped because page data comes from the API.
 */
export async function JsonLd({ data }: { data: unknown }) {
  const nonce = await getNonce();
  if (!nonce) return null;
  // Escaped by `jsonLdText`; nothing here is executed.
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
