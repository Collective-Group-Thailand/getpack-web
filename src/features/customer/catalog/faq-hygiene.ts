import type { Schemas } from "@/lib/api/types";

type FaqGroup = Schemas["StoreFaqGroupDto"];

/** A development fixture's marker (`prisma/seed/dev-seed.ts` in getpack-api). */
const DEV_MARK = /^\s*\[DEV\]/;
/** An internal decision reference — "(D-051)", "(D-051, D-176)" — never customer copy. */
const DECISION_REF = /\s*\((?:D-\d{3}[\s,/–-]*)+\)/g;

const clean = (value: string | null): string | null => (value === null ? null : value.replace(DECISION_REF, "").trim());

/**
 * FAQs fit for a customer: development fixtures dropped, internal decision references stripped.
 * The seeds are fixed at the source too; this guards against content entered the same way again.
 */
export function publishableFaqs(groups: FaqGroup[]): FaqGroup[] {
  return groups
    .filter((group) => !DEV_MARK.test(group.categoryNameTh ?? ""))
    .map((group) => ({
      ...group,
      faqs: group.faqs
        .filter((faq) => !DEV_MARK.test(faq.questionTh) && !DEV_MARK.test(faq.answerTh))
        .map((faq) => ({
          ...faq,
          questionTh: clean(faq.questionTh)!,
          answerTh: clean(faq.answerTh)!,
          questionEn: clean(faq.questionEn),
          answerEn: clean(faq.answerEn),
        })),
    }))
    .filter((group) => group.faqs.length > 0);
}
