"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isApiError } from "@/lib/api/problem";
import type { SurveyTemplate } from "@/lib/api/requests/admin-loyalty-p2";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Sheet } from "@/ui/components/Sheet";
import { Icon } from "@/ui/icons";

import { adminBrowserApis, problemMessage } from "../console";
import {
  OPTIONS_MAX,
  QUESTION_KINDS,
  QUESTIONS_MAX,
  QUESTIONS_MIN,
  TEXT_MAX,
  blankQuestion,
  draftOf,
  draftProblems,
  inputOf,
  nextKey,
  withKind,
  type DraftQuestion,
  type TemplateDraft,
} from "./survey-template";

/**
 * Write a survey template (loyalty P2, D-491; `admin.surveys.createTemplate` / `updateTemplate`). A side sheet over the
 * template list: the code (new only), the trigger, the title and the reward switch, then 3–5 questions — each a rating
 * 1–5, a single or multiple choice or short text, worded in Thai and English. Only drafts are edited (a published one
 * is immutable: "สร้างฉบับใหม่" first). Saving keeps the sheet's draft on a refusal and names the field.
 */
export function SurveyTemplateEditor({
  template,
  open,
  onClose,
  onSaved,
}: {
  /** The draft to edit; `null` writes a new template. */
  template: SurveyTemplate | null;
  open: boolean;
  onClose: () => void;
  onSaved: (saved: SurveyTemplate) => void;
}) {
  const t = useTranslations("marketing.surveys.editor");
  const tTrigger = useTranslations("marketing.surveys.triggers");
  const tCommon = useTranslations("common.actions");
  const [draft, setDraft] = useState<TemplateDraft>(() => draftOf(template));
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const isNew = template === null;
  const problems = checked ? draftProblems(draft, isNew) : [];
  const has = (key: string) => (problems as string[]).includes(key);

  const set = (patch: Partial<TemplateDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const setQuestion = (at: number, next: DraftQuestion) =>
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, index) => (index === at ? next : question)),
    }));

  const save = async () => {
    setChecked(true);
    setFailure(null);
    if (draftProblems(draft, isNew).length) return;
    setBusy(true);
    try {
      const { requests } = adminBrowserApis();
      const body = inputOf(draft);
      let saved: SurveyTemplate;
      if (isNew) {
        saved = await requests.call("POST /v1/admin/surveys/templates", { body });
      } else {
        // A draft is edited under its ETag (412 if someone else saved it meanwhile).
        const { etag } = await requests.read("GET /v1/admin/surveys/templates/{templateId}", {
          path: { templateId: template.id },
        });
        // The code is fixed once created: the edit sends everything else.
        const { trigger, rewardEnabled, title, questions } = body;
        saved = await requests.call("PATCH /v1/admin/surveys/templates/{templateId}", {
          path: { templateId: template.id },
          body: { trigger, rewardEnabled, title, questions },
          etag: etag ?? undefined,
        });
      }
      onSaved(saved);
    } catch (error) {
      const code = isApiError(error) ? error.code : "";
      setFailure(
        code === "surveys.template_published" ? t("errors.published") : problemMessage(error, t("errors.failed")),
      );
    } finally {
      setBusy(false);
    }
  };

  const questionCount = draft.questions.length;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={isNew ? t("titleNew") : t("titleEdit", { code: template.code, version: template.version })}
      description={t("description")}
      closeLabel={tCommon("close")}
      className="w-[min(46rem,calc(100vw-2rem))]"
      footer={
        <>
          <Button loading={busy} onClick={() => void save()}>
            {isNew ? t("create") : tCommon("save")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section aria-labelledby="survey-editor-basics" className="flex flex-col gap-4">
          <h3 id="survey-editor-basics" className="text-[0.9375rem] font-semibold">
            {t("basics")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {isNew ? (
              <Field label={t("code")} hint={t("codeHint")} error={has("code") ? t("errors.code") : undefined} required>
                <Input
                  value={draft.code}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  onChange={(event) => set({ code: event.target.value.trim().toLowerCase() })}
                />
              </Field>
            ) : null}
            <Field label={t("trigger")} hint={t("triggerHint")}>
              <NativeSelect
                value={draft.trigger}
                onValueChange={(trigger) => set({ trigger })}
                options={(["post_delivery", "quarterly"] as const).map((value) => ({ value, label: tTrigger(value) }))}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("titleTh")}
              error={has("title") && !draft.titleTh.trim() ? t("errors.title") : undefined}
              required
            >
              <Input value={draft.titleTh} onChange={(event) => set({ titleTh: event.target.value })} />
            </Field>
            <Field
              label={t("titleEn")}
              error={has("title") && !draft.titleEn.trim() ? t("errors.title") : undefined}
              required
            >
              <Input value={draft.titleEn} lang="en" onChange={(event) => set({ titleEn: event.target.value })} />
            </Field>
          </div>
          <Checkbox
            label={t("reward")}
            description={t("rewardHint")}
            checked={draft.rewardEnabled}
            onCheckedChange={(on) => set({ rewardEnabled: on === true })}
          />
        </section>

        <section aria-labelledby="survey-editor-questions" className="border-border flex flex-col gap-3 border-t pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="survey-editor-questions" className="text-[0.9375rem] font-semibold">
              {t("questions")}
            </h3>
            <p className={has("count") ? "text-danger text-sm" : "text-muted text-sm tabular-nums"}>
              {t("count", { count: questionCount, min: QUESTIONS_MIN, max: QUESTIONS_MAX })}
            </p>
          </div>

          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {draft.questions.map((question, at) => (
              <QuestionCard
                key={question.key}
                index={at}
                question={question}
                problems={problems.filter((problem) => problem.startsWith(`q${at}.`)).map((p) => p.split(".")[1]!)}
                canRemove={questionCount > QUESTIONS_MIN}
                onChange={(next) => setQuestion(at, next)}
                onRemove={() => set({ questions: draft.questions.filter((_, index) => index !== at) })}
              />
            ))}
          </ol>

          <div>
            <Button
              variant="secondary"
              size="sm"
              iconStart="plus"
              disabled={questionCount >= QUESTIONS_MAX}
              onClick={() =>
                set({
                  questions: [
                    ...draft.questions,
                    blankQuestion(
                      "single",
                      draft.questions.map((question) => question.key),
                    ),
                  ],
                })
              }
            >
              {questionCount >= QUESTIONS_MAX ? t("full", { max: QUESTIONS_MAX }) : t("addQuestion")}
            </Button>
          </div>
        </section>

        {failure ? (
          <p role="alert" className="text-danger flex items-center gap-1.5 text-sm">
            <Icon name="error" size={14} aria-hidden="true" />
            {failure}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

function QuestionCard({
  index,
  question,
  problems,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  question: DraftQuestion;
  problems: string[];
  canRemove: boolean;
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("marketing.surveys.editor");
  const choice = question.kind === "single" || question.kind === "multi";
  const labelError = problems.includes("label") ? t("errors.label") : undefined;
  const setOption = (at: number, patch: { th?: string; en?: string }) =>
    onChange({
      ...question,
      options: question.options.map((option, index) => (index === at ? { ...option, ...patch } : option)),
    });

  return (
    <li
      aria-label={t("questionN", { n: index + 1 })}
      className="border-border bg-surface rounded-panel flex flex-col gap-3.5 border p-4"
    >
      <div className="flex items-center gap-3">
        <span className="text-subtle w-5 shrink-0 text-[0.8125rem] font-semibold tabular-nums">{index + 1}</span>
        <div className="w-48 max-w-full">
          <Field label={t("kind")} labelHidden>
            <NativeSelect
              value={question.kind}
              onValueChange={(kind) => onChange(withKind(question, kind))}
              options={QUESTION_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
            />
          </Field>
        </div>
        <span className="flex-1" />
        <Checkbox
          size="sm"
          label={t("required")}
          checked={question.required}
          onCheckedChange={(on) => onChange({ ...question, required: on === true })}
        />
        <IconButton
          name="trash"
          size="sm"
          label={t("removeQuestion", { n: index + 1 })}
          disabled={!canRemove}
          onClick={onRemove}
        />
      </div>

      <div className="grid gap-3 sm:ms-8 sm:grid-cols-2">
        <Field label={t("labelTh")} error={!question.th.trim() ? labelError : undefined}>
          <Input value={question.th} onChange={(event) => onChange({ ...question, th: event.target.value })} />
        </Field>
        <Field label={t("labelEn")} error={!question.en.trim() ? labelError : undefined}>
          <Input
            value={question.en}
            lang="en"
            onChange={(event) => onChange({ ...question, en: event.target.value })}
          />
        </Field>
      </div>

      {question.kind === "rating" ? <p className="text-muted text-[0.8125rem] sm:ms-8">{t("ratingNote")}</p> : null}

      {question.kind === "text" ? (
        <div className="w-44 sm:ms-8">
          <Field
            label={t("maxLength")}
            error={problems.includes("maxLength") ? t("errors.maxLength", { max: TEXT_MAX }) : undefined}
          >
            <NumberInput
              unit={t("characters")}
              min={1}
              max={TEXT_MAX}
              value={Number.isFinite(question.maxLength) ? question.maxLength : ""}
              onChange={(event) => onChange({ ...question, maxLength: Number.parseInt(event.target.value, 10) })}
            />
          </Field>
        </div>
      ) : null}

      {choice ? (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 sm:ms-8">
          <legend className="text-muted mb-1 p-0 text-[0.8125rem]">{t("options")}</legend>
          {question.options.map((option, at) => (
            <div key={option.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
              <Input
                aria-label={t("optionTh", { n: at + 1 })}
                placeholder={t("optionTh", { n: at + 1 })}
                value={option.th}
                aria-invalid={problems.includes("optionLabel") && !option.th.trim() ? true : undefined}
                onChange={(event) => setOption(at, { th: event.target.value })}
              />
              <Input
                aria-label={t("optionEn", { n: at + 1 })}
                placeholder={t("optionEn", { n: at + 1 })}
                lang="en"
                value={option.en}
                aria-invalid={problems.includes("optionLabel") && !option.en.trim() ? true : undefined}
                onChange={(event) => setOption(at, { en: event.target.value })}
              />
              <IconButton
                name="close"
                size="sm"
                label={t("removeOption", { n: at + 1 })}
                disabled={question.options.length <= 2}
                onClick={() => onChange({ ...question, options: question.options.filter((_, index) => index !== at) })}
              />
            </div>
          ))}
          {problems.includes("optionLabel") ? (
            <p className="text-danger text-[0.8125rem]">{t("errors.optionLabel")}</p>
          ) : null}
          {question.options.length < OPTIONS_MAX ? (
            <div>
              <Button
                size="sm"
                variant="ghost"
                iconStart="plus"
                onClick={() =>
                  onChange({
                    ...question,
                    options: [
                      ...question.options,
                      {
                        key: nextKey(
                          "o",
                          question.options.map((entry) => entry.key),
                        ),
                        th: "",
                        en: "",
                      },
                    ],
                  })
                }
              >
                {t("addOption")}
              </Button>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </li>
  );
}
