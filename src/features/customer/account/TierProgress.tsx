import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import { Meter } from "@/ui/components/Meter";

import type { Points } from "./api.server";

/**
 * Where the customer stands on the way to the next tier (D-134): the 12-month spend against the
 * spend the next tier needs, and the API's own percentage. The thresholds are settings the API
 * sends; nothing here subtracts one amount from another. At the top tier it says so instead.
 */
export async function TierProgress({ points, className }: { points: Points; className?: string }) {
  const [t, format] = await Promise.all([getTranslations("account.home"), getFormat()]);
  if (!points.nextTier || !points.nextTierMinSpend12m)
    return <p className={className}>{t("tierTop", { tier: t(`tiers.${points.tier}`) })}</p>;

  const text = t("tierProgress", {
    spend: format.thb(points.spend12m),
    needed: format.thb(points.nextTierMinSpend12m),
    tier: t(`tiers.${points.nextTier}`),
  });
  return (
    <div className={className}>
      <Meter
        // Drawn from the API's percentage; the figures are in the text.
        value={Number(points.nextTierProgressPct)}
        label={t("tierProgressLabel", { tier: t(`tiers.${points.nextTier}`) })}
        valueText={text}
      />
      <p className="text-muted mt-1 text-xs">{text}</p>
    </div>
  );
}
