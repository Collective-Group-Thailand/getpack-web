"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";

import type { Campaign } from "./resources";

/**
 * A campaign's budget as the API reports it (D-154): spent of budget, and the alert threshold in
 * force (setting `campaigns.budget_alert_pct`). Past the threshold the API stamps `alertedAt`, and
 * at the whole budget it stops the campaign (`exhausted`); the screen says which, in words.
 *
 * CONTRACT-GAP admin.campaigns — `CampaignDto` has no `spentPct`, so there is no gauge: the share
 * spent is the API's to compute, never the UI's (the UI does not divide money).
 */
export function CampaignBudget({
  campaign,
  compact = false,
}: {
  campaign: Pick<Campaign, "budgetAmount" | "spentAmount" | "alertThresholdPct" | "alertedAt" | "status">;
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
    <div className="flex flex-col items-start gap-1">
      <p className={compact ? "text-xs" : "text-sm"}>{text}</p>
      {state}
    </div>
  );
}
