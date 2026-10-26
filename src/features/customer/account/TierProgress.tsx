import { getLocale, getTranslations } from "next-intl/server";

import { pick } from "@/features/customer/catalog/localize";
import { getFormat } from "@/features/shared/format/server";
import { Meter } from "@/ui/components/Meter";

import type { Points } from "./api.server";

/**
 * Where the customer stands on the way to the next tier (D-134): the 12-month spend against the
 * spend the next tier needs, and the API's own percentage. The thresholds are settings the API
 * sends; nothing here subtracts one amount from another. At the top tier it says so instead.
 */
export async function TierProgress({ points, className }: { points: Points; className?: string }) {
  const [t, format, locale] = await Promise.all([getTranslations("account.home"), getFormat(), getLocale()]);
  // What counts, in the API's words (`spendBasisTh`): the real rule, not one written here — and the paid
  // orders that will count once completed, so a 0 beside an order on its way is explained.
  const basis = (
    <>
      <p className="text-muted mt-1 text-xs">{pick(locale, points.spendBasisTh, points.spendBasisEn)}</p>
      {/[1-9]/.test(points.spendNotYetCounted) ? (
        <p className="text-muted mt-1 text-xs">
          {t("tierNotYetCounted", { amount: format.thb(points.spendNotYetCounted) })}
        </p>
      ) : null}
    </>
  );
  if (!points.nextTier || !points.nextTierMinSpend12m)
    return (
      <div className={className}>
        <p>{t("tierTop", { tier: t(`tiers.${points.tier}`) })}</p>
        {basis}
      </div>
    );

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
      {basis}
    </div>
  );
}
