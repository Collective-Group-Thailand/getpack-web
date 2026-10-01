"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { MEMO_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Select } from "@/ui/components/Select";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, StatusChip, useCan, useProductTypes } from "../console";
import { useGeoName, usePostcodeAreas } from "../customers/geo";
import { isPublished, type CalculatorKey } from "./calculators";

type DesignOption = Schemas["DesignOption"];
type MockupOption = Schemas["MockupOption"];
type Memo = Schemas["DiscountMemoDto"];

/**
 * CS places an order for a customer (F2 2.2) the way packio-api publishes it (`admin.cart.*`,
 * `admin.checkout.place`): the quotation's option goes into the customer's cart with its
 * destinations, and the cart is checked out. A discount is given at checkout — up to the CS limit
 * on CS's own, above it through a discount memo that prices the cart (D-052, D-162). The limit is
 * the API's setting (`discounts.cs_limit_pct`): the page shows it as the calculator's input data
 * states it (`discountPolicy.directLimitPct`, v0.5.0), and the API decides at checkout.
 *
 * Checkout takes the customer's whole cart, so the page will not place while the cart holds
 * anything else: CS removes it first, or the customer checks it out themselves.
 */
export function CreateOrder({
  quoteId,
  optionId,
  quantity,
}: {
  quoteId: string;
  optionId?: string;
  quantity?: number;
}) {
  const t = useTranslations("cs.createOrder");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canMemo = useCan("discount_memos.request");
  const [split, setSplit] = useState<Record<string, number>>({});
  const [taxProfileId, setTaxProfileId] = useState<string>("none");
  const [designOption, setDesignOption] = useState<DesignOption>("own_file");
  const [mockupOption, setMockupOption] = useState<MockupOption>("none");
  const [poNumber, setPoNumber] = useState("");
  const [cc, setCc] = useState("");
  const [remarks, setRemarks] = useState("");
  const [discount, setDiscount] = useState("");
  const [memo, setMemo] = useState<Memo | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [aboveLimit, setAboveLimit] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);

  const quote = useQuery({
    queryKey: queryKeys.detail("admin", "quote", quoteId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/quotes/{quoteId}", { params: { path: { quoteId } } })).data!,
  });
  const customerId = quote.data?.customer?.id;
  const path = { customerId: customerId ?? "" };
  const customer = useQuery({
    queryKey: queryKeys.detail("admin", "customer", customerId ?? ""),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}", { params: { path } })).data!,
    enabled: Boolean(customerId),
  });
  const addressBook = useQuery({
    queryKey: queryKeys.related("admin", "customer", customerId ?? "", "addresses"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/addresses", {
          params: { path, query: { perPage: 100 } },
        })
      ).data!,
    enabled: Boolean(customerId),
  });
  const taxProfiles = useQuery({
    queryKey: queryKeys.related("admin", "customer", customerId ?? "", "tax_profiles"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/tax-profiles", {
          params: { path, query: { perPage: 100 } },
        })
      ).data!,
    enabled: Boolean(customerId),
  });
  const cartKey = queryKeys.related("admin", "customer", customerId ?? "", "cart");
  const cart = useQuery({
    queryKey: cartKey,
    queryFn: async () => {
      const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/cart", {
        params: { path },
      });
      return { cart: data!, etag: response.headers.get("ETag") };
    },
    enabled: Boolean(customerId),
  });
  const geoName = useGeoName();
  // The CS limit, from the input data of the calculator that priced this quotation's type.
  const { types } = useProductTypes();
  const calculator = types.find((type) => type.code === quote.data?.productTypeCode)?.calculatorKey as
    CalculatorKey | null | undefined;
  const policy = useQuery({
    queryKey: queryKeys.detail("admin", "cs_input", calculator ?? ""),
    enabled: Boolean(calculator && isPublished(calculator)),
    queryFn: async () =>
      calculator === "folding"
        ? (await adminBrowserApis().contract.GET("/v1/admin/cs/folding/input-data")).data!
        : (await adminBrowserApis().contract.GET("/v1/admin/cs/corrugate/input-data")).data!,
    staleTime: STALE_TIME.reference,
  });
  const limitPct = policy.data?.discountPolicy.directLimitPct ?? null;

  const option =
    quote.data?.options.find((candidate) => candidate.id === optionId) ??
    quote.data?.options.find((candidate) => candidate.quantity === quantity) ??
    quote.data?.options[0];
  const ccList = cc.split(/[,\s]+/).filter(Boolean);
  const destinations = Object.entries(split).filter(([, value]) => value > 0);
  const total = destinations.reduce((sum, [, value]) => sum + value, 0);
  const others = (cart.data?.cart.items ?? []).filter((item) => item.quoteOptionId !== option?.id);
  const discountValid = discount === "" || /^\d+(\.\d{1,2})?$/.test(discount);

  const removeOther = useMutation({
    mutationFn: async (itemId: string) =>
      (
        await adminBrowserApis().contract.DELETE("/v1/admin/customers/{customerId}/cart/items/{itemId}", {
          params: { path: { ...path, itemId } },
        })
      ).data!,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cartKey }),
  });

  /** The option in the cart with these destinations — added once, then kept for a retry. */
  async function ensureInCart() {
    const current = cart.data!;
    if (current.cart.items.some((item) => item.quoteOptionId === option!.id)) return;
    await adminBrowserApis().contract.POST("/v1/admin/customers/{customerId}/cart/items", {
      params: { path, header: { "If-Match": current.etag ?? "" } },
      body: {
        quoteId,
        quoteOptionId: option!.id,
        designOption,
        mockupOption,
        destinations: destinations.map(([addressId, value]) => ({ addressId, quantity: value })),
      },
    });
    await queryClient.invalidateQueries({ queryKey: cartKey });
  }

  const place = useMutation({
    mutationFn: async () => {
      await ensureInCart();
      const approved = memo?.status === "approved";
      return (
        await adminBrowserApis().contract.POST("/v1/admin/customers/{customerId}/checkout", {
          // A new key per attempt: a retry after a refusal sends a different body.
          params: { path, header: { "Idempotency-Key": newIdempotencyKey() } },
          body: {
            taxProfileId: taxProfileId === "none" ? null : taxProfileId,
            ...(poNumber ? { poNumber } : {}),
            ccEmails: ccList,
            ...(remarks ? { csRemarks: remarks } : {}),
            ...(approved ? { discountMemoId: memo.id } : discount ? { csDiscountPct: discount } : {}),
          },
        })
      ).data!;
    },
    onSuccess: (group) => {
      toast.success(t("placed", { code: group.groupCode }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order") });
      const first = group.orders[0];
      router.push(first ? `/orders/${first.id}` : "/orders");
    },
    onError: (error) => {
      if (isApiError(error) && error.code === "discounts.cs_limit_exceeded") setAboveLimit(true);
    },
  });

  const refreshMemo = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/discount-memos/{memoId}", {
          params: { path: { memoId: memo!.id } },
        })
      ).data!,
    onSuccess: setMemo,
  });

  if (quote.isError) return <QueryError error={quote.error} onRetry={() => void quote.refetch()} />;
  if (!quote.data || !option) return <Skeleton className="h-96" />;
  if (!customerId) return <Callout tone="warning" title={t("noCustomer")} />;
  if (!customer.data || !addressBook.data || !taxProfiles.data || !cart.data) return <Skeleton className="h-96" />;

  const addresses = addressBook.data.data.filter((address) => address.kind === "delivery");
  const juristic = customer.data.customerType !== "individual";
  const ready =
    total === option.quantity &&
    destinations.length > 0 &&
    others.length === 0 &&
    discountValid &&
    (!memo || memo.status === "approved") &&
    ccList.every((email) => /^\S+@\S+\.\S+$/.test(email));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-4">
        {others.length > 0 ? (
          <Callout tone="warning" title={t("cartBusy", { count: others.length })}>
            <ul className="mt-2 space-y-1 text-sm">
              {others.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{item.quoteCode ?? item.quoteId.slice(0, 8)}</span>
                  <span>
                    {format.number(item.quantity)} · {format.thb(item.productGrossAmount)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={removeOther.isPending && removeOther.variables === item.id}
                    onClick={() => removeOther.mutate(item.id)}
                  >
                    {t("removeFromCart")}
                  </Button>
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <Card padding="lg">
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>{t("destinations")}</CardTitle>
            <Button variant="secondary" size="sm" iconStart="plus" onClick={() => setAddingAddress(true)}>
              {t("addAddress")}
            </Button>
          </CardHeader>
          {addresses.length === 0 ? (
            <p className="text-muted text-sm">{t("noAddress")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {addresses.map((address) => (
                <li
                  key={address.id}
                  className="border-border flex flex-wrap items-end justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {address.label}
                      <span className="text-muted font-normal"> · {address.recipientName}</span>
                    </p>
                    <p className="text-muted">
                      {[
                        address.line1,
                        address.line2,
                        geoName(address.subdistrict),
                        geoName(address.province),
                        address.postcode,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </div>
                  <Field label={t("quantityFor", { label: address.label })} className="w-40">
                    <NumberInput
                      min={0}
                      max={option.quantity}
                      value={split[address.id] ?? ""}
                      onChange={(event) =>
                        setSplit({ ...split, [address.id]: Math.max(0, Number(event.target.value) || 0) })
                      }
                    />
                  </Field>
                </li>
              ))}
            </ul>
          )}
          <p
            className={total === option.quantity ? "text-success mt-3 text-sm" : "text-warning-subtle-fg mt-3 text-sm"}
            aria-live="polite"
          >
            {t("allocated", { allocated: format.number(total), quantity: format.number(option.quantity) })}
          </p>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-4">
            <Field label={t("taxProfile")} hint={juristic ? t("taxHintJuristic") : t("taxHint")}>
              <Select
                value={taxProfileId}
                onValueChange={setTaxProfileId}
                options={[
                  { value: "none", label: t("noTaxInvoice") },
                  ...taxProfiles.data.data.map((profile) => ({
                    value: profile.id,
                    label: `${profile.name} · ${profile.taxId}`,
                  })),
                ]}
              />
            </Field>
            <Field label={t("design")}>
              <RadioCards
                value={designOption}
                onValueChange={(value) => setDesignOption(value as DesignOption)}
                options={(["own_file", "online_designer", "hired_design"] as const).map((value) => ({
                  value,
                  label: t(`designOptions.${value}`),
                  description: t(`designHints.${value}`),
                }))}
              />
            </Field>
            <Field label={t("mockup")} hint={t("mockupHint")}>
              <Select
                value={mockupOption}
                onValueChange={(value) => setMockupOption(value as MockupOption)}
                options={(["none", "with_print", "without_print"] as const).map((value) => ({
                  value,
                  label: t(`mockupOptions.${value}`),
                }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("po")}>
                <Input value={poNumber} maxLength={60} onChange={(event) => setPoNumber(event.target.value)} />
              </Field>
              <Field
                label={t("cc")}
                hint={t("ccHint")}
                error={ccList.every((email) => /^\S+@\S+\.\S+$/.test(email)) ? undefined : t("ccInvalid")}
              >
                <Input value={cc} onChange={(event) => setCc(event.target.value)} />
              </Field>
            </div>
            <Field label={t("remarks")} hint={t("remarksHint")}>
              <Textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            </Field>
            <Field
              label={t("discount")}
              hint={limitPct ? t("discountHintLimit", { pct: format.percent(limitPct) }) : t("discountHint")}
              error={discountValid ? undefined : t("discountFormat")}
              className="w-44"
            >
              <NumberInput
                unit="%"
                inputMode="decimal"
                value={discount}
                disabled={Boolean(memo)}
                onChange={(event) => {
                  setDiscount(event.target.value);
                  setAboveLimit(false);
                }}
              />
            </Field>
            {aboveLimit && !memo ? (
              <Callout tone="warning" title={t("aboveLimit")}>
                {canMemo ? (
                  <Button size="sm" variant="secondary" iconStart="percent" onClick={() => setMemoOpen(true)}>
                    {t("requestMemo")}
                  </Button>
                ) : null}
              </Callout>
            ) : null}
            {memo ? (
              <Callout
                tone={memo.status === "approved" ? "success" : memo.status === "pending_approval" ? "info" : "danger"}
                title={t("memoState", { pct: format.percent(memo.approvedPct ?? memo.requestedPct) })}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <StatusChip map={MEMO_STATUS} value={memo.status} />
                  {memo.approvalId ? (
                    <a href={`/approvals/${memo.approvalId}`} className="text-primary text-sm underline">
                      {t("openApproval")}
                    </a>
                  ) : null}
                  {memo.status === "pending_approval" ? (
                    <Button
                      variant="link"
                      size="sm"
                      loading={refreshMemo.isPending}
                      onClick={() => refreshMemo.mutate()}
                    >
                      {t("refreshMemo")}
                    </Button>
                  ) : null}
                </div>
              </Callout>
            ) : null}
          </div>
        </Card>
      </div>

      <Card padding="lg" className="self-start">
        <CardHeader>
          <CardTitle>{t("summary")}</CardTitle>
        </CardHeader>
        <DescriptionList
          columns={1}
          items={[
            {
              term: t("customer"),
              description: [customer.data.displayName, customer.data.customerCode].filter(Boolean).join(" · "),
            },
            { term: t("quote"), description: <span className="font-mono">{quote.data.quoteCode}</span> },
            { term: t("quantity"), description: format.number(option.quantity) },
            {
              term: t("total"),
              description: <span className="font-semibold tabular-nums">{format.thb(option.grossAmount)}</span>,
            },
            { term: t("validUntil"), description: format.date(quote.data.validUntil) },
          ]}
        />
        {place.error && !aboveLimit ? (
          <Callout tone="danger" title={problemMessage(place.error, t("failed"))} className="mt-4">
            {isApiError(place.error) ? place.error.errors.map((item) => item.message).join(" ") : null}
          </Callout>
        ) : null}
        <Button
          className="mt-4 w-full"
          iconStart="cart"
          loading={place.isPending}
          disabled={!ready}
          onClick={() => place.mutate()}
        >
          {t("place")}
        </Button>
        <p className="text-muted mt-2 text-xs">{t("placeHint")}</p>
      </Card>

      {memoOpen ? (
        <MemoDialog
          customerId={customerId}
          requestedPct={discount}
          onPrepare={ensureInCart}
          onClose={() => setMemoOpen(false)}
          onCreated={(created) => {
            setMemo(created);
            setMemoOpen(false);
          }}
        />
      ) : null}
      {addingAddress ? (
        <AddAddressDialog
          customerId={customerId}
          onClose={() => setAddingAddress(false)}
          onAdded={() => {
            setAddingAddress(false);
            void addressBook.refetch();
          }}
          closeLabel={tCommon("actions.close")}
        />
      ) : null}
    </div>
  );
}

/** A discount above the CS limit, raised as a memo on the customer's cart (D-052, routed by D-162). */
function MemoDialog({
  customerId,
  requestedPct,
  onPrepare,
  onClose,
  onCreated,
}: {
  customerId: string;
  requestedPct: string;
  onPrepare: () => Promise<void>;
  onClose: () => void;
  onCreated: (memo: Memo) => void;
}) {
  const t = useTranslations("cs.memo");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState("");
  const raise = useMutation({
    mutationFn: async () => {
      // The memo prices the cart, so the option must be in it first.
      await onPrepare();
      return (
        await adminBrowserApis().contract.POST("/v1/admin/discount-memos", {
          body: { customerId, requestedPct, reason: reason.trim() },
        })
      ).data!;
    },
    onSuccess: (memo) => {
      toast.success(t("created"));
      onCreated(memo);
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={() => raise.mutate()} loading={raise.isPending} disabled={reason.trim().length < 5}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {raise.error ? <Callout tone="danger" title={problemMessage(raise.error, t("failed"))} /> : null}
        <p className="text-sm">{t("body", { pct: requestedPct })}</p>
        <Field label={t("reason")} hint={t("reasonHint")} required requiredLabel={tCommon("state.required")}>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function AddAddressDialog({
  customerId,
  onClose,
  onAdded,
  closeLabel,
}: {
  customerId: string;
  onClose: () => void;
  onAdded: () => void;
  closeLabel: string;
}) {
  const t = useTranslations("cs.address");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState({
    label: "",
    recipientName: "",
    phone: "",
    line1: "",
    line2: "",
    postcode: "",
    subdistrictId: "",
  });
  const lookup = usePostcodeAreas(values.postcode);
  const geoName = useGeoName();
  const areas = lookup.data ?? [];
  const area = areas.find((candidate) => candidate.subdistrict.id === values.subdistrictId) ?? null;
  // A postcode can straddle provinces; the address needs one, so it waits for the subdistrict then.
  const provinces = [...new Set(areas.map((candidate) => candidate.province.id))];
  const provinceId = area?.province.id ?? (provinces.length === 1 ? provinces[0]! : null);

  const add = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/customers/{customerId}/addresses", {
          params: { path: { customerId } },
          body: {
            kind: "delivery",
            label: values.label,
            recipientName: values.recipientName,
            phone: values.phone,
            line1: values.line1,
            line2: values.line2 || null,
            postcode: values.postcode,
            provinceId: provinceId!,
            subdistrictId: values.subdistrictId || null,
          },
        })
      ).data!,
    onSuccess: onAdded,
  });

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [key]: event.target.value });
  const ready = values.label && values.recipientName && /^0\d{8,9}$/.test(values.phone) && values.line1 && provinceId;

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      closeLabel={closeLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!ready}>
            {tCommon("actions.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {add.error ? (
          <Callout tone="danger" title={problemMessage(add.error, t("failed"))} className="sm:col-span-2" />
        ) : null}
        <Field label={t("label")} required requiredLabel={tCommon("state.required")}>
          <Input value={values.label} onChange={set("label")} />
        </Field>
        <Field label={t("recipient")} required requiredLabel={tCommon("state.required")}>
          <Input value={values.recipientName} onChange={set("recipientName")} />
        </Field>
        <Field label={t("phone")} required requiredLabel={tCommon("state.required")}>
          <Input inputMode="tel" value={values.phone} onChange={set("phone")} />
        </Field>
        <Field
          label={t("postcode")}
          hint={
            geoName(area?.province ?? areas[0]?.province) ??
            (lookup.isError || (lookup.isSuccess && areas.length === 0) ? t("postcodeUnknown") : undefined)
          }
          required
          requiredLabel={tCommon("state.required")}
        >
          <Input
            inputMode="numeric"
            maxLength={5}
            value={values.postcode}
            onChange={(event) =>
              setValues({ ...values, postcode: event.target.value.replace(/\D/g, ""), subdistrictId: "" })
            }
          />
        </Field>
        <Field label={t("line1")} required requiredLabel={tCommon("state.required")} className="sm:col-span-2">
          <Input value={values.line1} onChange={set("line1")} />
        </Field>
        <Field label={t("line2")} className="sm:col-span-2">
          <Input value={values.line2} onChange={set("line2")} />
        </Field>
        {areas.length > 0 ? (
          <Field label={t("subdistrict")} className="sm:col-span-2">
            <Select
              value={values.subdistrictId || undefined}
              onValueChange={(subdistrictId) => setValues({ ...values, subdistrictId })}
              placeholder={t("choose")}
              options={areas.map((candidate) => ({
                value: candidate.subdistrict.id,
                label: [candidate.subdistrict, candidate.district, candidate.province].map(geoName).join(" · "),
              }))}
            />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
