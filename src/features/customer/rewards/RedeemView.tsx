"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { browserRequests } from "@/lib/api/requests/browser";
import type { RewardItem, RewardList, RewardRedemption } from "@/lib/api/requests/store-loyalty-p3";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

import { groupRewards } from "./model";
import { MyRewardCoupons } from "./MyRewardCoupons";
import { RedeemSheet } from "./RedeemSheet";
import { RewardCard } from "./RewardCard";

export interface RedeemViewProps {
  list: RewardList;
  redemptions: readonly RewardRedemption[];
  /** The nearest lot to expire, from `store.loyalty.get`; null hides the fact. */
  expiring: { points: number; expiresAt: string } | null;
  now: number;
}

/**
 * `/account/points/redeem` below its header (loyalty P3; prototype `p3-redeem.html`): the balance strip, the catalogue
 * in its two groups (tickets in a grid from 768 px, compact rows below), "คูปองของฉัน" and how it works. A link with
 * `#<code>` (from the /deals tab) scrolls to that reward and, when it can be redeemed, opens its confirm sheet.
 */
export function RedeemView({ list: initialList, redemptions: initialRedemptions, expiring, now }: RedeemViewProps) {
  const t = useTranslations("account.rewards");
  const format = useFormat();
  const [list, setList] = useState(initialList);
  const [redemptions, setRedemptions] = useState(initialRedemptions);
  const [chosen, setChosen] = useState<RewardItem | null>(null);
  const balance = list.balance ?? 0;
  const open = redemptions.filter((row) => row.status === "issued").length;

  useEffect(() => {
    const code = decodeURIComponent(window.location.hash.slice(1));
    if (!code) return;
    const item = initialList.items.find((candidate) => candidate.code === code);
    if (!item) return;
    const target = [...document.querySelectorAll<HTMLElement>(`[data-reward="${CSS.escape(code)}"]`)].find(
      (element) => element.offsetParent !== null,
    );
    target?.scrollIntoView({ block: "center" });
    // Opening the sheet from the hash is the link's intent ("แลก" on /deals); a blocked item only scrolls.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL once, after hydration
    if (item.canRedeem) setChosen(item);
  }, [initialList]);

  const refresh = async () => {
    const [nextList, nextMine] = await Promise.all([
      browserRequests().call("GET /v1/store/rewards"),
      browserRequests().call("GET /v1/store/rewards/redemptions", { query: { perPage: 100 } }),
    ]).catch(() => [null, null] as const);
    if (nextList) setList(nextList);
    if (nextMine) setRedemptions(nextMine.data);
  };

  return (
    <>
      <section
        aria-label={t("balance.label")}
        className="border-border bg-surface rounded-panel mt-[1.375rem] grid grid-cols-2 border md:grid-cols-[1.25fr_1fr_1fr]"
      >
        <div className="border-border col-span-2 flex flex-col gap-0.5 border-b px-4 py-3.5 md:col-span-1 md:border-b-0 md:px-5 md:py-4">
          <span className="text-muted text-[0.8125rem]">{t("balance.available")}</span>
          <span className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums md:text-[1.875rem]">
            {format.number(balance)}
            <span className="text-muted ms-1.5 text-sm font-medium tracking-normal">{t("unit")}</span>
          </span>
        </div>
        <div className="border-border flex flex-col gap-0.5 px-4 py-3.5 md:border-s md:px-5 md:py-4">
          <span className="text-muted text-[0.8125rem]">{t("balance.expiring")}</span>
          {expiring ? (
            <>
              <span className="text-warning text-[0.9375rem] font-semibold tabular-nums">
                {t("points", { points: format.number(expiring.points) })}
              </span>
              <span className="text-muted text-[0.8125rem]">{format.date(expiring.expiresAt)}</span>
            </>
          ) : (
            <span className="text-[0.9375rem] font-semibold">{t("balance.none")}</span>
          )}
        </div>
        <div className="border-border flex flex-col gap-0.5 border-s px-4 py-3.5 md:px-5 md:py-4">
          <span className="text-muted text-[0.8125rem]">{t("balance.open")}</span>
          <span className="text-[0.9375rem] font-semibold tabular-nums">{t("coupons", { count: open })}</span>
          <a
            href="#mine"
            className="text-primary text-[0.84375rem] font-medium underline decoration-1 underline-offset-4"
          >
            {t("balance.seeMine")}
          </a>
        </div>
      </section>

      {list.items.length === 0 ? (
        <EmptyState className="mt-8" icon="gift" title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        groupRewards(list.items).map(({ group, items }) => (
          <section key={group} aria-labelledby={`rewards-${group}`} className="mt-7 md:mt-9">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 md:mb-3.5">
              <h2 id={`rewards-${group}`} className="text-lg font-semibold">
                {t(`groups.${group}.title`)}
              </h2>
              <span className="text-muted text-[0.84375rem]">{t(`groups.${group}.note`)}</span>
            </div>
            <ul className="m-0 hidden list-none grid-cols-2 gap-4 p-0 md:grid lg:grid-cols-3">
              {items.map((item) => (
                <li key={item.id} className="flex">
                  <RewardCard item={item} onRedeem={setChosen} />
                </li>
              ))}
            </ul>
            <ul className="border-border bg-surface rounded-card divide-border m-0 list-none divide-y overflow-hidden border p-0 md:hidden">
              {items.map((item) => (
                <li key={item.id}>
                  <RewardCard item={item} variant="row" onRedeem={setChosen} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section id="mine" aria-labelledby="rewards-mine" className="mt-10 scroll-mt-20 md:mt-11">
        <h2 id="rewards-mine" className="mb-3 text-lg font-semibold">
          {t("mine.title")}
        </h2>
        <MyRewardCoupons redemptions={redemptions} now={now} onChanged={() => void refresh()} />
      </section>

      <section
        aria-label={t("how.label")}
        className="border-border mt-10 grid gap-4 border-t pt-5 md:grid-cols-3 md:gap-6"
      >
        {(["redeem", "use", "change"] as const).map((step, at) => (
          <div key={step}>
            <span className="text-subtle text-xs font-semibold tracking-[0.04em] tabular-nums">
              {String(at + 1).padStart(2, "0")}
            </span>
            <h3 className="text-sm font-semibold">{t(`how.${step}.title`)}</h3>
            <p className="text-muted mt-1 text-[0.84375rem]">
              {step === "change" && !list.cancelWindowDays
                ? t("how.change.bodyGeneric")
                : t(`how.${step}.body`, { days: list.cancelWindowDays ?? 0 })}
            </p>
          </div>
        ))}
      </section>

      <RedeemSheet
        item={chosen}
        balance={balance}
        cancelWindowDays={list.cancelWindowDays ?? null}
        onOpenChange={(next) => (next ? null : setChosen(null))}
        onRedeemed={() => void refresh()}
      />
    </>
  );
}

/** The header's "คูปองของฉัน" link (a jump down the same page). */
export function MineLink() {
  const t = useTranslations("account.rewards");
  return (
    <Button asChild size="sm" variant="secondary" iconStart="wallet">
      <a href="#mine">{t("mine.title")}</a>
    </Button>
  );
}
