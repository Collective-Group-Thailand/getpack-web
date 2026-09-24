import { getNonce } from "@/lib/security/nonce";
import { organizationSchema } from "@/lib/seo";

/**
 * Organization structured data, emitted once on the storefront.
 *
 * The `<script>` carries the request nonce. A JSON-LD block is not executed, but `script-src`
 * does not distinguish: with `'strict-dynamic'` and a nonce in the policy, an unnonced script
 * of any type is refused and the block simply never reaches the crawler. `getNonce()` returns
 * `undefined` when the request did not come through the proxy, and then the block is skipped
 * rather than emitted unnonced — a missing rich result is better than a CSP violation on every
 * page.
 */
export async function OrganizationJsonLd({ origin }: { origin: string }) {
  const nonce = await getNonce();
  if (!nonce) return null;

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // The value is built from brand constants in this repo, never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema(origin)) }}
    />
  );
}
