import type { AbstractIntlMessages } from "next-intl";

/**
 * Message subtrees only server components read, so the browser never needs them (P7, the /agent Lighthouse work).
 *
 * `NextIntlClientProvider` with no `messages` prop serialises the zone's *whole* catalogue into every page's RSC
 * payload: on the storefront that is ~900 KB of JSON in the HTML of every page, parsed before the first paint. These
 * subtrees are long page copy rendered on the server only — the packaging landings' intros and FAQs, the category
 * pages' long copy, the legal pages and How it works — so they stay on the server, where `getTranslations` still
 * reads them from the request config.
 *
 * Adding a path here is safe only while no client component reads it: `client-messages.test.ts` fails when a file
 * marked "use client" names the subtree.
 */
export const SERVER_ONLY_MESSAGES = [
  "styles.packagingPages",
  "catalog.categoryContent",
  "pages.legal",
  "pages.howItWorks",
] as const;

/** The messages without the server-only subtrees (a shallow copy along each removed path; nothing is mutated). */
export function clientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  let result = messages;
  for (const path of SERVER_ONLY_MESSAGES) {
    const [namespace, key] = path.split(".") as [string, string];
    const parent = result[namespace];
    if (!parent || typeof parent !== "object" || !(key in parent)) continue;
    const rest = { ...parent };
    delete rest[key];
    result = { ...result, [namespace]: rest };
  }
  return result;
}
