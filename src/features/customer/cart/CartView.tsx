"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
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

import type { Address } from "../account/AddressForm";
import { storeImageSrc } from "../catalog/images";

const AddressSheet = dynamic(() => import("./AddressSheet").then((module) => module.AddressSheet), { ssr: false });

export type Cart = ResponseOf<Requests, "GET /v1/store/cart">;
type Item = Cart["items"][number];

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
                  unit: item.unit,
                  name: destination.address?.recipientName ?? "",
                  province: destination.address?.province ?? "",
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
      <legend className="px-1 text-sm font-medium">
        {t("legend", { quantity: format.number(item.quantity), unit: item.unit })}
      </legend>
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
                label: `${address.label} — ${address.recipientName}, ${address.province} ${address.postcode}`,
              }))}
            />
          </Field>
          <Field label={t("quantity")} className="w-32">
            <NumberInput
              min={1}
              unit={item.unit}
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
        {t("total", { total: format.number(total), quantity: format.number(item.quantity), unit: item.unit })}
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
 * across saved addresses. A line whose quotation expired is re-priced by the API and says what
 * changed until the customer confirms the new price (D-051, design-system.md §1.3); checkout opens
 * once the API says nothing blocks it.
 */
export function CartView({ initialCart, initialAddresses }: { initialCart: Cart; initialAddresses: Address[] }) {
  const t = useTranslations("cart");
  const tDesign = useTranslations("configurator.design.options");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [addressFor, setAddressFor] = useState<string | null>(null);

  const cart = useQuery({
    queryKey: cartKey,
    queryFn: () => browserRequests().call("GET /v1/store/cart"),
    initialData: initialCart,
  }).data;
  const addresses = useQuery({
    queryKey: addressesKey,
    queryFn: async () => (await browserRequests().call("GET /v1/store/me/addresses")).data,
    initialData: initialAddresses,
  }).data;

  const mutate = useMutation({
    mutationFn: async (run: () => Promise<Cart>) => run(),
    onSuccess: (next) => queryClient.setQueryData(cartKey, next),
    onError: (error) => toast.error(isApiError(error) ? error.detail : t("failed")),
  });
  const requests = browserRequests();

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
                  {storeImageSrc(item.product.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- API image, decorative beside the name
                    <img src={storeImageSrc(item.product.imageUrl)!} alt="" className="size-full object-cover" />
                  ) : (
                    <Icon name="box" size={24} aria-hidden="true" className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id={`cart-item-${item.id}`} className="font-semibold">
                    {item.product.name}
                  </h2>
                  <p className="text-muted text-sm">{item.specs.map((spec) => spec.value).join(" · ")}</p>
                  <p className="text-muted mt-1 text-xs">
                    {t("quote", { code: item.quote.quoteCode, date: format.date(item.quote.validUntil) })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold tabular-nums">{format.thb(item.grossAmount)}</p>
                  <p className="text-muted text-xs tabular-nums">
                    {t("perPiece", {
                      price: format.thb(item.unitPrice),
                      quantity: format.number(item.quantity),
                      unit: item.unit,
                    })}
                  </p>
                </div>
              </div>

              {item.state === "repriced" && item.repricing ? (
                <Callout tone="warning" title={t("repricedTitle")}>
                  <div className="flex flex-col items-start gap-2">
                    <span>
                      {t("repriced", {
                        before: format.thb(item.repricing.previousGrossAmount),
                        after: format.thb(item.grossAmount),
                      })}
                    </span>
                    <Button
                      size="sm"
                      onClick={() =>
                        mutate.mutate(() =>
                          requests.call("POST /v1/store/cart/items/{itemId}/actions/accept-reprice", {
                            path: { itemId: item.id },
                          }),
                        )
                      }
                    >
                      {t("acceptReprice")}
                    </Button>
                  </div>
                </Callout>
              ) : null}
              {item.state === "unavailable" ? <Callout tone="danger">{item.unavailableReason}</Callout> : null}

              <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
                {item.designOptions.length > 1 ? (
                  <Field label={t("designOption")} hint={t("designOptionHint")}>
                    <Select
                      value={item.designOption}
                      onValueChange={(designOption) =>
                        mutate.mutate(() =>
                          requests.call("PATCH /v1/store/cart/items/{itemId}", {
                            path: { itemId: item.id },
                            body: { designOption: designOption as Item["designOption"] },
                          }),
                        )
                      }
                      options={item.designOptions.map((option) => ({
                        value: option,
                        label: tDesign(`${option}.label`),
                      }))}
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
                        requests.call("PUT /v1/store/cart/items/{itemId}/destinations", {
                          path: { itemId: item.id },
                          body: { destinations: rows },
                        }),
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
                      requests.call("DELETE /v1/store/cart/items/{itemId}", { path: { itemId: item.id } }),
                    )
                  }
                >
                  {t("remove")}
                  <span className="sr-only"> {item.product.name}</span>
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
              label: t("itemsCount", { count: cart.itemCount }),
              value: format.thb(cart.subtotalAmount),
              hint: t("vatIncluded"),
            },
            { label: t("vat"), value: format.thb(cart.vatAmount), tone: "muted" },
          ]}
          total={{ label: t("subtotal"), value: format.thb(cart.subtotalAmount), hint: t("atCheckout") }}
        />
        {cart.blockers.length > 0 ? (
          <Callout tone="warning" className="mt-4" title={t("blockedTitle")}>
            <ul className="list-disc ps-5">
              {cart.blockers.map((blocker, index) => (
                <li key={index}>{blocker.message}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        {cart.readyForCheckout ? (
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
