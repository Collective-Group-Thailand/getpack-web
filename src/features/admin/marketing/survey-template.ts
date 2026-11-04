import type { SurveyTemplate, SurveyTemplateInput } from "@/features/shared/loyalty-p2/types";
import { isApiError } from "@/lib/api/problem";

/**
 * The survey template editor's draft and its rules (loyalty P2, D-491): 3–5 questions, each a rating 1–5, a single or
 * multiple choice (2–6 options) or short text; every label in Thai and English. The API enforces the same rules
 * (`surveys.questions_count`, 422 field errors); checking here only spares a round trip.
 */

export const QUESTION_KINDS = ["rating", "single", "multi", "text"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export const QUESTIONS_MIN = 3;
export const QUESTIONS_MAX = 5;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 6;
/** The store's answer limit for a text question (`SurveyAnswersDto`: 500 characters). */
export const TEXT_MAX = 500;

export interface DraftOption {
  key: string;
  th: string;
  en: string;
}
export interface DraftQuestion {
  key: string;
  kind: QuestionKind;
  th: string;
  en: string;
  required: boolean;
  options: DraftOption[];
  maxLength: number;
}
export interface TemplateDraft {
  code: string;
  trigger: SurveyTemplateInput["trigger"];
  rewardEnabled: boolean;
  titleTh: string;
  titleEn: string;
  questions: DraftQuestion[];
}

/** The first unused `<prefix><n>` — question and option keys are stable once saved. */
export function nextKey(prefix: string, taken: readonly string[]): string {
  for (let n = 1; ; n += 1) if (!taken.includes(`${prefix}${n}`)) return `${prefix}${n}`;
}

export function blankQuestion(kind: QuestionKind, taken: readonly string[]): DraftQuestion {
  return {
    key: nextKey("q", taken),
    kind,
    th: "",
    en: "",
    required: kind === "rating",
    options:
      kind === "single" || kind === "multi"
        ? [
            { key: "o1", th: "", en: "" },
            { key: "o2", th: "", en: "" },
          ]
        : [],
    maxLength: TEXT_MAX,
  };
}

/** A template as the editor holds it; a new one starts with a rating, a choice and a text question. */
export function draftOf(template?: SurveyTemplate | null): TemplateDraft {
  if (!template) {
    const rating = blankQuestion("rating", []);
    const single = blankQuestion("single", [rating.key]);
    return {
      code: "",
      trigger: "post_delivery",
      rewardEnabled: true,
      titleTh: "",
      titleEn: "",
      questions: [rating, single, { ...blankQuestion("text", [rating.key, single.key]), required: false }],
    };
  }
  return {
    code: template.code,
    trigger: template.trigger,
    rewardEnabled: template.rewardEnabled,
    titleTh: template.title.th,
    titleEn: template.title.en ?? "",
    questions: template.questions.map((question) => ({
      key: question.key,
      kind: question.kind,
      th: question.label.th,
      en: question.label.en ?? "",
      required: question.required,
      options: (question.options ?? []).map((option) => ({
        key: option.key,
        th: option.label.th,
        en: option.label.en ?? "",
      })),
      maxLength: question.maxLength ?? TEXT_MAX,
    })),
  };
}

/** Changing a question's kind keeps its words and key; choices gain two blank options, others drop theirs. */
export function withKind(question: DraftQuestion, kind: QuestionKind): DraftQuestion {
  const choice = kind === "single" || kind === "multi";
  return {
    ...question,
    kind,
    options: choice ? (question.options.length ? question.options : blankQuestion(kind, []).options) : [],
  };
}

export type DraftProblem =
  | "code"
  | "title"
  | "count"
  | `q${number}.label`
  | `q${number}.options`
  | `q${number}.optionLabel`
  | `q${number}.maxLength`;

/** What stops the draft from saving, by field; empty when it may be sent. */
export function draftProblems(draft: TemplateDraft, isNew: boolean): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (isNew && !/^[a-z0-9_]+$/.test(draft.code)) problems.push("code");
  if (!draft.titleTh.trim() || !draft.titleEn.trim()) problems.push("title");
  if (draft.questions.length < QUESTIONS_MIN || draft.questions.length > QUESTIONS_MAX) problems.push("count");
  draft.questions.forEach((question, at) => {
    if (!question.th.trim() || !question.en.trim()) problems.push(`q${at}.label`);
    if (question.kind === "single" || question.kind === "multi") {
      if (question.options.length < OPTIONS_MIN || question.options.length > OPTIONS_MAX)
        problems.push(`q${at}.options`);
      if (question.options.some((option) => !option.th.trim() || !option.en.trim()))
        problems.push(`q${at}.optionLabel`);
    }
    if (question.kind === "text" && !(question.maxLength >= 1 && question.maxLength <= TEXT_MAX))
      problems.push(`q${at}.maxLength`);
  });
  return problems;
}

/** The body for `admin.surveys.createTemplate` / `updateTemplate`. */
export function inputOf(draft: TemplateDraft): SurveyTemplateInput {
  return {
    code: draft.code,
    trigger: draft.trigger,
    rewardEnabled: draft.rewardEnabled,
    title: { th: draft.titleTh.trim(), en: draft.titleEn.trim() },
    questions: draft.questions.map((question) => ({
      key: question.key,
      kind: question.kind,
      label: { th: question.th.trim(), en: question.en.trim() },
      required: question.required,
      ...(question.kind === "rating" ? { min: 1, max: 5 } : {}),
      ...(question.kind === "single" || question.kind === "multi"
        ? {
            options: question.options.map((option) => ({
              key: option.key,
              label: { th: option.th.trim(), en: option.en.trim() },
            })),
          }
        : {}),
      ...(question.kind === "text" ? { maxLength: question.maxLength } : {}),
    })),
  };
}

/**
 * Whether a refused create says another template has this code: getpack-api answers 422 `validation.failed` with the
 * field error `code` · `taken` (no problem code of its own). The editor shows it under the code field.
 */
export function isCodeTaken(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.code === "validation.failed" &&
    error.errors.some((entry) => entry.path === "code" && entry.code === "taken")
  );
}
