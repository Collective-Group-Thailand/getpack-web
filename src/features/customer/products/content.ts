/**
 * The hub's draft content (prompt hard rule 6): the FAQ answers, the included / excluded list, the
 * warranty wording, the factor texts and the process copy live in `products.json` (th, en) — copy goes
 * through i18n — and are DRAFTS until the business team reviews them. This file names them, so the
 * report, a reviewer and the tests read one list.
 *
 * BUSINESS-REVIEW: every key below.
 */
export const FAQ_KEYS = ["vat", "moq", "lead", "tolerance", "payment", "taxInvoice", "mockup", "dieline"] as const;

export const BUSINESS_REVIEW_KEYS = [
  ...FAQ_KEYS.flatMap((key) => [`faq.items.${key}.q`, `faq.items.${key}.a`]),
  "how.size.body",
  "how.material.body",
  "how.print.body",
  "how.quantity.body",
  "how.includes.vat",
  "how.includes.dieline",
  "how.includes.warranty",
  "how.excludes.shipping",
  "process.steps.choose.body",
  "process.steps.pay.body",
  "process.steps.pay.tag",
  "process.steps.produce.body",
  "process.steps.deliver.body",
  "process.paymentMethods.transfer",
  "process.paymentMethods.promptpay",
  "process.paymentMethods.card",
  "modes.instant.description",
  "modes.quote.description",
  "modes.stock.description",
  "modes.service.description",
] as const;
