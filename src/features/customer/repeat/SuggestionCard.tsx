"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
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
export function SuggestionCard({ suggestion }: { suggestion: Schemas["ReorderSuggestionDto"] }) {
  const t = useTranslations("account.replenishment");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { lastOrder } = suggestion;

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
    <li className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="font-semibold">{pick(locale, suggestion.productType.nameTh, suggestion.productType.nameEn)}</p>
        <p className="text-sm">
          {t("suggest", {
            date: formatDate(suggestion.suggestedOn, locale),
            quantity: formatNumber(suggestion.suggestedQuantity, locale),
            unit: lastOrder.unit,
          })}
        </p>
      </div>
      <ul className="text-muted flex flex-col gap-0.5 text-xs">
        <li>{t("why.interval", { days: suggestion.averageIntervalDays, count: suggestion.orderCount })}</li>
        <li>{t("why.need", { date: formatDate(suggestion.nextNeedOn, locale) })}</li>
        <li>{t("why.lead", { days: suggestion.lastLeadTimeDays })}</li>
        <li>{t("why.last", { code: lastOrder.orderCode, quantity: formatNumber(lastOrder.quantity, locale) })}</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={`/account/orders/${lastOrder.orderId}/reorder`}>{t("reorder")}</Link>
        </Button>
        <Button size="sm" variant="ghost" loading={busy} onClick={() => void dismiss()}>
          {t("dismiss")}
        </Button>
      </div>
    </li>
  );
}
