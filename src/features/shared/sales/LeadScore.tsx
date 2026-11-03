"use client";

import { useTranslations } from "next-intl";

import { leadScoreTone } from "@/domain/status";
import { useFormat } from "@/features/shared/format/useFormat";
import type { Schemas } from "@/lib/api/types";
import { Popover } from "@/ui/components/Popover";
import { ScoreChip } from "@/ui/components/ScoreChip";
import { cn } from "@/ui/lib/cn";

type Reason = Schemas["SalesScoreReasonDto"];

/**
 * A lead score (D-471). Staff surfaces pass the reasons: the chip is then a button that opens a non-modal popover
 * with the top three reasons and their points (Enter / Space opens it, Esc closes it and focus returns to the chip;
 * Tab moves through it and on). The agent's own leads pass none: the chip is a plain label, because the reasons and
 * the rules stay with getpack staff.
 */
export function LeadScore({
  score,
  reasons,
  scoredAt,
  name,
  size = "md",
  className,
}: {
  score: number | null;
  /** Staff only. Omit on the agent zone. */
  reasons?: Reason[];
  scoredAt?: string | null;
  /** Whose score — for the button's accessible name in a list of many. */
  name?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("agentSales.score");
  const format = useFormat();
  if (score === null)
    return (
      <span className={cn("text-muted text-xs", className)} title={t("notYet")}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("notYet")}</span>
      </span>
    );
  const tone = leadScoreTone(score);
  const label = name ? t("labelFor", { score, name }) : t("label", { score });
  if (!reasons) return <ScoreChip value={score} tone={tone} label={label} size={size} className={className} />;
  return (
    <Popover
      aria-label={t("reasonsTitle", { score })}
      align="start"
      className="w-80"
      trigger={
        <ScoreChip
          value={score}
          tone={tone}
          label={t("openReasons", { label })}
          interactive
          size={size}
          className={className}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">{t("reasonsTitle", { score })}</p>
          <span className="text-muted text-xs tabular-nums">{t("outOf")}</span>
        </div>
        {reasons.length ? (
          <ol className="flex flex-col gap-2" aria-label={t("topReasons")}>
            {reasons.map((reason) => (
              <li key={reason.reason} className="flex items-start justify-between gap-3">
                <span className="text-sm leading-snug">{t(`reasons.${reason.reason}`)}</span>
                <span
                  className={cn(
                    "rounded-control shrink-0 px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    reason.points >= 0
                      ? "bg-success-subtle text-success-subtle-fg"
                      : "bg-neutral-subtle text-neutral-subtle-fg",
                  )}
                >
                  {t("points", {
                    points: reason.points,
                    sign: reason.points >= 0 ? "+" : "−",
                    abs: Math.abs(reason.points),
                  })}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted text-sm">{t("noReasons")}</p>
        )}
        <p className="text-muted border-border border-t pt-2 text-xs leading-relaxed">
          {t("footnote")}
          {scoredAt ? ` ${t("scoredAt", { at: format.dateTime(scoredAt, { style: "dayMonth" }) })}` : null}
        </p>
      </div>
    </Popover>
  );
}
