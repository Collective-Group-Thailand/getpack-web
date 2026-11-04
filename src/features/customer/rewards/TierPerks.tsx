"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import type { LoyaltySummaryP3 } from "@/features/shared/loyalty-p3/read";
import { shortMultiplier } from "@/features/shared/loyalty-p2/multipliers";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { ActiveMultiplier, LoyaltyPerk, PerkCode } from "@/lib/api/requests/store-loyalty-p3";
import type { Schemas } from "@/lib/api/types";
import { Meter } from "@/ui/components/Meter";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { quarterOf } from "./model";

const PERK_ICON: Record<PerkCode, IconName> = {
  quarterly_free_shipping: "truck",
  free_shipping_every_order: "truck",
  priority_support: "chat",
  quarterly_free_rush: "zap",
  priority_production_slot: "flag",
};

export interface TierPerksProps {
  /** `store.loyalty.get` as published (spend, thresholds, the API's percentage, the spend basis). */
  points: Pick<
    Schemas["LoyaltySummaryDto"],
    | "multiplier"
    | "spend12m"
    | "nextTierMinSpend12m"
    | "nextTierProgressPct"
    | "spendBasisTh"
    | "spendBasisEn"
    | "spendNotYetCounted"
  >;
  /** Its P3 fields (`loyaltyP3Of`): the tier with Platinum, perks and active multipliers. */
  loyalty: LoyaltySummaryP3;
  className?: string;
}

/**
 * The tier panel of `/account/points` (loyalty P3, D-478 / D-500; prototype `p3-tier-perks.html`). Left: the tier
 * name as the panel's figure, the API's percentage on a 4 px meter towards the next tier (or "ระดับสูงสุดแล้ว"), what
 * counts, and the multipliers in force — informational, the web never multiplies (the checkout shows the points).
 * Right: the tier's perks — an active perk carries no status; only a granted coupon ("ดูคูปอง"), a used one and the
 * next quarter's say anything — then the next tier's perks, muted. No date or production site is promised for the
 * slot; 30-day terms and an account manager are not automated (D-500) and are not listed.
 */
