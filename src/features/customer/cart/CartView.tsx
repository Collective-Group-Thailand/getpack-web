"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { CheckoutStepper } from "@/features/customer/checkout/flow/CheckoutStepper";
import { MobileBar, OrderSummary } from "@/features/customer/checkout/flow/OrderSummary";
import { cartBlockers, stepHref, type Blocker } from "@/features/customer/checkout/flow/steps";
import { useTrustLines } from "@/features/customer/checkout/flow/trust";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { trackCheckout } from "@/lib/analytics/checkout";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import type { PriceRow } from "@/ui/components/PriceSummary";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import type { Address } from "../account/address";
import { shareOrCopy } from "../configurator/useQuoteActions";
import { productNameOf } from "../orders/summary";
import { CartItemCard } from "./CartItemCard";
import { editCart, readCart, type Cart, type CartItem } from "./cart-client";
import { PromoCodeBox } from "./PromoCodeBox";
import { quotePdf, quoteShareLink } from "./quote-actions";
import { ShippingEstimate, type ShippingEstimateResult } from "./ShippingEstimate";
import { useGuestCartMerge } from "./useGuestCartMerge";

export type { Cart };

export const cartKey = [...queryKeys.resource("customer", "cart")];
export const addressesKey = [...queryKeys.resource("customer", "addresses")];

/** What a removed line needs to come back (`store.cart.addItem`) while its quotation is live. */
type Removed = Pick<CartItem, "quoteId" | "quoteOptionId" | "designOption" | "designDocumentId" | "designVersionNo">;

/**
 * The cart, step 1 of 4 (checkout redesign Phase 1, F3 3.3): quotation lines with their price lock (D-051), quantity
 * (`store.cart.changeQuantity`, D-452), design option and tier hint; the delivery address is step 2's — here only an
 * optional postcode estimate. The summary shows the API's figures: goods incl. VAT and the VAT in them
 * (`CartDto.vatAmount`), the estimate's delivery and total, the codes (at most `CartDto.maxCodes`, enforced by the
 * API). Every edit goes through `editCart`, under the cart's `ETag`.
 *
 * CONTRACT-GAP store.cart — a line does not list the design options it may switch to.
 */
