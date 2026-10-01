"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { NumberInput } from "@/ui/components/Input";
import { PriceSummary } from "@/ui/components/PriceSummary";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { geoName, type Address } from "../account/address";
import { productNameOf, specLinesOf } from "../orders/summary";
import { editCart, lineBlockers, readCart, type Cart, type CartItem } from "./cart-client";

const AddressSheet = dynamic(() => import("./AddressSheet").then((module) => module.AddressSheet), { ssr: false });

export type { Cart };
type Item = CartItem;

/** Every design option the contract names (CONTRACT-GAP store.cart: the line does not say which it may switch to). */
const DESIGN_OPTIONS: readonly Schemas["DesignOption"][] = ["own_file", "online_designer", "hired_design"];

export const cartKey = [...queryKeys.resource("customer", "cart")];
export const addressesKey = [...queryKeys.resource("customer", "addresses")];

/** A line's quantity split across addresses (D-110) — edited here, checked by the API. */
function Destinations({
  item,
  addresses,
  onSave,
  saving,
  onAddAddress,
}: {
  item: Item;
  addresses: Address[];
  onSave: (rows: { addressId: string; quantity: number }[]) => void;
  saving: boolean;
  onAddAddress: () => void;
}) {
  const t = useTranslations("cart.destinations");
  const locale = useLocale();
  const format = useFormat();
  const [rows, setRows] = useState(() =>
    item.destinations.map((destination) => ({
      addressId: destination.addressId ?? "",
      quantity: String(destination.quantity),
    })),
  );
  const [editing, setEditing] = useState(item.destinations.some((destination) => !destination.addressId));
  const total = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  if (!editing) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <ul className="flex flex-col gap-1">
          {item.destinations.map((destination) => (
            <li key={destination.id} className="flex items-start gap-2">
              <Icon name="map-pin" size={16} aria-hidden="true" className="text-muted mt-0.5" />
              <span>
                {t("line", {
                  quantity: format.number(destination.quantity),
                  name: destination.address.recipientName,
                  province: destination.address.provinceNameTh,
                })}
              </span>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="link" className="self-start px-0" onClick={() => setEditing(true)}>
          {item.destinations.length > 1 ? t("edit") : t("split")}
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="border-border flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{t("legend", { quantity: format.number(item.quantity) })}</legend>
      {addresses.length === 0 ? <p className="text-muted text-sm">{t("noAddresses")}</p> : null}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <Field label={t("address", { index: index + 1 })} className="min-w-48 flex-1">
            <Select
              value={row.addressId || undefined}
              placeholder={t("choose")}
              onValueChange={(addressId) =>
                setRows((current) => current.map((entry, at) => (at === index ? { ...entry, addressId } : entry)))
              }
              options={addresses.map((address) => ({
                value: address.id,
                label: `${address.label} — ${address.recipientName}, ${geoName(locale, address.province)} ${address.postcode}`,
              }))}
            />
          </Field>
          <Field label={t("quantity")} className="w-32">
            <NumberInput
              min={1}
              value={row.quantity}
              onChange={(event) =>
                setRows((current) =>
                  current.map((entry, at) => (at === index ? { ...entry, quantity: event.target.value } : entry)),
                )
              }
            />
          </Field>
          {rows.length > 1 ? (
            <IconButton
              name="trash"
              variant="ghost"
              label={t("remove", { index: index + 1 })}
              onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
            />
          ) : null}
        </div>
      ))}
      <p
        className={total === item.quantity ? "text-muted text-xs" : "text-danger text-xs font-medium"}
        aria-live="polite"
      >
        {t("total", { total: format.number(total), quantity: format.number(item.quantity) })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          iconStart="plus"
          onClick={() => setRows((current) => [...current, { addressId: "", quantity: "" }])}
        >
          {t("addRow")}
        </Button>
        <Button size="sm" variant="ghost" iconStart="map-pin" onClick={onAddAddress}>
          {t("newAddress")}
        </Button>
        <Button
          size="sm"
          loading={saving}
          disabled={total !== item.quantity || rows.some((row) => !row.addressId)}
          onClick={() => {
            onSave(rows.map((row) => ({ addressId: row.addressId, quantity: Number(row.quantity) })));
            setEditing(false);
          }}
        >
          {t("save")}
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * The cart (F3 3.3, D-110): quotation lines, each with its design option and its quantity split
 * across saved addresses. A line whose price lock ended is priced again on the customer's word
 * (`store.cart.repriceItem`) and shows the difference until they confirm it (confirm-reprice,
 * D-051, design-system.md §1.3). Every edit goes through `editCart`, under the cart's `ETag`.
 *
 * A line says what it is (`summary`: product, spec lines, unit) and, for a reorder, which order it
 * repeats. Whether the cart can go to checkout is the checkout preview's to say (U-B0.1); the page
 * asks only for what a line itself shows is missing.
 *
 * CONTRACT-GAP store.cart — a line does not list the design options it may switch to.
 */
export function CartView({ initialCart, initialAddresses }: { initialCart: Cart; initialAddresses: Address[] }) {
  const t = useTranslations("cart");
  const tUnits = useTranslations("catalog.stock.units");
  const locale = useLocale();
  const tDesign = useTranslations("configurator.design.options");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [addressFor, setAddressFor] = useState<string | null>(null);

  const cart = useQuery({ queryKey: cartKey, queryFn: readCart, initialData: initialCart }).data;
  const addresses = useQuery({
    queryKey: addressesKey,
    queryFn: async () =>
      (await browserApi().GET("/v1/store/addresses", { params: { query: { perPage: 100 } } })).data!.data,
    initialData: initialAddresses,
  }).data;

  const mutate = useMutation({
    mutationFn: async (run: () => Promise<Cart>) => run(),
    onSuccess: (next) => queryClient.setQueryData(cartKey, next),
    onError: (error) => {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      void queryClient.invalidateQueries({ queryKey: cartKey });
    },
  });
  const api = browserApi();
  const nameOf = (item: Item) => productNameOf(locale, item.summary);
  const blocked = cart.items.flatMap((item) => lineBlockers(item).map((kind) => ({ item, kind })));

  if (cart.items.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon="cart"
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={
          <Button asChild>
            <Link href="/products">{t("browse")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ul className="flex flex-col gap-4" aria-label={t("itemsLabel")}>
        {cart.items.map((item) => (
          <li key={item.id} className="border-border rounded-2xl border p-4">
            <article aria-labelledby={`cart-item-${item.id}`} className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-bg-subtle flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  {item.summary.product?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- catalogue image from the API
                    <img src={item.summary.product.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Icon name="box" size={24} aria-hidden="true" className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id={`cart-item-${item.id}`} className="font-semibold">
                    {nameOf(item)}
                  </h2>
                  {item.summary.specs.length > 0 ? (
                    <p className="text-muted mt-1 text-sm">
                      {specLinesOf(locale, item.summary)
                        .map((line) => `${line.term} ${line.description}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {item.reorderOf ? (
                    <p className="text-muted mt-1 text-xs">
                      {t(item.reusesApprovedArtwork ? "reorderOfReused" : "reorderOf", {
                        code: item.reorderOf.orderCode,
                      })}
                    </p>
                  ) : null}
                  <p className="text-muted mt-1 text-xs">
                    {item.quoteCode
                      ? t("quote", { code: item.quoteCode, date: format.date(item.priceLockedUntil) })
                      : t("quoteNoCode", { date: format.date(item.priceLockedUntil) })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold tabular-nums">{format.thb(item.productGrossAmount)}</p>
                  <p className="text-muted text-xs tabular-nums">
                    {t("perUnitOf", {
                      price: format.thb(item.unitPrice),
                      quantity: format.number(item.quantity),
                      unit: tUnits(item.summary.unit),
                    })}
                  </p>
                </div>
              </div>

              {item.pendingReprice ? (
                <Callout tone="warning" title={t("repricedTitle")}>
                  <div className="flex flex-col items-start gap-2">
                    <span>
                      {t("repriced", {
                        before: format.thb(item.pendingReprice.previousGrossAmount),
                        after: format.thb(item.pendingReprice.newGrossAmount),
                      })}
                    </span>
                    <Button
                      size="sm"
                      onClick={() =>
                        mutate.mutate(() =>
                          editCart((ifMatch) =>
                            api.POST("/v1/store/cart/items/{itemId}/actions/confirm-reprice", {
                              params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
                            }),
                          ),
                        )
                      }
                    >
                      {t("acceptReprice")}
                    </Button>
                  </div>
                </Callout>
              ) : !item.priceLocked ? (
                <Callout tone="warning" title={t("expiredTitle")}>
                  <div className="flex flex-col items-start gap-2">
                    <span>{t("expired")}</span>
                    <Button
                      size="sm"
                      onClick={() =>
                        mutate.mutate(() =>
                          editCart(() =>
                            api.POST("/v1/store/cart/items/{itemId}/actions/reprice", {
                              params: { path: { itemId: item.id } },
                            }),
                          ),
                        )
                      }
                    >
                      {t("reprice")}
                    </Button>
                  </div>
                </Callout>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
                {item.source === "instant" ? (
                  <Field label={t("designOption")} hint={t("designOptionHint")}>
                    <Select
                      value={item.designOption}
                      onValueChange={(designOption) =>
                        mutate.mutate(() =>
                          editCart((ifMatch) =>
                            api.PATCH("/v1/store/cart/items/{itemId}", {
                              params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
                              body: { designOption: designOption as Item["designOption"] },
                            }),
                          ),
                        )
                      }
                      options={DESIGN_OPTIONS.map((option) => ({ value: option, label: tDesign(`${option}.label`) }))}
                    />
                  </Field>
                ) : (
                  <p className="text-sm">
                    <span className="text-muted block text-xs">{t("designOption")}</span>
                    {tDesign(`${item.designOption}.label`)}
                  </p>
                )}
                <div>
                  <p className="text-muted mb-1 text-xs">{t("deliverTo")}</p>
                  <Destinations
                    key={item.destinations
                      .map((destination) => `${destination.addressId}:${destination.quantity}`)
                      .join("|")}
                    item={item}
                    addresses={addresses}
                    saving={mutate.isPending}
                    onAddAddress={() => setAddressFor(item.id)}
                    onSave={(rows) =>
                      mutate.mutate(() =>
                        editCart((ifMatch) =>
                          api.PUT("/v1/store/cart/items/{itemId}/destinations", {
                            params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
                            body: { destinations: rows },
                          }),
                        ),
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  iconStart="trash"
                  onClick={() =>
                    mutate.mutate(() =>
                      editCart(() =>
                        api.DELETE("/v1/store/cart/items/{itemId}", { params: { path: { itemId: item.id } } }),
                      ),
                    )
                  }
                >
                  {t("remove")}
                  <span className="sr-only"> {nameOf(item)}</span>
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <aside aria-labelledby="cart-summary" className="border-border h-fit rounded-2xl border p-5 lg:sticky lg:top-20">
        <h2 id="cart-summary" className="text-lg font-semibold">
          {t("summary")}
        </h2>
        <PriceSummary
          className="mt-4"
          rows={[
            {
              label: t("itemsCount", { count: cart.items.length }),
              value: format.thb(cart.productGrossAmount),
              hint: t("vatIncluded"),
            },
          ]}
          total={{ label: t("subtotal"), value: format.thb(cart.productGrossAmount), hint: t("atCheckout") }}
        />
        {blocked.length > 0 ? (
          <Callout tone="warning" className="mt-4" title={t("blockedTitle")}>
            <ul className="list-disc ps-5">
              {blocked.map(({ item, kind }) => (
                <li key={`${item.id}-${kind}`}>{t(`blockers.${kind}`, { name: nameOf(item) })}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        {blocked.length === 0 ? (
          <Button asChild block size="lg" className="mt-4">
            <Link href="/checkout" onClick={() => track("checkout_started", { route: "/cart" })}>
              {t("checkout")}
            </Link>
          </Button>
        ) : (
          <Button block size="lg" className="mt-4" disabled>
            {t("checkout")}
          </Button>
        )}
        <p className="text-muted mt-3 text-xs">{t("secureNote")}</p>
      </aside>

      {addressFor ? (
        <AddressSheet
          open={addressFor !== null}
          onOpenChange={(open) => !open && setAddressFor(null)}
          onSaved={(address) => {
            queryClient.setQueryData<Address[]>(addressesKey, (current) => [...(current ?? []), address]);
            setAddressFor(null);
          }}
        />
      ) : null}
    </div>
  );
}
