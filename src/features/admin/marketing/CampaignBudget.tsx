"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import { Meter } from "@/ui/components/Meter";

import type { Campaign } from "./resources";

/**
 * A campaign's budget as the API reports it (D-154): spent of budget as the share the API computes
 * (`spentPct` — the UI never divides money), against the alert threshold in force (setting
 * `campaigns.budget_alert_pct`). Past the threshold the API stamps `alertedAt`, and at the whole
 * budget it stops the campaign (`exhausted`); the screen says which, in words.
 */
export function CampaignBudget({
  campaign,
  compact = false,
}: {
  campaign: Pick<Campaign, "budgetAmount" | "spentAmount" | "spentPct" | "alertThresholdPct" | "alertedAt" | "status">;
  compact?: boolean;
}) {
  const t = useTranslations("marketing.budget");
  const format = useFormat();
  const spent = format.thb(campaign.spentAmount);
  const threshold = format.percent(campaign.alertThresholdPct, 0);
  const text =
    campaign.budgetAmount === null
      ? t("unlimited", { spent })
      : t("text", { spent, budget: format.thb(campaign.budgetAmount), threshold });
  const state =
    campaign.status === "exhausted" ? (
      <Badge tone="danger" icon="warning" size="sm">
        {t("exhausted")}
      </Badge>
    ) : campaign.alertedAt ? (
      <Badge tone="warning" icon="warning" size="sm">
        {t("alerted", { threshold })}
      </Badge>
    ) : null;
  return (
    <div className="flex w-full flex-col items-start gap-1">
      {campaign.spentPct !== null ? (
        <Meter
          className="w-full"
          label={t("gauge")}
          value={Number(campaign.spentPct)}
          marker={Number(campaign.alertThresholdPct)}
          valueText={text}
          tone={campaign.status === "exhausted" ? "danger" : campaign.alertedAt ? "warning" : "primary"}
        />
      ) : null}
      <p className={compact ? "text-xs" : "text-sm"}>
        {text}
        {campaign.spentPct !== null ? ` · ${format.percent(campaign.spentPct)}` : null}
      </p>
      {state}
    </div>
  );
}
