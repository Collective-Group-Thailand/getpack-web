"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserRequests } from "@/lib/api/requests/browser";
import type { SurveyInstance } from "@/lib/api/requests/store-loyalty-p2";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Sheet, SheetClose } from "@/ui/components/Sheet";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { SurveyForm } from "./SurveyForm";

export type SurveyCardVariant = "account" | "order" | "liff";

/**
 * The survey invitation (loyalty P2, D-491; prototype `p2-survey.html`): one quiet row — icon tile, the order code,
 * the question, "4 คำถามสั้น ๆ · ตอบครบรับ 8 แต้ม · ตอบได้ถึง …" — with an outline "ตอบแบบสอบถาม" and a ghost
 * "ไว้ทีหลัง". Showing it marks the instance seen once (`store.surveys.markSeen`): the API then stops offering it
 * ("shown once"), and the e-mail / LINE link still opens it until it expires. "ไว้ทีหลัง" dismisses it for good.
 * The questions open in a sheet: a bottom sheet on the phone, a centred 600 px panel from 768 px.
 */
export function SurveyCard({
  survey,
  variant = "account",
  className,
}: {
  survey: SurveyInstance | null;
  variant?: SurveyCardVariant;
  className?: string;
}) {
  const t = useTranslations("account.surveys");
  const format = useFormat();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const marked = useRef(false);

  useEffect(() => {
    if (!survey || survey.status !== "open" || marked.current) return;
    marked.current = true;
    void browserRequests()
      .call("POST /v1/store/surveys/{surveyId}/actions/seen", { path: { surveyId: survey.id } })
      .catch(() => undefined);
  }, [survey]);

  if (!survey || hidden) return null;

  const later = () => {
    setOpen(false);
    setHidden(true);
    void browserRequests()
      .call("POST /v1/store/surveys/{surveyId}/actions/dismiss", { path: { surveyId: survey.id } })
      .catch(() => undefined);
  };
  const title = variant === "order" ? t("titleOrder") : survey.title;
  const meta = [
    variant === "liff" ? null : t("questions", { count: survey.questions.length }),
    survey.rewardPoints > 0 ? "reward" : null,
    t(variant === "liff" ? "untilShort" : "until", { date: format.date(survey.expiresAt) }),
  ].filter(Boolean);
  const compact = variant !== "account";

  return (
    <>
      <section
        aria-labelledby={`survey-${survey.id}`}
        className={cn(
          "border-border bg-surface grid items-center gap-x-3.5 gap-y-3 border",
          compact ? "rounded-card grid-cols-[2.25rem_minmax(0,1fr)] p-3.5" : "rounded-panel",
          !compact &&
            "grid-cols-[2.25rem_minmax(0,1fr)] p-3.5 md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:px-[1.125rem] md:py-4",
          variant === "order" && "md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:px-[1.125rem] md:py-4",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-9 place-items-center self-start md:size-10 md:self-center"
        >
          <Icon name="chat" size={variant === "liff" ? 18 : 20} />
        </span>
        <div className="min-w-0">
          {survey.orderCode && variant !== "order" ? (
            <p className="text-muted text-[0.8125rem] tabular-nums">
              {variant === "liff" ? survey.orderCode : t("orderRef", { code: survey.orderCode })}
            </p>
          ) : null}
          <h2 id={`survey-${survey.id}`} className="mt-px text-[0.96875rem] leading-snug font-semibold">
            {title}
          </h2>
          <p className="text-muted mt-0.5 text-[0.84375rem]">
            {meta.map((part, at) => (
              <span key={at}>
                {at > 0 ? " · " : null}
                {part === "reward"
                  ? t.rich("rewardShort", {
                      points: format.number(survey.rewardPoints),
                      b: (chunk) => <b className="text-primary-subtle-fg font-semibold">{chunk}</b>,
                    })
                  : part}
              </span>
            ))}
          </p>
        </div>
        <div
          className={cn(
            "col-span-full flex items-center gap-1.5",
            (variant === "account" || variant === "order") && "md:col-span-1",
          )}
        >
          <Button
            variant="secondary"
            size={variant === "order" ? "sm" : undefined}
            className="max-md:flex-1"
            onClick={() => setOpen(true)}
          >
            {t("answer")}
          </Button>
          {variant === "order" ? null : (
            <Button variant="ghost" onClick={later}>
              {t("later")}
            </Button>
          )}
        </div>
      </section>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && finished) {
            setHidden(true);
            router.refresh();
          }
        }}
        title={survey.title}
        closeLabel={t("close")}
        appearance="bare"
        className="md:inset-x-auto md:top-[6dvh] md:bottom-auto md:left-1/2 md:max-h-[88dvh] md:w-[37.5rem] md:-translate-x-1/2"
      >
        <div className="bg-surface shadow-overlay md:rounded-panel rounded-t-card">
          <span aria-hidden="true" className="bg-border rounded-thumb mx-auto mt-2 block h-1 w-9 md:hidden" />
          {finished ? null : (
            <div className="border-border flex items-start justify-between gap-4 px-5 pt-3 md:border-b md:px-6 md:pt-5 md:pb-4">
              <div className="min-w-0 max-md:hidden">
                {survey.orderCode ? (
                  <p className="text-muted text-[0.8125rem] tabular-nums">
                    {t("orderRef", { code: survey.orderCode })}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xl leading-snug font-semibold">{survey.title}</p>
                {survey.rewardPoints > 0 ? (
                  <p className="text-muted mt-1 text-[0.84375rem]">
                    {t.rich("reward", {
                      count: survey.questions.length,
                      points: format.number(survey.rewardPoints),
                      b: (chunk) => <b className="text-primary-subtle-fg font-semibold">{chunk}</b>,
                    })}
                  </p>
                ) : null}
              </div>
              <span className="md:hidden" />
              <SheetClose asChild>
                <IconButton name="close" label={t("close")} size="sm" />
              </SheetClose>
            </div>
          )}
          <div className="px-5 pb-5 md:px-6">
            <SurveyForm
              survey={survey}
              onLater={later}
              onSubmitted={() => setFinished(true)}
              onClose={() => {
                setOpen(false);
                setHidden(true);
                router.refresh();
              }}
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}
