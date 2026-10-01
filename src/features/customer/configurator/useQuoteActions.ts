"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { toast } from "@/ui/components/Toast";

import { editCart } from "../cart/cart-client";
import { buildCalculateBody } from "./build";
import { saveQuote, type SavedQuote } from "./pricing";
import type { Configurator, ConfiguratorState } from "./state";

export type { SavedQuote } from "./pricing";
export type QuoteAction = "cart" | "save" | "share" | "pdf";

/** The kept quotation and its option for the quantity on screen. */
export interface KeptQuote {
  quote: SavedQuote;
  option: Schemas["SavedQuoteOptionDto"];
}

/** A PDF is rendered after the request is accepted (`202`); how long the dock waits for it. */
const PDF_POLL = { every: 1_000, tries: 10 } as const;

/**
 * What the dock's buttons do. Each needs a kept quotation (D-051), so the first action saves one
 * (`store.quotes.save`) and the rest reuse it while the configuration is unchanged; a saved quote
 * is a customer's, so a guest is asked to sign in first and the action they chose continues
 * afterwards — their configuration is still on the page.
 *
 * CONTRACT-GAP store.quotes — the published quotation has no product name or specs, no promotion
 * (codes are applied to the cart) and no code until it is shared or its PDF requested; the dock
 * names the product from the page and leaves out what the quote no longer says.
 */
export function useQuoteActions({
  configurator,
  state,
  productName,
  signedIn,
  requestSignIn,
}: {
  configurator: Configurator;
  state: ConfiguratorState;
  productName: string;
  signedIn: boolean;
  /** Opens the sign-in sheet; `then` runs once a session exists. */
  requestSignIn: (then: () => void) => void;
}) {
  const t = useTranslations("configurator.actions");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const saved = useRef(new Map<string, KeptQuote>());
  const [busy, setBusy] = useState<QuoteAction | null>(null);
  const [lastQuote, setLastQuote] = useState<KeptQuote | null>(null);

  const calculation = buildCalculateBody(configurator, state);
  const body = { ...calculation, configuration: { ...calculation.configuration, quantities: [state.quantity] } };
  const key = JSON.stringify(body);

  async function keep(): Promise<KeptQuote> {
    const known = saved.current.get(key);
    if (known) return known;
    const quote = await saveQuote(body);
    const option = quote.options.find((candidate) => candidate.quantity === state.quantity) ?? quote.options[0]!;
    const kept = { quote, option };
    saved.current.set(key, kept);
    setLastQuote(kept);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "quotes") });
    return kept;
  }

  /** Remembers what an action changed on the quotation (its code, once issued). */
  function update(quote: SavedQuote) {
    const current = saved.current.get(key);
    if (!current) return;
    const next = { ...current, quote };
    saved.current.set(key, next);
    setLastQuote(next);
  }

  async function pdfOf(quoteId: string): Promise<Schemas["QuotePdfDto"]> {
    const api = browserApi();
    for (let attempt = 0; attempt < PDF_POLL.tries; attempt += 1) {
      const { data } = await api.GET("/v1/store/quotes/{quoteId}/pdf", { params: { path: { quoteId } } });
      if (data!.status === "ready" && data!.url) return data!;
      await new Promise((resolve) => setTimeout(resolve, PDF_POLL.every));
    }
    throw new Error("pdf.pending");
  }

  async function execute(action: QuoteAction) {
    setBusy(action);
    try {
      const { quote, option } = await keep();
      const api = browserApi();
      if (action === "cart") {
        await editCart((ifMatch) =>
          api.POST("/v1/store/cart/items", {
            params: { header: { "If-Match": ifMatch } },
            body: {
              quoteId: quote.id,
              quoteOptionId: option.id,
              designOption: state.designOption,
              mockupOption: state.mockupOption,
            },
          }),
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
        track("cart_item_added", {
          route: "/configure/[slug]",
          productType: configurator.productTypeCode,
          quantity: option.quantity,
          quoteMode: "instant",
        });
        toast.success(t("addedToCart", { name: productName }), {
          action: { label: t("viewCart"), onClick: () => router.push("/cart") },
        });
      } else if (action === "save") {
        toast.success(
          quote.quoteCode
            ? t("saved", { code: quote.quoteCode, date: format.date(quote.validUntil) })
            : t("savedNoCode", { date: format.date(quote.validUntil) }),
          { action: { label: t("viewQuotes"), onClick: () => router.push("/account/quotes") } },
        );
      } else if (action === "share") {
        const { data: share } = await api.POST("/v1/store/quotes/{quoteId}/actions/share", {
          params: { path: { quoteId: quote.id } },
        });
        update(share!.quote);
        const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(share!.shareToken)}`;
        if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
          await navigator.share({ title: productName, url }).catch(() => undefined);
        } else {
          await navigator.clipboard?.writeText(url).catch(() => undefined);
          toast.success(t("linkCopied"), { description: url });
        }
      } else {
        const { data: requested } = await api.POST("/v1/store/quotes/{quoteId}/actions/request-pdf", {
          params: { path: { quoteId: quote.id } },
        });
        update(requested!);
        const pdf = await pdfOf(quote.id);
        // Opened from the toast's button: a new tab opened after an await is a pop-up to a
        // browser, and blocked; a click is the customer's own.
        toast.success(t("pdfReady", { code: requested!.quoteCode ?? "" }), {
          action: { label: t("openPdf"), onClick: () => window.open(pdf.url!, "_blank", "noopener") },
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message === "pdf.pending") toast.info(t("pdfPending"));
      else
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
