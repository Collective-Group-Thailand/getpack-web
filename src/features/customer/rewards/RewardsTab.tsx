"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { RewardList } from "@/lib/api/requests/store-loyalty-p3";
import { Button } from "@/ui/components/Button";

import { redeemHref } from "./model";
import { RewardCard } from "./RewardCard";

/**
 * `/deals?tab=points` (loyalty P3; prototype `p3-deals-points.html`): the reward catalogue in the deal family — tickets
 * in a grid from 768 px, compact rows below. Signed in: one line with the balance, and each "แลก" goes to the redeem
 * page (`#<code>` opens that reward's confirm sheet there; the sheet lives on one page only). A guest sees the costs
 * and conditions under one sign-in card and no action on the tickets. Never an empty state while items exist.
 */
export function RewardsTab({ list, signedIn }: { list: RewardList; signedIn: boolean }) {
  const t = useTranslations("deals.points");
  const format = useFormat();
  // One validity for the whole catalogue goes in the line above; items that differ say so in the confirm sheet.
  const validity = new Set(list.items.map((item) => item.validityDays));
  const sharedDays = validity.size === 1 ? [...validity][0]! : null;
  const card = (variant: "card" | "row") =>
    list.items.map((item) => (
      <li key={item.id} className={variant === "card" ? "flex" : undefined}>
        <RewardCard
          item={item}
          variant={variant}
          href={redeemHref(item.code)}
          showAction={signedIn}
          headingLevel="h2"
        />
      </li>
    ));

  return (
    <div className="mt-4 md:mt-[1.125rem]">
      {signedIn ? (
        <div className="mb-4 flex flex-col gap-0.5 text-[0.90625rem] md:mb-[1.125rem] md:flex-row md:items-center md:justify-between md:gap-3">
          <p>
            {t.rich("balance", {
              points: format.number(list.balance ?? 0),
              b: (chunk) => <b className="font-semibold tabular-nums">{chunk}</b>,
            })}
            {sharedDays ? <span className="text-muted"> · {t("validity", { days: sharedDays })}</span> : null}
          </p>
          <Link
            href="/account/points/redeem#mine"
            className="text-primary text-sm font-medium underline decoration-1 underline-offset-4"
          >
            {t("mine")}
          </Link>
        </div>
      ) : (
        <section
          aria-labelledby="points-sign-in"
          className="border-border bg-surface rounded-card mb-4 grid items-center gap-4 border px-5 py-[1.125rem] md:mb-[1.125rem] md:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div>
            <h2 id="points-sign-in" className="text-base font-semibold">
              {t("signInTitle")}
            </h2>
            <p className="text-muted mt-0.5 text-sm">{t("signInBody")}</p>
          </div>
          <Button asChild>
            <Link href="/sign-in?next=/deals?tab=points">{t("signIn")}</Link>
          </Button>
        </section>
      )}
      <ul
        aria-label={t("list")}
        className="m-0 hidden list-none grid-cols-2 gap-4 p-0 md:grid lg:grid-cols-3 xl:grid-cols-4"
      >
        {card("card")}
      </ul>
      <ul
        aria-label={t("list")}
        className="border-border bg-surface rounded-card divide-border m-0 list-none divide-y overflow-hidden border p-0 md:hidden"
      >
        {card("row")}
      </ul>
    </div>
  );
}
