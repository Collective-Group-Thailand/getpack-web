"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { toast } from "@/ui/components/Toast";

import { announceCartAdd } from "../cart/cart-events";
import { editCart } from "../cart/cart-client";
import { addGuestLine } from "../cart/guest-cart";
import { buildCalculateBody } from "./build";
import { saveQuote, type SavedQuote } from "./pricing";
import type { Configurator, ConfiguratorState } from "./state";

export type { SavedQuote } from "./pricing";
export type QuoteAction = "cart" | "save" | "share" | "pdf" | "levers" | "sample" | "sendToCs";
export type Lever = Schemas["QuoteLeverDto"];

/** The kept quotation and its option for the quantity on screen. */
export interface KeptQuote {
  quote: SavedQuote;
  option: Schemas["SavedQuoteOptionDto"];
}

/** A PDF is rendered after the request is accepted (`202`); how long the dock waits for it. */
const PDF_POLL = { every: 1_000, tries: 10 } as const;

/**
 * What the dock's buttons do. Each needs a kept quotation (D-051), so the first action saves one
 * (`store.quotes.save`, with the target and the advisor's recommendation when a board was taken
 * from it) and the rest reuse it while the configuration is unchanged; a saved quote is a
 * customer's, so a guest is asked to sign in first and the action they chose continues afterwards
 * — their configuration is still on the page.
 *
 * Above a target (U2.F1 §4, D-248–D-251): the kept quotation's levers — re-priced by the real
 * engine — and "คุยกับทีมขาย", which turns it into a pre-filled RFQ.
 */
