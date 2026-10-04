"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { toast } from "@/ui/components/Toast";

import { buildConfiguration } from "./build";
import { TARGET, type Configurator, type ConfiguratorState } from "./state";
import { shareOrCopy } from "./useQuoteActions";

export type Draft = Schemas["ConfigurationDraftDto"];

/**
 * The configuration as a draft holds it: what the customer has answered so far, nothing invented
 * for the rest — an id not chosen yet, a size not entered or an empty list is left out, so the
 * API's completeness names it as missing (D-185).
 */
export function draftConfiguration(configurator: Configurator, state: ConfiguratorState): Record<string, unknown> {
  const prune = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const items = value.map(prune).filter((item) => item !== undefined);
      return items.length > 0 ? items : undefined;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, prune(item)] as const)
        .filter(([, item]) => item !== undefined);
      return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    }
    if (value === "" || value === 0 || value === null) return undefined;
    return value;
  };
  return (prune(buildConfiguration(configurator, state)) as Record<string, unknown> | undefined) ?? {};
}

/**
 * Save the configuration as a draft, come back to it, share it by link (U2.F1 §5, D-185): kept
 * 90 days after its last change, a link valid 15 days and replaced by the next one. A draft is a
 * signed-in customer's (U2.1 assumption 6), so a guest signs in first.
 */
export function useDraft({
  configurator,
  state,
  title,
  signedIn,
  requestSignIn,
  initial,
}: {
  configurator: Configurator;
  state: ConfiguratorState;
  title: string;
  signedIn: boolean;
  requestSignIn: (then: () => void) => void;
  /** The draft this visit resumed, when it did. */
  initial: Draft | null;
}) {
  const t = useTranslations("configurator.draft");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  async function persist(): Promise<Draft> {
    const configuration = draftConfiguration(configurator, state);
    const target = TARGET.test(state.target) ? state.target : null;
    const api = browserApi();
    const { data } = draft
      ? await api.PATCH("/v1/store/configurations/{draftId}", {
          params: { path: { draftId: draft.id } },
          body: { configuration, title, targetPricePerUnit: target },
        })
      : await api.POST("/v1/store/configurations", {
          body: {
            productTypeCode: configurator.productTypeCode,
            catalogProductId: configurator.catalogProductId,
            configuration,
            title,
            ...(target ? { targetPricePerUnit: target } : {}),
          },
        });
    setDraft(data!);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "configurations") });
    return data!;
  }

  async function execute(action: "save" | "share") {
    setBusy(action);
    try {
      const saved = await persist();
      if (action === "save") {
        toast.success(t("saved", { date: format.date(saved.expiresAt) }));
        return;
      }
      const { data: share } = await browserApi().POST("/v1/store/configurations/{draftId}/actions/share", {
        params: { path: { draftId: saved.id } },
      });
      const url = `${window.location.origin}${window.location.pathname}?config=${encodeURIComponent(share!.shareToken)}`;
      await shareOrCopy(url, title, t("linkCopied"), t("linkValidUntil", { date: format.date(share!.expiresAt) }));
    } catch (error) {
      toast.error(
        isApiError(error) && error.status === 409 ? t("converted") : t("failed"),
        isApiError(error) ? { description: error.detail } : undefined,
      );
    } finally {
      setBusy(null);
    }
  }

  function run(action: "save" | "share") {
    if (!signedIn) requestSignIn(() => void execute(action));
    else void execute(action);
  }

  return { draft, busy, run };
}
