/**
 * Loyalty P2 in-app surveys (D-482, D-491): the web's own rules over an instance the API sends — which questions are
 * answered, which required ones are still missing, and the answers as `store.surveys.submit` takes them. The API
 * validates again (unknown key, missing answer, out of range → 422); the reward is the API's figure, never computed.
 */

import type { SurveyAnswers, SurveyInstance, SurveyQuestion } from "@/lib/api/requests/store-loyalty-p2";

export type AnswerValue = number | string | string[];
export type Answers = Partial<Record<string, AnswerValue>>;

/** Whether a question has an answer the API would accept as given. */
export function isAnswered(question: SurveyQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  switch (question.kind) {
    case "rating":
      return typeof value === "number" && value >= (question.min ?? 1) && value <= (question.max ?? 5);
    case "single":
      return typeof value === "string" && (question.options ?? []).some((option) => option.key === value);
    case "multi":
      return Array.isArray(value) && value.length > 0;
    case "text":
      return typeof value === "string" && value.trim() !== "";
  }
}

/** The required questions without an answer, in the survey's order. */
export function missingRequired(questions: readonly SurveyQuestion[], answers: Answers): string[] {
  return questions
    .filter((question) => question.required && !isAnswered(question, answers[question.key]))
    .map((q) => q.key);
}

/** The answers as the submit body: answered questions only, text trimmed and cut to its limit. */
export function toSubmission(questions: readonly SurveyQuestion[], answers: Answers): SurveyAnswers {
  const out: SurveyAnswers = {};
  for (const question of questions) {
    const value = answers[question.key];
    if (!isAnswered(question, value)) continue;
    out[question.key] =
      question.kind === "text"
        ? String(value)
            .trim()
            .slice(0, question.maxLength ?? 500)
        : (value as AnswerValue);
  }
  return out;
}

/** An instance the customer can still answer. */
export const isOpen = (survey: Pick<SurveyInstance, "status">) => survey.status === "open" || survey.status === "seen";

/** The 1…max values of a rating question. */
export function ratingScale(question: SurveyQuestion): number[] {
  const min = question.min ?? 1;
  const max = question.max ?? 5;
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, at) => min + at);
}