export function useQuoteActions({
  configurator,
  state,
  productName,
  signedIn,
  requestSignIn,
  anonymousId,
  onLeverApplied,
  guest,
}: {
  configurator: Configurator;
  state: ConfiguratorState;
  productName: string;
  signedIn: boolean;
  /** Opens the sign-in sheet; `then` runs once a session exists. */
  requestSignIn: (then: () => void) => void;
  /** The advisor's id for this visit (`useAdvisor`), so the recommendation can be named on save. */
  anonymousId: string;
  /** A lever was taken: the new quotation, for the configurator to start from. */
  onLeverApplied: (quote: SavedQuote) => void;
  /** What a guest's cart line shows (UX audit Flow 1, bug #3); absent → a guest signs in to add. */
  guest?: { slug: string; unit: string; specs: string[]; grossAmount: string | null };
}) {
  const t = useTranslations("configurator.actions");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  /** Quotations kept this visit, by the configuration they were kept for. */
  const [saved, setSaved] = useState<ReadonlyMap<string, KeptQuote>>(() => new Map());
  const remember = (forKey: string, kept: KeptQuote | null) =>
    setSaved((previous) => {
      const next = new Map(previous);
      if (kept) next.set(forKey, kept);
      else next.delete(forKey);
      return next;
    });
  const [busy, setBusy] = useState<QuoteAction | null>(null);
  const [lastQuote, setLastQuote] = useState<KeptQuote | null>(null);
  const [leversFor, setLeversFor] = useState<string | null>(null);
  /** The kept quotation a sample is being asked for (D-253), from the dock (T5). */
  const [sampleFor, setSampleFor] = useState<string | null>(null);

  const calculation = buildCalculateBody(configurator, state);
  const advisory = state.advisory && state.choices.material?.[0] === state.advisory.boardId ? state.advisory : null;
  const body = {
    ...calculation,
    configuration: { ...calculation.configuration, quantities: [state.quantity] },
    ...(advisory ? { advisoryRecommendationId: advisory.recommendationId, anonymousId } : {}),
  };
  const key = JSON.stringify(body);
  const current = saved.get(key) ?? null;

  const levers = useQuery({
    queryKey: [...queryKeys.zone("customer"), "quote-levers", leversFor],
    queryFn: async () =>
      (
        await browserApi().GET("/v1/store/quotes/{quoteId}/levers", {
          params: { path: { quoteId: leversFor! } },
        })
      ).data!,
    enabled: leversFor !== null && leversFor === current?.quote.id,
    staleTime: Infinity,
  });

  async function keep(): Promise<KeptQuote> {
    if (current) return current;
    const quote = await saveQuote(body as Parameters<typeof saveQuote>[0]);
    const option = quote.options.find((candidate) => candidate.quantity === state.quantity) ?? quote.options[0]!;
    const kept = { quote, option };
    remember(key, kept);
    setLastQuote(kept);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "quotes") });
    return kept;
  }

  /** Remembers what an action changed on the quotation (its code, once issued). */
  function update(kept: KeptQuote, quote: SavedQuote) {
    const next = { ...kept, quote };
    remember(key, next);
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

  async function execute(action: QuoteAction, notes?: string) {
    setBusy(action);
    try {
      const kept = await keep();
      const { quote, option } = kept;
      const api = browserApi();
      if (action === "cart") {
        await editCart((ifMatch) =>
          api.POST("/v1/store/cart/items", {
            params: { header: { "If-Match": ifMatch } },
            body: { quoteId: quote.id, quoteOptionId: option.id, designOption: state.designOption },
          }),
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
        announceCartAdd();
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
        update(kept, share!.quote);
        const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(share!.shareToken)}`;
        await shareOrCopy(
          url,
          productName,
          t("linkCopied"),
          t("linkValidUntil", { date: format.date(share!.expiresAt) }),
        );
      } else if (action === "pdf") {
        const { data: requested } = await api.POST("/v1/store/quotes/{quoteId}/actions/request-pdf", {
          params: { path: { quoteId: quote.id } },
        });
        update(kept, requested!);
        const pdf = await pdfOf(quote.id);
        // Opened from the toast's button: a new tab opened after an await is a pop-up to a
        // browser, and blocked; a click is the customer's own.
        toast.success(t("pdfReady", { code: requested!.quoteCode ?? "" }), {
          action: { label: t("openPdf"), onClick: () => window.open(pdf.url!, "_blank", "noopener") },
        });
      } else if (action === "levers") {
        setLeversFor(quote.id);
      } else if (action === "sample") {
        setSampleFor(quote.id);
      } else {
        const { data: routed } = await api.POST("/v1/store/quotes/{quoteId}/actions/send-to-cs", {
          params: { path: { quoteId: quote.id } },
          body: {
            ...(notes?.trim() ? { notes: notes.trim() } : {}),
            ...(/^\d{5}$/.test(state.postcode) ? { deliveryPostcode: state.postcode } : {}),
          },
        });
        // The quotation is now routed to the RFQ (D-251): forget it, a new price is a new quotation.
        remember(key, null);
        setLastQuote(null);
        setLeversFor(null);
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "rfqs") });
        toast.success(t("sentToCs", { code: routed!.rfqCode }), {
          action: { label: t("viewRfqs"), onClick: () => router.push("/account/rfqs") },
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

  function run(action: QuoteAction, notes?: string) {
    // A guest keeps the line in this browser and signs in at checkout; the cart page then saves it
    // as a quotation at today's price. The other actions keep a quotation now, so they need a session.
    if (!signedIn && action === "cart" && guest) {
      const added = addGuestLine({
        slug: guest.slug,
        productName,
        quantity: state.quantity,
        unit: guest.unit,
        grossAmount: guest.grossAmount,
        specs: guest.specs,
        designOption: state.designOption,
        body: body as Parameters<typeof saveQuote>[0],
      });
      if (added) {
        announceCartAdd();
        track("cart_item_added", {
          route: "/configure/[slug]",
          productType: configurator.productTypeCode,
          quantity: state.quantity,
          quoteMode: "instant",
        });
        toast.success(t("addedToCart", { name: productName }), {
          action: { label: t("viewCart"), onClick: () => router.push("/cart") },
        });
        return;
      }
    }
    if (!signedIn) requestSignIn(() => void execute(action, notes));
    else void execute(action, notes);
  }

  /** Takes a lever: a new quotation at today's prices with the same target (D-249). */
  async function applyLever(lever: Lever) {
    if (!current) return;
    setBusy("levers");
    try {
      const { data: quote } = await browserApi().POST("/v1/store/quotes/{quoteId}/levers/{leverId}/actions/apply", {
        params: { path: { quoteId: current.quote.id, leverId: lever.id } },
      });
      setLeversFor(null);
      setLastQuote(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "quotes") });
      onLeverApplied(quote!);
      toast.success(quote!.quoteCode ? t("leverApplied", { code: quote!.quoteCode }) : t("leverAppliedNoCode"));
    } catch (error) {
      toast.error(t("failed"), isApiError(error) ? { description: error.detail } : undefined);
    } finally {
      setBusy(null);
    }
  }

  return {
    run,
    busy,
    lastQuote: current ?? lastQuote,
    /** The kept quotation's levers once asked for, for the quantity on screen. */
    levers: leversFor && current && leversFor === current.quote.id ? levers : null,
    applyLever,
    sampleFor,
    closeSample: () => setSampleFor(null),
  };
}

/** The native share sheet on a phone, the clipboard elsewhere. */
export async function shareOrCopy(url: string, title: string, copied: string, until: string) {
  if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
    await navigator.share({ title, url }).catch(() => undefined);
  } else {
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    toast.success(copied, { description: `${until} · ${url}` });
  }
}
