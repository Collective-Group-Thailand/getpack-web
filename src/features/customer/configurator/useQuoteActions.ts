"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { queryKeys } from "@/lib/api/query-keys";
import { toast } from "@/ui/components/Toast";

import { quantityBand } from "../analytics/bands";
import { buildConfiguration } from "./build";
import { POSTCODE, type Configurator, type ConfiguratorState } from "./state";

export type SavedQuote = ResponseOf<Requests, "POST /v1/store/quotes">;
export type QuoteAction = "cart" | "save" | "share" | "pdf";

/**
 * What the dock's buttons do. Each needs a kept quotation (D-051), so the first action saves one
 * and the rest reuse it while the configuration is unchanged; a saved quote is a customer's, so a
 * guest is asked to sign in first and the action they chose continues afterwards — their
 * configuration is still on the page.
 */
export function useQuoteActions({
  configurator,
  state,
  signedIn,
  requestSignIn,
}: {
  configurator: Configurator;
  state: ConfiguratorState;
  signedIn: boolean;
  /** Opens the sign-in sheet; `then` runs once a session exists. */
  requestSignIn: (then: () => void) => void;
}) {
  const t = useTranslations("configurator.actions");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const saved = useRef(new Map<string, SavedQuote>());
  const [busy, setBusy] = useState<QuoteAction | null>(null);
  const [lastQuote, setLastQuote] = useState<SavedQuote | null>(null);

  const body = {
    productTypeCode: configurator.productTypeCode,
    catalogProductSlug: configurator.slug,
    configuration: buildConfiguration(configurator, state) as unknown as Record<string, unknown>,
    quantity: state.quantity,
    ...(POSTCODE.test(state.postcode) ? { deliveryPostcode: state.postcode } : {}),
    designOption: state.designOption,
    mockupOption: state.mockupOption,
    ...(state.promoCode.trim() ? { promoCode: state.promoCode.trim() } : {}),
  };
  const key = JSON.stringify(body);

  async function quote(): Promise<SavedQuote> {
    const known = saved.current.get(key);
    if (known) return known;
    const created = await browserRequests().call("POST /v1/store/quotes", { body });
    saved.current.set(key, created);
    setLastQuote(created);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "quotes") });
    return created;
  }

  async function execute(action: QuoteAction) {
    setBusy(action);
    try {
      const created = await quote();
      if (action === "cart") {
        await browserRequests().call("POST /v1/store/cart/items", { body: { quoteId: created.id } });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
        track("cart_item_added", {
          route: "/configure/[slug]",
          productType: configurator.productTypeCode,
          quantityBand: quantityBand(created.quantity),
          quoteMode: "instant",
        });
        toast.success(t("addedToCart", { name: created.product.name }), {
          action: { label: t("viewCart"), onClick: () => router.push("/cart") },
        });
      } else if (action === "save") {
        toast.success(t("saved", { code: created.quoteCode, date: format.date(created.validUntil) }), {
          action: { label: t("viewQuotes"), onClick: () => router.push("/account/quotes") },
        });
      } else if (action === "share") {
        const share = await browserRequests().call("POST /v1/store/quotes/{quoteId}/actions/share", {
          path: { quoteId: created.id },
        });
        const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(share.token)}`;
        if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
          await navigator.share({ title: created.product.name, url }).catch(() => undefined);
        } else {
          await navigator.clipboard?.writeText(url).catch(() => undefined);
          toast.success(t("linkCopied"), { description: url });
        }
      } else {
        const pdf = await browserRequests().call("POST /v1/store/quotes/{quoteId}/actions/export-pdf", {
          path: { quoteId: created.id },
        });
        // Opened from the toast's button: a new tab opened after an await is a pop-up to a
        // browser, and blocked; a click is the customer's own.
        toast.success(t("pdfReady", { code: created.quoteCode }), {
          action: { label: t("openPdf"), onClick: () => window.open(pdf.url, "_blank", "noopener") },
        });
      }
    } catch (error) {
      toast.error(
        isApiError(error) && error.status === 409 ? t("noInstantPrice") : t("failed"),
        isApiError(error) ? { description: error.detail } : undefined,
      );
    } finally {
      setBusy(null);
    }
  }

  function run(action: QuoteAction) {
    if (!signedIn) requestSignIn(() => void execute(action));
    else void execute(action);
  }

  return { run, busy, lastQuote };
}
