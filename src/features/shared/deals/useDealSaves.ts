"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Deal } from "@/lib/api/requests/store-deals";
import { toast } from "@/ui/components/Toast";

import type { DealState } from "./model";

/**
 * "เก็บโค้ด" (`store.promotions.save`): the deal turns "เก็บแล้ว" on success — and on a 409 `already_saved`, which
 * means the wallet already holds it. Anything else is a toast; the card keeps its button.
 */
export function useDealSaves() {
  const t = useTranslations("deals.card");
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const save = useCallback(
    async (deal: Deal) => {
      setPendingId(deal.id);
      const mark = () => setSaved((current) => new Set(current).add(deal.id));
      try {
        await browserRequests().call("POST /v1/store/promotions/{promotionId}/actions/save", {
          path: { promotionId: deal.id },
        });
        mark();
        toast.success(t("savedToast", { code: deal.code ?? "" }));
      } catch (error) {
        if (isApiError(error) && error.code === "promotion.already_saved") mark();
        else toast.error(t("saveFailed"));
      } finally {
        setPendingId(null);
      }
    },
    [t],
  );

  const stateOf = useCallback(
    (deal: Deal): DealState | undefined => (saved.has(deal.id) ? "saved" : undefined),
    [saved],
  );
  return { save, pendingId, stateOf };
}
