"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { SurveyInstance, SurveyQuestion } from "@/lib/api/requests/store-loyalty-p2";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { isAnswered, missingRequired, ratingScale, toSubmission, type Answers, type AnswerValue } from "./survey-model";

type Outcome = { kind: "done"; rewardPoints: number } | { kind: "closed" };

/**
 * The questions of one survey instance (loyalty P2, prototype `p2-survey.html`). From 768 px every question is on the
 * page, numbered, with the PDPA purpose line above "ส่งคำตอบ"; below that it is one question per step with "2 / 4" and
 * a segmented bar, "ถัดไป" checking the step's required answer. Ratings are square buttons in a radiogroup with the
 * end labels — not stars, which mean product reviews. The reward line is the API's `rewardPoints` (none at 0).
 */
export function SurveyForm({
  survey,
  onLater,
  onClose,
  onSubmitted,
  className,
}: {
  survey: SurveyInstance;
  /** "ไว้ทีหลัง": the parent dismisses or just closes. Absent on the survey's own page. */
  onLater?: () => void;
  /** After the thanks state, "ปิด". Absent: a link back to the account. */
  onClose?: () => void;
  /** The answers were accepted (the thanks state is showing). */
  onSubmitted?: (rewardPoints: number) => void;
  className?: string;
}) {
  const t = useTranslations("account.surveys");
  const format = useFormat();
  const id = useId();
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const questions = survey.questions;
  const last = questions.length - 1;

  const set = (key: string, value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const require = (keys: readonly string[]) => {
    if (!keys.length) return true;
    setErrors(Object.fromEntries(keys.map((key) => [key, t("required")])));
    document.getElementById(`${id}-${keys[0]}`)?.focus();
    return false;
  };

  const submit = async () => {
    if (!require(missingRequired(questions, answers))) {
      const first = questions.findIndex((question) => missingRequired([question], answers).length > 0);
      if (first !== -1) setStep(first);
      return;
    }
    setSending(true);
    try {
      const result = await browserRequests().call("POST /v1/store/surveys/{surveyId}/responses", {
        path: { surveyId: survey.id },
        body: { answers: toSubmission(questions, answers) },
      });
      setOutcome({ kind: "done", rewardPoints: result.rewardPoints });
      onSubmitted?.(result.rewardPoints);
    } catch (error) {
      if (isApiError(error) && error.code === "surveys.not_open") setOutcome({ kind: "closed" });
      else if (isApiError(error) && error.code === "validation.failed")
        setErrors(
          Object.fromEntries(error.errors.map((entry) => [entry.path.replace(/^answers\./, ""), t("invalid")])),
        );
      else setErrors({ _form: t("failed") });
    } finally {
      setSending(false);
    }
  };

  if (outcome?.kind === "done")
    return (
      <div className={cn("flex flex-col items-center px-6 pt-9 pb-6 text-center", className)} role="status">
        <span className="bg-success-subtle text-success grid size-13 place-items-center rounded-full">
          <Icon name="check" size={26} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[1.1875rem] font-semibold">{t("thanks")}</p>
        <p className="text-muted mt-1 text-sm">{t("thanksBody")}</p>
        {outcome.rewardPoints > 0 ? (
          <p className="bg-primary-subtle text-primary-subtle-fg rounded-card mt-5 inline-flex items-baseline gap-1.5 px-4 py-2.5 text-sm">
            {t.rich("earned", {
              points: format.number(outcome.rewardPoints),
              b: (chunk) => <b className="text-[1.375rem] font-semibold tabular-nums">{chunk}</b>,
            })}
          </p>
        ) : null}
        <div className="mt-6 w-full">
          {onClose ? (
            <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
              {t("close")}
            </Button>
          ) : (
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href="/account">{t("backToAccount")}</Link>
            </Button>
          )}
        </div>
      </div>
    );

  if (outcome?.kind === "closed") return <SurveyClosed className={className} onClose={onClose} />;

  const reward =
    survey.rewardPoints > 0
      ? t.rich("reward", {
          count: questions.length,
          points: format.number(survey.rewardPoints),
          b: (chunk) => <b className="text-primary-subtle-fg font-semibold">{chunk}</b>,
        })
      : null;

  return (
    <form
      noValidate
      className={cn("flex flex-col", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {/* Phone: where we are, as a figure and a segmented bar (no percentage). */}
      <div className="md:hidden">
        <p className="text-muted text-[0.8125rem] tabular-nums" aria-live="polite">
          {t.rich("step", {
            current: step + 1,
            total: questions.length,
            b: (chunk) => <b className="text-fg font-semibold">{chunk}</b>,
          })}
        </p>
        <div
          aria-hidden="true"
          className="mt-1.5 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${questions.length}, 1fr)` }}
        >
          {questions.map((question, at) => (
            <span key={question.key} className={cn("h-[3px] rounded-sm", at <= step ? "bg-primary" : "bg-bg-subtle")} />
          ))}
        </div>
      </div>

      <ol className="m-0 list-none p-0">
        {questions.map((question, at) => (
          <li
            key={question.key}
            className={cn(
              "border-border md:border-t md:py-5 md:first:border-t-0 md:first:pt-1",
              at !== step && "max-md:hidden",
              "max-md:pt-5",
            )}
          >
            <QuestionField
              id={`${id}-${question.key}`}
              number={at + 1}
              question={question}
              value={answers[question.key]}
              error={errors[question.key]}
              onChange={(value) => set(question.key, value)}
            />
          </li>
        ))}
      </ol>

      {errors._form ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {errors._form}
        </p>
      ) : null}

      {/* The purpose of the answers (PDPA): on every desktop form, on the phone's last step. */}
      <p
        className={cn(
          "bg-bg-subtle rounded-card text-muted mt-5 flex items-start gap-2.5 px-3.5 py-3 text-[0.8125rem] leading-relaxed",
          step !== last && "max-md:hidden",
        )}
      >
        <Icon name="shield" size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          {t("purpose")}{" "}
          <Link href="/legal/privacy" className="text-primary underline underline-offset-[3px]">
            {t("privacy")}
          </Link>
        </span>
      </p>

      {/* Desktop actions. */}
      <div className="mt-4 hidden items-center justify-between md:flex">
        {onLater ? (
          <Button type="button" variant="ghost" onClick={onLater}>
            {t("later")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={sending}>
          {t("submit")}
        </Button>
      </div>

      {/* Phone actions: back (or later) and next (or submit). */}
      <div className="mt-6 grid grid-cols-[auto_1fr] gap-2.5 md:hidden">
        {step > 0 ? (
          <IconButton
            name="chevron-left"
            label={t("back")}
            variant="secondary"
            className="size-13"
            onClick={() => setStep(step - 1)}
          />
        ) : onLater ? (
          <Button type="button" variant="ghost" size="lg" onClick={onLater}>
            {t("later")}
          </Button>
        ) : (
          <span />
        )}
        {step < last ? (
          <Button
            type="button"
            size="lg"
            onClick={() => {
              const question = questions[step]!;
              if (question.required && !isAnswered(question, answers[question.key])) require([question.key]);
              else setStep(step + 1);
            }}
          >
            {t("next")}
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={sending}>
            {t("submit")}
          </Button>
        )}
      </div>
      {reward ? <p className="text-muted mt-3 text-center text-[0.8125rem] md:hidden">{reward}</p> : null}
    </form>
  );
}

/** A survey that is no longer open (completed, dismissed earlier or expired): neutral, no blame. */
export function SurveyClosed({ onClose, className }: { onClose?: () => void; className?: string }) {
  const t = useTranslations("account.surveys");
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <Icon name="clock" size={22} aria-hidden="true" className="text-muted" />
      <p className="mt-3 text-lg font-semibold">{t("closedTitle")}</p>
      <p className="text-muted mt-1 mb-4 text-sm">{t("closedBody")}</p>
      {onClose ? (
        <Button variant="secondary" onClick={onClose}>
          {t("close")}
        </Button>
      ) : (
        <Button asChild variant="secondary">
          <Link href="/account">{t("backToAccount")}</Link>
        </Button>
      )}
    </div>
  );
}

function QuestionField({
  id,
  number,
  question,
  value,
  error,
  onChange,
}: {
  id: string;
  number: number;
  question: SurveyQuestion;
  value: AnswerValue | undefined;
  error: string | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const t = useTranslations("account.surveys");
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const optional = !question.required;
  const tile =
    "border-border bg-surface rounded-control flex min-h-11 cursor-pointer items-center gap-2.5 border px-3.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-subtle has-[:checked]:text-primary-subtle-fg has-[:checked]:font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring max-md:min-h-13 max-md:w-full";

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="m-0 min-w-0 border-0 p-0">
      <legend id={labelId} className="flex items-baseline gap-2.5 p-0">
        <span aria-hidden="true" className="text-subtle hidden w-4 shrink-0 text-[0.8125rem] tabular-nums md:inline">
          {number}
        </span>
        <span className="text-[1.1875rem] leading-snug font-semibold md:text-[0.9375rem]">
          {question.label}
          {optional ? (
            <span className="text-muted ms-1.5 text-[0.8125rem] font-normal">
              {question.kind === "multi" ? t("optionalMulti") : t("optional")}
            </span>
          ) : null}
        </span>
      </legend>

      <div className="mt-4 md:ms-[1.625rem] md:mt-3">
        {question.kind === "rating" ? (
          <div className="max-md:w-full md:w-max">
            <div
              role="radiogroup"
              aria-labelledby={labelId}
              className="grid grid-cols-5 gap-2 md:grid-cols-[repeat(5,3rem)]"
            >
              {ratingScale(question).map((score) => {
                const on = value === score;
                return (
                  <button
                    key={score}
                    id={score === ratingScale(question)[0] ? id : undefined}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={cn(
                      "rounded-control bg-surface focus-visible:ring-focus-ring h-13 border text-[1.0625rem] font-semibold tabular-nums outline-none focus-visible:ring-2 md:h-11 md:text-[0.9375rem]",
                      on
                        ? "border-primary bg-primary-subtle text-primary-subtle-fg ring-primary ring-1 ring-inset"
                        : "border-border hover:border-border-strong",
                    )}
                    onClick={() => onChange(score)}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
            <div aria-hidden="true" className="text-muted mt-1.5 flex justify-between text-xs">
              <span>{t("ratingLow")}</span>
              <span>{t("ratingHigh")}</span>
            </div>
          </div>
        ) : question.kind === "text" ? (
          <div className="relative">
            <Textarea
              id={id}
              aria-labelledby={labelId}
              rows={3}
              maxLength={question.maxLength ?? 500}
              placeholder={t("textPlaceholder", { max: question.maxLength ?? 500 })}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value)}
            />
            <span className="text-subtle pointer-events-none absolute end-2.5 bottom-2 text-xs tabular-nums">
              {(typeof value === "string" ? value.length : 0).toLocaleString()}/{question.maxLength ?? 500}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-md:flex-col">
            {(question.options ?? []).map((option, at) => {
              const multi = question.kind === "multi";
              const checked = multi ? Array.isArray(value) && value.includes(option.key) : value === option.key;
              return (
                <label key={option.key} className={tile}>
                  <input
                    id={at === 0 ? id : undefined}
                    type={multi ? "checkbox" : "radio"}
                    name={id}
                    className="accent-primary size-4.5 shrink-0"
                    checked={checked}
                    onChange={(event) => {
                      if (!multi) return onChange(option.key);
                      const current = Array.isArray(value) ? value : [];
                      onChange(
                        event.target.checked
                          ? [...current, option.key]
                          : current.filter((entry) => entry !== option.key),
                      );
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        )}
        {error ? (
          <p id={errorId} role="alert" className="text-danger mt-2 flex items-center gap-1.5 text-[0.8125rem]">
            <Icon name="error" size={14} aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
