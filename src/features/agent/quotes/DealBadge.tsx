import { getFormat } from "@/features/shared/format/server";
import { getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Deal = Schemas["AgentDealRegistrationDto"];

/**
 * "ดีลนี้ถูกจองแล้วถึง …" (D-468 §4): a registered deal's protection date and the rates locked for it — protection
 * and a rate lock, never a cut. Shown on the lead and on the quote; nothing for an ended registration.
 */
export async function DealBadge({ deal, className }: { deal: Deal | null | undefined; className?: string }) {
  if (!deal || (deal.status !== "registered" && deal.status !== "won")) return null;
  const [t, format] = await Promise.all([getTranslations("agentSales.deal"), getFormat()]);
  return (
    <p
      className={cn(
        "border-success/25 bg-success-subtle text-success-subtle-fg inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-sm",
        className,
      )}
      data-testid="deal-badge"
    >
      <Icon name="shield-check" size={16} aria-hidden="true" />
      <span className="font-semibold">{t("until", { date: format.date(deal.protectedUntil) })}</span>
      <span>{t("locked", { first: format.percent(deal.lockedFirstRatePct), repeat: format.percent(deal.lockedRepeatRatePct) })}</span>
    </p>
  );
}