export function CartView({ initialCart }: { initialCart: Cart; initialAddresses?: Address[] }) {
  const t = useTranslations("cart");
  const tFlow = useTranslations("checkout.flow");
  const tUnits = useTranslations("catalog.stock.units");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [codeError, setCodeError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<ShippingEstimateResult | null>(null);
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [lastRemoved, setLastRemoved] = useState<Removed | null>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  const cart = useQuery({ queryKey: cartKey, queryFn: readCart, initialData: initialCart }).data;
  const api = browserApi();

  const mutate = useMutation({
    mutationFn: async (run: () => Promise<Cart>) => run(),
    onSuccess: (next) => queryClient.setQueryData(cartKey, next),
    onError: (error) => {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      void queryClient.invalidateQueries({ queryKey: cartKey });
    },
  });
  // What this browser kept before signing in joins the account's cart (UX audit Flow 1, bug #3).
  const merge = useGuestCartMerge(true);
  useEffect(() => {
    if (merge.merged) {
      queryClient.setQueryData(cartKey, merge.merged.cart);
      toast.success(t("guest.merged", { count: merge.merged.count }));
    }
    if (merge.failed.length > 0) toast.error(t("guest.mergeFailed", { count: merge.failed.length }));
  }, [merge.merged, merge.failed, queryClient, t]);

  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackCheckout("checkout_step_view", { step: "cart" });
  }, []);

  const onEstimate = useCallback((next: ShippingEstimateResult | null) => setEstimate(next), []);
  const nameOf = (item: CartItem) => productNameOf(locale, item.summary);
  const unitOf = (item: CartItem) => tUnits(item.summary.unit);
  const blockers = cartBlockers(cart);
  const trust = useTrustLines({ items: cart.items, readyDate: estimate?.readyDate ?? null });

  async function changeQuantity(item: CartItem, quantity: number, viaHint: boolean) {
    trackCheckout(viaHint ? "checkout_tier_hint_accept" : "checkout_qty_change", { from: item.quantity, to: quantity });
    try {
      const next = await editCart((ifMatch) =>
        api.POST("/v1/store/cart/items/{itemId}/actions/change-quantity", {
          params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
          body: { quantity },
        }),
      );
      queryClient.setQueryData(cartKey, next);
      const line = next.items.find((candidate) => candidate.id === item.id);
      toast.success(t("qtyUpdated", { quantity: format.number(quantity), unit: unitOf(item) }), {
        description:
          line && line.quoteId !== item.quoteId
            ? t("requoted", { date: format.date(line.priceLockedUntil) })
            : undefined,
      });
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      void queryClient.invalidateQueries({ queryKey: cartKey });
    }
  }

  async function restore(removed: Removed) {
    try {
      const next = await editCart((ifMatch) =>
        api.POST("/v1/store/cart/items", {
          params: { header: { "If-Match": ifMatch } },
          body: {
            quoteId: removed.quoteId,
            quoteOptionId: removed.quoteOptionId,
            designOption: removed.designOption as Schemas["DesignOption"],
            ...(removed.designDocumentId
              ? {
                  designDocumentId: removed.designDocumentId,
                  ...(removed.designVersionNo !== null ? { designVersionNo: removed.designVersionNo } : {}),
                }
              : {}),
          },
        }),
      );
      queryClient.setQueryData(cartKey, next);
      setLastRemoved(null);
      toast.success(t("undone"));
    } catch {
      toast.error(t("undoFailed"));
    }
  }

  function remove(item: CartItem, forLater: boolean) {
    const removed: Removed = {
      quoteId: item.quoteId,
      quoteOptionId: item.quoteOptionId,
      designOption: item.designOption,
      designDocumentId: item.designDocumentId,
      designVersionNo: item.designVersionNo,
    };
    mutate.mutate(
      () => editCart(() => api.DELETE("/v1/store/cart/items/{itemId}", { params: { path: { itemId: item.id } } })),
      {
        onSuccess: () => {
          setLastRemoved(removed);
          if (forLater) {
            trackCheckout("checkout_save_for_later", { productType: item.productTypeCode });
            // OPEN Q-4 (recommended): saved for later = the quotation stays in /account/quotes while it is live.
            toast.success(t("savedForLater"), {
              action: { label: t("openQuotes"), onClick: () => router.push("/account/quotes") },
            });
          } else {
            toast.success(t("removed", { name: nameOf(item) }), {
              action: { label: t("undo"), onClick: () => void restore(removed) },
            });
          }
        },
      },
    );
  }

  // The cart's secondary actions reuse the quotation's own PDF and share link (GLOBAL-RULES §5), so they show for a
  // cart of one quotation; several quotations in one PDF / approval link is Phase 2 (PLAN GAP-2).
  const only = cart.items.length === 1 ? cart.items[0]! : null;
  const quoteActions = only && only.source === "instant" && only.summary.product ? only : null;

  async function pdf() {
    if (!quoteActions) return;
    setBusy("pdf");
    try {
      const ready = await quotePdf(quoteActions.quoteId);
      toast.success(tFlow("summary.pdfReady", { code: ready.code ?? "" }), {
        action: { label: tFlow("summary.pdfOpen"), onClick: () => window.open(ready.url, "_blank", "noopener") },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "pdf.pending") toast.info(tFlow("summary.pdfPending"));
      else toast.error(isApiError(error) ? error.detail : tFlow("summary.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!quoteActions?.summary.product) return;
    setBusy("share");
    try {
      const link = await quoteShareLink(quoteActions.quoteId, quoteActions.summary.product.slug);
      await shareOrCopy(
        link.url,
        nameOf(quoteActions),
        tFlow("summary.shareCopied"),
        tFlow("summary.shareUntil", { date: format.date(link.expiresAt) }),
      );
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : tFlow("summary.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  function onBlocked() {
    const first = blockers[0];
    if (!first) return;
    trackCheckout("checkout_blocked", { step: "cart", reason: first.reason });
    const target = first.itemId
      ? document.getElementById(`cart-item-${first.itemId}`)
      : itemsRef.current?.querySelector<HTMLElement>("h1, h2");
    target?.scrollIntoView({ block: "center" });
    target?.closest("article")?.querySelector<HTMLElement>("button, a")?.focus();
  }

  if (cart.items.length === 0 && merge.merging) {
    return (
      <p className="text-muted mt-8 text-sm" role="status">
        {t("guest.merging")}
      </p>
    );
  }

  if (cart.items.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon="cart"
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={
          // A returning customer's cart is often empty because what they want is already saved:
          // a quotation to accept, or an earlier job to order again.
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/products">{t("browse")}</Link>
            </Button>
            {lastRemoved ? (
              <Button variant="secondary" iconStart="undo" onClick={() => void restore(lastRemoved)}>
                {t("undo")}
              </Button>
            ) : null}
            <Button asChild variant="secondary" iconStart="receipt">
              <Link href="/account/quotes">{t("emptyQuotes")}</Link>
            </Button>
            <Button asChild variant="secondary" iconStart="refresh">
              <Link href="/account/orders?view=completed">{t("emptyReorder")}</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const blockerText = (blocker: Blocker) => {
    const item = cart.items.find((candidate) => candidate.id === blocker.itemId);
    return tFlow(`blockers.${blocker.reason}`, { name: item ? nameOf(item) : "", quantity: item?.quantity ?? 0 });
  };
  const rows: PriceRow[] = [
    {
      label: tFlow("summary.goods", { count: cart.items.length }),
      hint: tFlow("summary.vatIncluded"),
      value: format.thb(cart.productGrossAmount),
    },
    estimate?.shippingGrossAmount
      ? {
          label: tFlow("summary.shipping"),
          hint: tFlow("summary.shippingEstimate", { postcode: estimate.postcode }),
          value: format.thb(estimate.shippingGrossAmount),
        }
      : { label: tFlow("summary.shipping"), value: tFlow("summary.shippingLater"), tone: "muted" },
    ...((estimate?.vatAmount ?? cart.vatAmount)
      ? [{ label: tFlow("summary.vat"), value: format.thb((estimate?.vatAmount ?? cart.vatAmount)!) }]
      : []),
  ];
  const totalValue = format.thb(estimate?.totalGrossAmount ?? cart.productGrossAmount);
  const totalHint = estimate?.totalGrossAmount ? undefined : tFlow("summary.totalNoShipping");
  const primary = { label: tFlow("continue"), href: stepHref("address") };

  return (
    <>
      <CheckoutStepper current="cart" reachable={blockers.length > 0 ? "cart" : "address"} />
      <div className="grid items-start gap-8 pt-4 pb-28 min-[1100px]:grid-cols-[minmax(0,1fr)_23.75rem] sm:pb-24">
        <div ref={itemsRef} className="flex min-w-0 flex-col gap-4">
          <section
            aria-labelledby="cart-title"
            className="border-border bg-surface rounded-card border px-4 py-4.5 sm:px-6 sm:py-5.5"
          >
            <h1 id="cart-title" className="m-0 text-[19px] leading-snug font-semibold">
              {t("title")}
            </h1>
            <p className="text-muted m-0 mt-1 mb-4 text-sm">{t("box.sub", { count: cart.items.length })}</p>
            <ul className="m-0 flex list-none flex-col p-0" aria-label={t("itemsLabel")}>
              {cart.items.map((item, index) => (
                <li key={item.id} className={index > 0 ? "border-border mt-5 border-t pt-5" : undefined}>
                  <CartItemCard
                    item={item}
                    quantityStep={cart.quantityStep}
                    pending={mutate.isPending}
                    onQuantity={(quantity) => void changeQuantity(item, quantity, false)}
                    onTierAccept={(quantity) => void changeQuantity(item, quantity, true)}
                    onDesign={(designOption) =>
                      mutate.mutate(() =>
                        editCart((ifMatch) =>
                          api.PATCH("/v1/store/cart/items/{itemId}", {
                            params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
                            body: { designOption },
                          }),
                        ),
                      )
                    }
                    onSaveForLater={() => remove(item, true)}
                    onRemove={() => remove(item, false)}
                    onReprice={() =>
                      mutate.mutate(() =>
                        editCart(() =>
                          api.POST("/v1/store/cart/items/{itemId}/actions/reprice", {
                            params: { path: { itemId: item.id } },
                          }),
                        ),
                      )
                    }
                    onConfirmReprice={() =>
                      mutate.mutate(() =>
                        editCart((ifMatch) =>
                          api.POST("/v1/store/cart/items/{itemId}/actions/confirm-reprice", {
                            params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
                          }),
                        ),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
          <section className="border-border bg-surface rounded-card border px-4 py-4.5 sm:px-6 sm:py-5.5">
            <ShippingEstimate cartVersion={cart.updatedAt} onEstimate={onEstimate} />
          </section>
        </div>

        <OrderSummary
          rows={rows}
          total={{ label: tFlow("summary.total"), value: totalValue, hint: totalHint }}
          pending={mutate.isPending}
          codes={
            <PromoCodeBox
              variant="compact"
              codes={cart.codes}
              maxCodes={cart.maxCodes}
              note={tFlow("summary.codesNote")}
              pending={mutate.isPending}
              error={codeError}
              onApply={async (code) => {
                setCodeError(null);
                try {
                  const next = await editCart((ifMatch) =>
                    api.POST("/v1/store/cart/codes", { params: { header: { "If-Match": ifMatch } }, body: { code } }),
                  );
                  queryClient.setQueryData(cartKey, next);
                  const entry = next.codes.find((candidate) => candidate.code === code);
                  trackCheckout("checkout_code_apply", {
                    result: entry?.status === "validated" ? "validated" : "rejected",
                  });
                } catch (error) {
                  trackCheckout("checkout_code_apply", { result: "error" });
                  setCodeError(isApiError(error) ? error.detail : t("failed"));
                }
              }}
              onRemove={(code) => {
                setCodeError(null);
                mutate.mutate(() =>
                  editCart((ifMatch) =>
                    api.DELETE("/v1/store/cart/codes/{code}", {
                      params: { path: { code }, header: { "If-Match": ifMatch } },
                    }),
                  ),
                );
              }}
            />
          }
          blockers={blockers.map(blockerText)}
          primary={primary}
          onBlocked={onBlocked}
          secondary={
            quoteActions ? (
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="secondary"
                  className="px-2 text-[13px]"
                  loading={busy === "pdf"}
                  onClick={() => void pdf()}
                >
                  <Icon name="document" size={16} aria-hidden="true" />
                  {tFlow("summary.pdf")}
                </Button>
                <Button
                  variant="secondary"
                  className="px-2 text-[13px]"
                  loading={busy === "share"}
                  onClick={() => void share()}
                >
                  <Icon name="users" size={16} aria-hidden="true" />
                  {tFlow("summary.approver")}
                </Button>
              </div>
            ) : null
          }
          trust={trust}
        />
      </div>
      <MobileBar
        total={totalValue}
        note={estimate?.totalGrossAmount ? tFlow("summary.totalWithShipping") : tFlow("summary.totalNoShipping")}
        action={{ ...primary, label: tFlow("nextShort") }}
        blocked={blockers.length > 0}
        onBlocked={onBlocked}
      />
    </>
  );
}
