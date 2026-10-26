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
};
