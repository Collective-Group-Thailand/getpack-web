"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { Meter } from "@/ui/components/Meter";

import type { CampaignSummary } from "./resources";

/**
 * A campaign's budget as the API reports it (D-154): spent of budget, with the alert threshold
 * in force marked on the track and said in words. Past the threshold the meter turns warning,
 * at the whole budget danger — the figures and the comparison are the API's percentages.
 */
export function BudgetMeter({
  campaign,
  compact = false,
}: {
  campaign: Pick<CampaignSummary, "code" | "budgetAmount" | "spentAmount" | "spentPct" | "alertThresholdPct">;
  compact?: boolean;
}) {
  const t = useTranslations("marketing.budget");
  const format = useFormat();
  const spent = Number(campaign.spentPct);
  const threshold = Number(campaign.alertThresholdPct);
  const text = t("text", {
    spent: format.thb(campaign.spentAmount),
    budget: format.thb(campaign.budgetAmount),
    pct: format.percent(campaign.spentPct, 0),
    threshold: format.percent(campaign.alertThresholdPct, 0),
  });
  return (
    <div className="flex flex-col gap-1">
      <Meter
        label={t("label", { code: campaign.code })}
        value={spent}
        valueText={text}
        marker={threshold}
        tone={spent >= 100 ? "danger" : spent >= threshold ? "warning" : "primary"}
      />
      <p className={compact ? "text-muted text-xs" : "text-muted text-sm"}>
        {compact
          ? t("compact", { spent: format.thb(campaign.spentAmount), pct: format.percent(campaign.spentPct, 0) })
          : text}
      </p>
    </div>
  );
}
