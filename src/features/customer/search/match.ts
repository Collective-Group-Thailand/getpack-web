/**
 * Pure helpers the search page and the search dialog share.
 */

type Faq = { questionTh: string; questionEn: string | null; answerTh: string; answerEn: string | null };
type FaqGroup = { categoryCode: string | null; faqs: Faq[] };
type Hit = { kind: string; key: string; titleTh: string; titleEn: string | null };

export interface FaqMatch {
  key: string;
  question: string;
  /** The answer, when the FAQ list carries the same question; `null` otherwise. */
  answer: string | null;
  /** `/faq#<group>` — the group's anchor on the FAQ page, or the page itself. */
  href: string;
}

/**
 * The search's own FAQ hits (`kind: "faq"`, U-B0.1), in the page's language and the API's rank.
 *
 * A hit names its question only, so the answer and the group's anchor come from the FAQ list, by
 * the question's text — selecting from what the API sent, not matching on our own.
 */
export function faqHitsOf(hits: readonly Hit[], groups: readonly FaqGroup[], locale: string, limit = 5): FaqMatch[] {
  return hits
    .filter((hit) => hit.kind === "faq")
    .slice(0, limit)
    .map((hit) => {
      const group = groups.find((candidate) => candidate.faqs.some((faq) => faq.questionTh === hit.titleTh));
      const faq = group?.faqs.find((candidate) => candidate.questionTh === hit.titleTh);
      return {
        key: hit.key,
        question: locale === "en" && hit.titleEn ? hit.titleEn : hit.titleTh,
        answer: faq ? (locale === "en" && faq.answerEn ? faq.answerEn : faq.answerTh) : null,
        href: group ? `/faq#${group.categoryCode ?? "other"}` : "/faq",
      };
    });
}

/**
 * Whether a query is worth trying as an order code (`PK-2569-00042`).
 *
 * Only to avoid a lookup per keystroke: the API decides what is an order and whose it is
 * (`store.order-by-code` answers 404 for anything else). Letters, then digits and dashes, no
 * spaces.
 */
export function mightBeOrderCode(q: string): boolean {
  return /^[A-Za-z]{1,4}-?\d[\d-]{3,}$/.test(q.trim());
}

/** Normalised as order codes are printed: upper case, trimmed. */
export const orderCodeOf = (q: string) => q.trim().toUpperCase();
