/**
 * Customer-facing message keys that may still say "โรงงาน" / "factory" (GLOBAL-RULES §1, A1 sweep).
 * Keyed by file under `src/i18n/messages/<locale>/customer/`; a value is a list of dotted key
 * prefixes. Every entry needs a reason — add as few as possible.
 */
export const FACTORY_WORDING_ALLOWED: Record<string, { prefixes: string[]; reason: string }> = {
  "pages.json": {
    prefixes: ["partner."],
    reason:
      "/partner-with-us (getpack Factory) talks TO factories that want to join. It may describe the ERP and the partner programme, but never names, counts or describes existing partner factories (GLOBAL-RULES §1, exception).",
  },
  "business.json": {
    prefixes: ["landing.visibility.band"],
    reason:
      "The /business band that links to /partner-with-us (business pack Phase 1 item 6): it addresses packaging factories that may want to join and names the getpack Factory product — never our own production (GLOBAL-RULES §1, exception).",
  },
  "help.json": {
    prefixes: [
      "contact.intents.partnership.",
      "contact.answers.partnership.",
      "contact.links.factory",
      "contact.factoryName",
      "contact.partnerDeep",
      "contact.more.factory.",
    ],
    reason:
      "The /contact partner intent (business pack Phase 2 item 2) talks to factories that want to join: it names the getpack Factory product and says partner factories' data stays confidential — never names, counts or describes partner factories (GLOBAL-RULES §1, exception).",
  },
};
