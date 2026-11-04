"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { ReorderBonusBadge } from "@/features/customer/loyalty/ReorderBonusBadge";
import { unitLabel } from "@/features/customer/catalog/unit-label";
import { formatDate, formatNumber } from "@/i18n/format";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * A replenishment suggestion (U2.F5, D-288): when the customer will need this product again and how
 * many, with the reasoning the API gives — how often they order, the last lead time, the last
 * order — a one-click reorder of that order, and "not now" (dismiss). Every date and figure is the API's.
 */
export function SuggestionCard({ suggestion }: { suggestion: Schemas["StoreReorderSuggestionDto"] }) {
  const t = useTranslations("account.replenishment");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { lastOrder } = suggestion;
  // Loyalty P2 (D-492): when it should run out, and the ×1.5 reorder campaign while one is open.
  const { predictedStockOutOn, bonus } = suggestion;

  const dismiss = async () => {
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/reorder-suggestions/{suggestionId}/actions/dismiss", {
        params: { path: { suggestionId: suggestion.id }, header: { "Idempotency-Key": newIdempotencyKey() } },
      });
      toast.success(t("dismissed"));
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  };

  return (
    <li className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="font-semibold">{pick(locale, suggestion.productType.nameTh, suggestion.productType.nameEn)}</p>
        <p className="text-sm">
          {t("suggest", {
            date: formatDate(suggestion.suggestedOn, locale),
            quantity: formatNumber(suggestion.suggestedQuantity, locale),
            unit: unitLabel(tCatalog, lastOrder.unit),
          })}
        </p>
      </div>
      {predictedStockOutOn ? (
        <p className="text-sm">
          <span className="text-muted">{t("stockOut")}</span>{" "}
          <span className="font-semibold tabular-nums">
            {t("stockOutOn", { date: formatDate(predictedStockOutOn, locale) })}
          </span>
        </p>
      ) : null}
      {bonus ? <ReorderBonusBadge multiplier={bonus.multiplier} endsAt={bonus.endsAt} /> : null}
      <ul className="text-muted flex flex-col gap-0.5 text-xs">
        <li>{t("why.interval", { days: suggestion.averageIntervalDays, count: suggestion.orderCount })}</li>
        <li>{t("why.need", { date: formatDate(suggestion.nextNeedOn, locale) })}</li>
        <li>{t("why.lead", { days: suggestion.lastLeadTimeDays })}</li>
        <li>{t("why.last", { code: lastOrder.orderCode, quantity: formatNumber(lastOrder.quantity, locale) })}</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        {/* The filled button only while a campaign makes reordering now worth more. */}
        <Button asChild size="sm" variant={bonus ? "primary" : "secondary"}>
          <Link href={`/account/orders/${lastOrder.orderId}/reorder`}>{t("reorder")}</Link>
        </Button>
        <Button size="sm" variant="ghost" loading={busy} onClick={() => void dismiss()}>
          {t("dismiss")}
        </Button>
      </div>
    </li>
  );
}
