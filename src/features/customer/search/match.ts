/**
 * Pure helpers the search page and the search dialog share.
 */

type Faq = { questionTh: string; questionEn: string | null; answerTh: string; answerEn: string | null };
type FaqGroup = { categoryCode: string | null; faqs: Faq[] };

export interface FaqMatch {
  question: string;
  answer: string;
  /** `/faq#<group>` — the group's anchor on the FAQ page. */
  href: string;
}

/**
 * FAQs whose question contains the query, in the page's language.
 *
 * CONTRACT-REQUEST `store.search-faq-hits`: the catalogue search has no FAQ hit kind, so the
 * question text of the list the API returned is matched here — selecting from API data, not
 * computing anything — until it does.
 */
export function matchFaqs(groups: readonly FaqGroup[], q: string, locale: string, limit = 5): FaqMatch[] {
  const needle = q.trim().toLocaleLowerCase(locale);
  if (needle.length < 2) return [];
  const hits: FaqMatch[] = [];
  for (const group of groups) {
    for (const faq of group.faqs) {
      const question = locale === "en" && faq.questionEn ? faq.questionEn : faq.questionTh;
      const answer = locale === "en" && faq.answerEn ? faq.answerEn : faq.answerTh;
      if (question.toLocaleLowerCase(locale).includes(needle)) {
        hits.push({ question, answer, href: `/faq#${group.categoryCode ?? "other"}` });
      }
    }
  }
  return hits.slice(0, limit);
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
