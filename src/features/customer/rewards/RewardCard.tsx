"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { LoyaltyTierP3, RewardItem } from "@/lib/api/requests/store-loyalty-p3";
import { Button } from "@/ui/components/Button";
import { Ticket } from "@/ui/components/Ticket";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { BLOCKED_ICON, blockedReasonOf } from "./model";

export interface RewardCardProps {
  item: RewardItem;
  /** `card`: a vertical ticket for grids · `row`: a compact row with the 64 px stub (phone). */
  variant?: "card" | "row";
  /** Opens the confirm sheet (the redeem page). */
  onRedeem?: (item: RewardItem) => void;
  /** Where "แลก" goes instead (the /deals tab links to the redeem page). */
  href?: string;
  /** False: the action is not offered at all (a guest on /deals sees costs only). */
  showAction?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
}

/**
 * A reward as a coupon ticket (loyalty P3, D-486; prototype `p3-redeem.html`). The stub is the price — the points
 * cost, the page's figure — on `primary-subtle`; the body is the reward: its name and its conditions, then either
 * the outline "แลก" (grid rule: never a filled button in a grid) or the reason it cannot be redeemed, as a muted line
 * with an icon — never both. A blocked ticket's stub turns neutral. Every word is the API's or `messages/*`.
 */
export function RewardCard({
  item,
  variant = "card",
  onRedeem,
  href,
  showAction = true,
  headingLevel = "h3",
  className,
}: RewardCardProps) {
  const t = useTranslations("account.rewards");
  const tTier = useTranslations("account.home.tiers");
  const format = useFormat();
  const blocked = blockedReasonOf(item);
  const Heading = headingLevel;
  const cost = format.number(item.costPoints);
  const conditions = item.conditions.join(" · ");
  const tierName = (tier: LoyaltyTierP3) => tTier(tier);

  const reason = blocked ? (
    <p className="text-muted m-0 flex items-start gap-1.5 text-[0.8125rem] leading-snug">
      <Icon name={BLOCKED_ICON[blocked]} size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>
        {t(`blocked.${blocked}`, {
          missing: format.number(item.missingPoints),
          tier: item.tierRequired ? tierName(item.tierRequired) : "",
          date: item.nextAvailableAt ? format.date(item.nextAvailableAt) : "",
        })}
      </span>
    </p>
  ) : null;

  const action =
    blocked || !showAction ? null : onRedeem ? (
      <Button
        variant="secondary"
        className={variant === "row" ? "h-11 min-w-16" : "min-w-21"}
        aria-label={t("redeemNamed", { name: item.name, points: cost })}
        onClick={() => onRedeem(item)}
      >
        {t("redeem")}
      </Button>
    ) : href ? (
      <Button asChild variant="secondary" className={variant === "row" ? "h-11 min-w-16" : "min-w-21"}>
        <Link href={href} aria-label={t("redeemNamed", { name: item.name, points: cost })}>
          {t("redeem")}
        </Link>
      </Button>
    ) : null;

  const tierTag = item.tierRequired ? (
    <span className="bg-surface text-primary-subtle-fg inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[0.71875rem] font-semibold">
      <Icon name="lock" size={12} aria-hidden="true" />
      {t("tierTag", { tier: tierName(item.tierRequired) })}
    </span>
  ) : null;

  if (variant === "row")
    return (
      <article
        aria-label={t("label", { name: item.name, points: cost })}
        data-reward={item.code}
        className={cn("grid min-h-20 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3.5 px-3.5 py-3", className)}
      >
        <RewardStub value={cost} unit={t("unit")} spent={blocked !== null} />
        <div className="min-w-0">
          <Heading className="m-0 truncate text-[0.9375rem] leading-snug font-semibold">{item.name}</Heading>
          <div className="text-muted mt-0.5 flex flex-col text-[0.8125rem] leading-snug">
            {conditions ? <span className="truncate">{conditions}</span> : null}
            {blocked ? (
              <span>
                {t(`blocked.${blocked}`, {
                  missing: format.number(item.missingPoints),
                  tier: item.tierRequired ? tierName(item.tierRequired) : "",
                  date: item.nextAvailableAt ? format.date(item.nextAvailableAt) : "",
                })}
              </span>
            ) : null}
          </div>
        </div>
        <div>{action}</div>
      </article>
    );

  return (
    <article
      aria-label={t("label", { name: item.name, points: cost })}
      data-reward={item.code}
      className={cn("flex min-w-0", className)}
    >
      <Ticket
        className="flex-1"
        tone={blocked ? "spent" : "normal"}
        stubSize={76}
        stubClassName={cn("flex items-center justify-between gap-2 px-[1.125rem]", blocked && "text-neutral-subtle-fg")}
        bodyClassName="min-h-32 gap-[3px] px-[1.125rem] pt-3.5 pb-4"
        stub={
          <>
            <span className="mt-0.5 flex items-baseline gap-2 leading-none tabular-nums">
              <span className="text-[2.5rem] font-semibold tracking-[-0.035em]">{cost}</span>
              <span className="text-sm font-medium">{t("unit")}</span>
            </span>
            {tierTag}
          </>
        }
      >
        <Heading className="m-0 text-base leading-snug font-semibold text-pretty">{item.name}</Heading>
        {conditions ? <p className="text-muted m-0 text-[0.84375rem] leading-normal">{conditions}</p> : null}
        <div className="mt-auto flex min-h-[3.375rem] items-center justify-between gap-3 pt-3.5">
          {reason ?? <span />}
          {action}
        </div>
      </Ticket>
    </article>
  );
}

/** The 64 px stub of a reward row or coupon: a figure over its unit, one notch on the far edge. */
export function RewardStub({
  value,
  unit,
  spent = false,
  word = false,
}: {
  value: string;
  unit?: string;
  spent?: boolean;
  /** A word instead of a figure ("ส่งฟรี"): smaller, no unit. */
  word?: boolean;
}) {
  return (
    <Ticket
      aria-hidden="true"
      orientation="horizontal"
      notch="end"
      notchRadius={6}
      shape="control"
      tone={spent ? "spent" : "normal"}
      className="h-14 w-16"
      stubClassName={cn(
        "flex flex-col items-center justify-center gap-px pe-1 text-center leading-none",
        spent && "text-neutral-subtle-fg",
      )}
      stub={
        <>
          <span
            className={cn(
              "font-semibold tracking-[-0.02em] tabular-nums",
              word ? "text-[0.875rem] tracking-normal" : "text-[1.1875rem]",
            )}
          >
            {value}
          </span>
          {unit && !word ? <span className="text-[0.65625rem] font-medium">{unit}</span> : null}
        </>
      }
    />
  );
}