export function TierPerks({ points, loyalty, className }: TierPerksProps) {
  const t = useTranslations("account.perks");
  const tTier = useTranslations("account.home.tiers");
  const format = useFormat();
  const locale = useLocale();
  const tier = tTier(loyalty.tier);

  const quarterText = (period: string | undefined) => {
    const quarter = quarterOf(period);
    return quarter
      ? t("quarter", { quarter: quarter.quarter, year: String(quarter.year + (format.locale === "th" ? 543 : 0)) })
      : null;
  };

  const perkMeta = (perk: LoyaltyPerk) => {
    if (perk.status === "granted")
      return [
        quarterText(perk.period),
        perk.couponExpiresAt ? t("couponUntil", { date: format.date(perk.couponExpiresAt) }) : null,
      ]
        .filter(Boolean)
        .join(" · ");
    if (perk.status === "used") return quarterText(perk.period);
    if (perk.status === "next_quarter") return t("nextQuarterNote");
    return t(`codes.${perk.code}.note`);
  };

  const perkStatus = (perk: LoyaltyPerk) => {
    if (perk.status === "granted")
      return (
        <Link
          href="/account/points/redeem#mine"
          className="text-primary text-[0.84375rem] font-medium underline decoration-1 underline-offset-4"
        >
          {t("seeCoupon")}
        </Link>
      );
    if (perk.status === "used") return <span className="text-muted text-[0.8125rem]">{t("used")}</span>;
    if (perk.status === "next_quarter") return <span className="text-muted text-[0.8125rem]">{t("nextQuarter")}</span>;
    return null;
  };

  const multiplierName = (item: ActiveMultiplier) =>
    item.source === "campaign" && item.name
      ? item.name
      : item.source === "tier"
        ? t("multipliers.tier", { tier })
        : t(`multipliers.${item.source}`);
  const until = (item: ActiveMultiplier) => {
    const end = item.endsAt ?? item.endsOn ?? null;
    return end ? t("until", { date: format.date(end, { style: "dayMonth" }) }) : null;
  };

  const perkRows = (perks: readonly LoyaltyPerk[], next: boolean) => (
    <ul className="m-0 list-none p-0">
      {perks.map((perk) => {
        const meta = next ? null : perkMeta(perk);
        const status = next ? null : perkStatus(perk);
        return (
          <li
            key={`${perk.code}-${perk.period ?? ""}`}
            className="border-border grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-[0.6875rem] not-first:border-t md:grid-cols-[2rem_minmax(0,1fr)_auto]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-8 place-items-center rounded-lg",
                next ? "border-border text-subtle border border-dashed" : "bg-bg-subtle text-muted",
              )}
            >
              <Icon name={PERK_ICON[perk.code]} size={16} />
            </span>
            <div className="min-w-0">
              <p className={cn("text-[0.90625rem] leading-snug font-medium", next && "text-muted")}>
                {t(`codes.${perk.code}.title`)}
              </p>
              {meta ? <p className="text-muted text-[0.78125rem] tabular-nums">{meta}</p> : null}
            </div>
            {status ? <div className="col-start-2 md:col-start-3 md:text-end">{status}</div> : null}
          </li>
        );
      })}
    </ul>
  );

  const progress =
    loyalty.nextTier && points.nextTierMinSpend12m
      ? t("progress", {
          spend: format.thb(points.spend12m),
          needed: format.thb(points.nextTierMinSpend12m),
          tier: tTier(loyalty.nextTier),
        })
      : null;

  return (
    <section
      aria-labelledby="tier-perks"
      className={cn(
        "border-border bg-surface rounded-panel grid border md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
        className,
      )}
    >
      <div className="px-4 py-[1.125rem] md:px-[1.375rem] md:py-5">
        {/* The tier name is the panel's figure and its heading; "ระดับสมาชิก" is said to screen readers only. */}
        <h2 id="tier-perks" className="flex items-baseline gap-2.5">
          <span className="sr-only">{t("label")} </span>
          <span className="text-[1.75rem] leading-tight font-semibold tracking-[-0.015em]">{tier}</span>
          <span className="text-muted text-sm tabular-nums">
            {t("multiplier", { value: shortMultiplier(points.multiplier) })}
          </span>
        </h2>
        {progress ? (
          <>
            <Meter
              className="mt-3.5"
              value={Number(points.nextTierProgressPct)}
              label={t("progressLabel", { tier: tTier(loyalty.nextTier!) })}
              valueText={progress}
            />
            <p className="text-muted mt-1.5 text-[0.84375rem] tabular-nums">{progress}</p>
          </>
        ) : (
          <p className="text-muted mt-1.5 text-[0.84375rem] tabular-nums">
            {t("top", { spend: format.thb(points.spend12m) })}
          </p>
        )}
        <p className="text-subtle mt-0.5 text-[0.78125rem]">{pick(locale, points.spendBasisTh, points.spendBasisEn)}</p>
        {/[1-9]/.test(points.spendNotYetCounted) ? (
          <p className="text-subtle mt-0.5 text-[0.78125rem]">
            {t("notYetCounted", { amount: format.thb(points.spendNotYetCounted) })}
          </p>
        ) : null}

        {loyalty.activeMultipliers.length > 0 ? (
          <div className="border-border mt-5 border-t pt-4">
            <h3 className="text-[0.8125rem] font-semibold">{t("multipliersTitle")}</h3>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
              {loyalty.activeMultipliers.map((item, at) => (
                <li key={`${item.source}-${at}`} className="flex items-baseline gap-2.5 text-sm">
                  <span
                    className={cn(
                      "inline-flex h-[1.375rem] min-w-[2.875rem] shrink-0 items-center justify-center rounded-md text-[0.78125rem] font-semibold tabular-nums",
                      item.source === "tier"
                        ? "bg-primary text-primary-fg"
                        : "bg-primary-subtle text-primary-subtle-fg",
                    )}
                  >
                    ×{shortMultiplier(item.multiplier)}
                  </span>
                  <span className="min-w-0">
                    {multiplierName(item)}
                    {until(item) ? <span className="text-muted text-[0.8125rem]"> · {until(item)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-subtle mt-2.5 text-[0.78125rem]">
              {t("cap", { value: shortMultiplier(loyalty.maxCombinedMultiplier) })}
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-border border-t px-4 py-[1.125rem] md:border-s md:border-t-0 md:px-[1.375rem] md:py-5">
        <h3 className="text-[0.9375rem] font-semibold">{t("title")}</h3>
        {loyalty.perks.length > 0 ? (
          <div className="mt-1.5">{perkRows(loyalty.perks, false)}</div>
        ) : (
          <p className="text-muted mt-1.5 text-[0.84375rem]">{t("none")}</p>
        )}
        {loyalty.nextTier && loyalty.nextTierPerks.length > 0 ? (
          <>
            <h3 className="text-muted mt-[1.125rem] text-[0.8125rem] font-semibold">
              {t("nextTitle", { tier: tTier(loyalty.nextTier) })}
            </h3>
            <div className="mt-0.5">{perkRows(loyalty.nextTierPerks, true)}</div>
          </>
        ) : null}
      </div>
    </section>
  );
}
