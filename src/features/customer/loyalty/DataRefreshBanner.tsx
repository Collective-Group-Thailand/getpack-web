"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { DataRefresh } from "@/features/shared/loyalty-p2/types";
import { Icon } from "@/ui/icons";

/**
 * The yearly data confirmation (loyalty P2, D-490) on `/account`: shown only when the API says it is `due` again after
 * an earlier confirmation — the first one is a task of the earn checklist, not a banner. Same family as the earn and
 * win-back banners; the reward is the API's `rewardPoints` (no reward line at 0).
 */
export function DataRefreshBanner({ refresh }: { refresh: DataRefresh | null }) {
  const t = useTranslations("account.confirmData.banner");
  const format = useFormat();
  if (!refresh?.due || !refresh.lastConfirmedAt) return null;
  return (
    <Link
      href="/account/confirm-data"
      className="border-border bg-surface hover:border-primary focus-visible:ring-focus-ring rounded-panel grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3.5 border p-3.5 outline-none focus-visible:ring-2 md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:py-3.5 md:ps-4 md:pe-2"
    >
      <span
        aria-hidden="true"
        className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-9 place-items-center md:size-10"
      >
        <Icon name="file-check" size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold">{t("title")}</span>
        <span className="text-muted block text-[0.84375rem]">
          {refresh.rewardPoints > 0
            ? t("bodyReward", {
                date: format.date(refresh.lastConfirmedAt),
                points: format.number(refresh.rewardPoints),
              })
            : t("body", { date: format.date(refresh.lastConfirmedAt) })}
        </span>
      </span>
      <span className="text-primary inline-flex items-center gap-0.5 text-sm font-medium max-md:col-start-2 max-md:pt-1">
        {t("action")}
        <Icon name="chevron-right" size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}
