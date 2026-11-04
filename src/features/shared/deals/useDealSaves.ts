"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { isApiError } from "@/lib/api/problem";
import { browserApi } from "@/lib/api/browser";
import { toast } from "@/ui/components/Toast";

import type { DealState } from "./model";
import type { Deal } from "./types";

/**
 * "เก็บโค้ด" (`store.promotions.save`): the deal turns "เก็บแล้ว" on success — and on a 409
 * `promotions.already_saved`, which means the wallet already holds it ("เก็บไว้แล้ว"). A 409
 * `promotions.not_saveable` says so in a toast; anything else is the generic failure. The card keeps its button.
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
        await browserApi().POST("/v1/store/promotions/{promotionId}/actions/save", {
          params: { path: { promotionId: deal.id } },
        });
        mark();
        toast.success(t("savedToast", { code: deal.code ?? "" }));
      } catch (error) {
        if (isApiError(error) && error.code === "promotions.already_saved") {
          mark();
          toast.info(t("alreadySaved"));
        } else if (isApiError(error) && error.code === "promotions.not_saveable") toast.error(t("notSaveable"));
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
