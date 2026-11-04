"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { BonusLot } from "@/lib/api/requests/store-loyalty-p2";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * Bonus points waiting (loyalty P2, D-493; prototype `p2-lifecycle.html`): "มี 40 แต้มโบนัสรอคุณอยู่ · ใช้เป็นส่วนลด
 * ได้ถึง 4 ธ.ค." with a way to the deals. Same family as the earn banner. The words never mention absence or
 * inactivity — the lot's reason is not shown. The soonest-expiring win-back lot leads; nothing renders without one.
 */
export function WinbackBanner({
  lots,
  variant = "account",
  className,
}: {
  lots: readonly BonusLot[];
  variant?: "account" | "liff";
  className?: string;
}) {
  const t = useTranslations("account.lifecycle");
  const format = useFormat();
  const lot = [...lots]
    .filter((entry) => entry.reason === "winback")
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
  if (!lot) return null;
  const liff = variant === "liff";
  return (
    <Link
      href={liff ? "/liff/deals" : "/deals"}
      className={cn(
        "border-border bg-surface hover:border-primary focus-visible:ring-focus-ring grid items-center gap-x-3.5 border outline-none focus-visible:ring-2",
        liff
          ? "rounded-card grid-cols-[2.25rem_minmax(0,1fr)_auto] py-3 ps-3 pe-2"
          : "rounded-panel grid-cols-[2.25rem_minmax(0,1fr)] p-3.5 md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:py-3.5 md:ps-4 md:pe-2",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-primary-subtle text-primary-subtle-fg grid size-9 place-items-center rounded-[0.625rem] md:size-10"
      >
        <Icon name="gift" size={liff ? 18 : 20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold">
          {t(liff ? "winbackShort" : "winbackTitle", { points: format.number(lot.points) })}
        </span>
        <span className="text-muted block text-[0.84375rem]">
          {t(liff ? "winbackUntilShort" : "winbackUntil", { date: format.date(lot.expiresAt) })}
        </span>
      </span>
      <span
        className={cn(
          "text-primary inline-flex items-center gap-0.5 text-sm font-medium",
          !liff && "max-md:col-start-2 max-md:pt-1",
        )}
      >
        {t(liff ? "winbackActionShort" : "winbackAction")}
        <Icon name="chevron-right" size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}
