"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { LoyaltyTasks } from "@/lib/api/requests/store-loyalty";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * The account home's one-line nudge (loyalty P1): "รับแต้มเพิ่ม X แต้ม" → the checklist on `/account/points#earn`.
 * Hidden when nothing is left to earn (all done, or the 12-month activity cap used up — `remainingPoints` is 0).
 */
export function EarnBanner({ tasks, className }: { tasks: LoyaltyTasks | null | undefined; className?: string }) {
  const t = useTranslations("account");
  const format = useFormat();
  if (!tasks || tasks.remainingPoints <= 0) return null;
  const next = tasks.tasks.find((task) => task.recommended && task.status === "todo");
  return (
    <Link
      href="/account/points#earn"
      className={cn(
        "border-border bg-surface hover:border-primary focus-visible:ring-focus-ring rounded-panel flex min-h-14 items-center gap-3.5 border px-4 py-3 outline-none focus-visible:ring-2 sm:px-4.5",
        className,
      )}
    >
      <span className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-8 shrink-0 place-items-center">
        <Icon name="star" size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-[0.90625rem]">
        <span className="font-semibold tabular-nums">
          {t("home.earnBanner", { points: format.number(tasks.remainingPoints) })}
        </span>
        {next ? (
          <span className="text-muted hidden sm:inline">
            {" · "}
            {t("home.earnBannerNext", { task: t(`points.tasks.${next.code}.title`) })}
          </span>
        ) : null}
      </span>
      <Icon name="chevron-right" size={16} aria-hidden="true" className="text-subtle shrink-0" />
    </Link>
  );
}
