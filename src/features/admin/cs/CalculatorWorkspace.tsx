"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, useCan, useProductTypes } from "../console";
import { useGeoName, usePostcodeAreas } from "../customers/geo";
import { isPublished, type CalculatorKey, type PublishedCalculator } from "./calculators";
import { emptySelection, missingFields, toConfiguration, type Selection } from "./configuration";
import { CreateCustomerDialog } from "./CreateCustomerDialog";
import { CalculatorForm } from "./forms";
import { useQuotePdf } from "./pdf";

type Step = Schemas["AdminQuoteStepDto"];
type Quote = Schemas["AdminSavedQuoteDto"];

/** Tiers CS compares at once when no catalogue product says otherwise (its `quantity.maxTiers`). */
const MAX_TIERS = 5;

/**
 * The CS calculator (F2 2.2) on packio-api's published calculators (U-F0.3): folding and corrugate
 * price for real (`admin.csFolding.calculate`, `admin.csCorrugate.calculate`); every other type is
 * RFQ-only until its calculator ships (U-B6), and a type the catalogue marks `rfq` is RFQ-only too.
 * The API picks the factory and print type per quantity and prices it; the desk shows exactly what
 * it answers, never a figure of its own.
 */
export function CalculatorWorkspace({ type }: { type: CalculatorKey }) {
  const t = useTranslations("cs.workspace");
  const { types, isPending } = useProductTypes();
  const instant = types.filter((row) => row.calculatorKey === type && row.quoteMode === "instant");
  if (isPending) return <Skeleton className="h-[40rem]" />;
  if (!isPublished(type) || instant.length === 0) {
    return (
      <Callout tone="info" title={t("rfqOnlyTitle")}>
        <p>{isPublished(type) ? t("rfqOnlyByCatalogue") : t("rfqOnlyNotPublished")}</p>
        <Link href="/rfq" className="text-primary underline">
          {t("openRfq")}
        </Link>
      </Callout>
    );
  }
  return <Workspace calculator={type} productTypes={instant} />;
}

function Workspace({
  calculator,
  productTypes,
}: {
  calculator: PublishedCalculator;
  productTypes: Schemas["ProductTypeDto"][];
}) {
  const t = useTranslations("cs.workspace");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const geoName = useGeoName();
  const canQuote = useCan("quotes.manage");
  const canOrder = useCan("carts.manage_on_behalf");
  const [customer, setCustomer] = useState<ComboboxOption | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [productTypeCode, setProductTypeCode] = useState(productTypes[0]!.code);
  const [selection, setSelection] = useState<Selection>(() => emptySelection(calculator));
  const [tiers, setTiers] = useState<number[]>([]);
  const [tierDraft, setTierDraft] = useState("");
  const [postcode, setPostcode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [note, setNote] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const data = useQuery({
    queryKey: queryKeys.detail("admin", "cs_input", calculator),
    queryFn: async () =>
      calculator === "folding"
        ? (await adminBrowserApis().contract.GET("/v1/admin/cs/folding/input-data")).data!
        : (await adminBrowserApis().contract.GET("/v1/admin/cs/corrugate/input-data")).data!,
    staleTime: STALE_TIME.reference,
  });

  const customers = useQuery({
    queryKey: queryKeys.list("admin", "customer", { q: customerQuery }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers", {
          params: { query: { q: customerQuery || undefined, perPage: 10 } },
        })
      ).data!,
    enabled: customerQuery.trim().length >= 2,
  });

  const place = usePostcodeAreas(postcode);
  const placeName = geoName(place.data?.[0]?.province);
  const deliveryPostcode = /^\d{5}$/.test(postcode) ? postcode : undefined;

  const calculate = useMutation({
    mutationFn: async () => {
      const { contract } = adminBrowserApis();
      const params = { query: { deliveryPostcode } };
      const configuration = toConfiguration(selection, tiers);
      return selection.calculator === "folding"
        ? (
            await contract.POST("/v1/admin/cs/folding/calculate", {
              params,
              body: configuration as Schemas["FoldingConfigurationDto"],
            })
          ).data!
        : (
            await contract.POST("/v1/admin/cs/corrugate/calculate", {
              params,
              body: configuration as Schemas["CsCorrugateConfigurationDto"],
            })
          ).data!;
    },
    onSuccess: () => setQuote(null),
  });

  const save = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/quotes", {
          body: {
            productTypeCode,
            // The saved quotation re-prices the configuration: nothing from the table is sent back.
            configuration: toConfiguration(selection, tiers) as Schemas["StaffSaveQuoteDto"]["configuration"],
            customerUserId: customer!.value,
            ...(deliveryPostcode ? { deliveryPostcode } : {}),
            // CS's internal note (v0.5.0); the customer never sees it.
            ...(note.trim() ? { note: note.trim() } : {}),
          },
        })
      ).data!,
    onSuccess: (saved) => {
      setQuote(saved);
      toast.success(t("saved", { code: saved.quoteCode ?? "" }));
    },
    onError: (error) => toast.error(problemMessage(error, t("saveFailed"))),
  });

  const pdf = useQuotePdf(quote?.id, (error) => toast.error(problemMessage(error, t("exportFailed"))));

  if (data.isError) return <QueryError error={data.error} onRetry={() => void data.refetch()} />;
  if (!data.data) return <Skeleton className="h-[40rem]" />;

  const pattern = data.data.patterns.find((row) => row.id === selection.patternId);
  const product = data.data.catalogProducts.find((row) => row.id === selection.catalogProductId);
  // A catalogue product brings its own quantity presets, bounds and tier count (v0.5.0).
  const maxTiers = product?.quantity.maxTiers ?? MAX_TIERS;
  const minQuantity = product?.quantity.min ?? null;
  const maxQuantity = product?.quantity.max ?? null;
  const addTier = (quantity: number) => {
    const value = Math.floor(quantity);
    if (value > 0 && !tiers.includes(value) && tiers.length < maxTiers)
      setTiers([...tiers, value].sort((a, b) => a - b));
  };
  const draft = Number(tierDraft);
  const draftOutside =
    Boolean(draft) && ((minQuantity !== null && draft < minQuantity) || (maxQuantity !== null && draft > maxQuantity));
  const missing = missingFields(selection, pattern?.rules);
  const ready = missing.length === 0 && tiers.length > 0;
  const calculation = calculate.data;
  const priced = calculation?.steps.some((step) => step.instant) ?? false;

  return (
    // 7:5, as the customer's configurator (UX audit, CS calculator): the steps on the left, the result
    // and its actions on the right, sticky so they stay in view while the form scrolls.
    <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) calculate.mutate();
        }}
      >
        <Card padding="md">
          <CardHeader>
            <CardTitle>{t("steps.customer")}</CardTitle>
          </CardHeader>
          <Field label={t("customer")} hint={t("customerHint")}>
            <Combobox
              value={customer}
              onValueChange={setCustomer}
              query={customerQuery}
              onQueryChange={setCustomerQuery}
              loading={customers.isFetching}
              options={(customers.data?.data ?? []).map((item) => ({
                value: item.id,
                label: item.displayName,
                description: [item.customerCode, item.phone].filter(Boolean).join(" · "),
              }))}
              placeholder={t("customerPlaceholder")}
              labels={{ loading: tCommon("state.loading"), empty: t("noCustomer"), clear: t("clearCustomer") }}
            />
          </Field>
          <Button type="button" variant="link" size="sm" className="mt-1" onClick={() => setCreatingCustomer(true)}>
            {t("newCustomer")}
          </Button>
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>{t("steps.configuration")}</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {productTypes.length > 1 ? (
              <Field label={t("productType")}>
                <Select
                  value={productTypeCode}
                  onValueChange={setProductTypeCode}
                  options={productTypes.map((row) => ({ value: row.code, label: row.nameTh }))}
                />
              </Field>
            ) : null}
            <CalculatorForm data={data.data} value={selection} onChange={setSelection} />
          </div>
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>{t("steps.quantities")}</CardTitle>
          </CardHeader>
          <p className="text-muted mb-2 text-xs">{t("tiersHint", { max: maxTiers })}</p>
          {product && product.quantity.presets.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label={t("presets")}>
              {product.quantity.presets.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={tiers.includes(preset) ? "primary" : "secondary"}
                  disabled={!tiers.includes(preset) && tiers.length >= maxTiers}
                  aria-pressed={tiers.includes(preset)}
                  onClick={() =>
                    tiers.includes(preset) ? setTiers(tiers.filter((item) => item !== preset)) : addTier(preset)
                  }
                >
                  {format.number(preset)}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <Field
              label={t("customQuantity")}
              className="flex-1"
              hint={
                minQuantity !== null && maxQuantity !== null
                  ? t("quantityRange", { min: format.number(minQuantity), max: format.number(maxQuantity) })
                  : undefined
              }
              error={draftOutside ? t("quantityOutside") : undefined}
            >
              <NumberInput min={1} value={tierDraft} onChange={(event) => setTierDraft(event.target.value)} />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={!draft || draftOutside || tiers.length >= maxTiers}
              onClick={() => {
                addTier(draft);
                setTierDraft("");
              }}
            >
              {t("addQuantity")}
            </Button>
          </div>
          {tiers.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label={t("custom")}>
              {tiers.map((tier) => (
                <li key={tier}>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    iconEnd="close"
                    aria-label={t("removeQuantity", { quantity: format.number(tier) })}
                    onClick={() => setTiers(tiers.filter((item) => item !== tier))}
                  >
                    {format.number(tier)}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>{t("steps.delivery")}</CardTitle>
          </CardHeader>
          <Field
            label={t("postcode")}
            hint={
              placeName ??
              (place.isError || (place.isSuccess && place.data.length === 0) ? t("postcodeUnknown") : t("postcodeHint"))
            }
            error={postcode && !/^\d{0,5}$/.test(postcode) ? t("postcodeFormat") : undefined}
          >
            <Input
              inputMode="numeric"
              maxLength={5}
              value={postcode}
              onChange={(event) => setPostcode(event.target.value.replace(/\D/g, ""))}
            />
          </Field>
        </Card>

        {calculate.error && isApiError(calculate.error) ? (
          <Callout tone="danger" title={problemMessage(calculate.error, t("calculateFailed"))}>
            {calculate.error.errors.length > 0 ? (
              <ul>
                {calculate.error.errors.map((item) => (
                  <li key={item.path}>{item.message}</li>
                ))}
              </ul>
            ) : null}
          </Callout>
        ) : null}
        <Button type="submit" loading={calculate.isPending} disabled={!ready} className="w-full">
          {t("calculate")}
        </Button>
        {!ready ? (
          <p className="text-muted text-xs">
            {t("toCalculate", {
              missing: [
                ...missing.map((key) => t(`missing.${key}`)),
                ...(tiers.length === 0 ? [t("missing.quantities")] : []),
              ].join(", "),
            })}
          </p>
        ) : null}
      </form>

      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        {!calculation ? (
          <EmptyState icon="calculator" title={t("noResultsTitle")} description={t("noResultsBody")} />
        ) : (
          <Card padding="md">
            <CardHeader>
              <CardTitle>{t("results")}</CardTitle>
            </CardHeader>
            {!priced ? (
              <Callout tone="warning" title={t("routeToRfq")} className="mb-3">
                <Link href="/rfq" className="text-primary underline">
                  {t("openRfq")}
                </Link>
              </Callout>
            ) : null}
            <div role="region" aria-label={t("results")} tabIndex={0} className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("results")}</caption>
                <thead>
                  <tr className="text-muted border-border border-b text-xs">
                    {(["quantity", "perPiece", "product", "oneOff", "shipping", "vat", "total", "lead"] as const).map(
                      (column) => (
                        <th
                          key={column}
                          scope="col"
                          className={`px-2 py-2 font-medium ${column === "quantity" || column === "lead" ? "text-start" : "text-end"}`}
                        >
                          {t(`columns.${column}`)}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {calculation.steps.map((step) => (
                    <StepRow key={step.quantity} step={step} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {calculation && priced ? (
          <div
            className="border-border bg-surface-raised z-sticky shadow-overlay sticky bottom-0 flex flex-col gap-3 rounded-lg border p-4"
            role="region"
            aria-label={t("actionBar")}
          >
            {/* The discount is given at checkout, where the memo prices the customer's cart (D-052);
                the limit CS gives on its own is the API's setting, as the input data states it. */}
            <p className="text-muted text-xs">
              {t("discountAtCheckoutLimit", { pct: format.percent(data.data.discountPolicy.directLimitPct) })}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              {quote ? (
                <>
                  <Callout
                    tone="success"
                    className="flex-1"
                    title={t("quoteReady", { code: quote.quoteCode ?? "", until: format.date(quote.validUntil) })}
                  />
                  <Button variant="secondary" iconStart="download" loading={pdf.isPending} onClick={() => pdf.mutate()}>
                    {t("exportPdf")}
                  </Button>
                  {canOrder ? (
                    <Button iconStart="cart" asChild>
                      <Link href={`/quotations/${quote.id}`}>{t("createOrder")}</Link>
                    </Button>
                  ) : null}
                </>
              ) : canQuote ? (
                <>
                  <Field label={t("note")} hint={t("noteHint")} className="min-w-60 flex-1">
                    <Input value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
                  </Field>
                  <Button iconStart="save" loading={save.isPending} disabled={!customer} onClick={() => save.mutate()}>
                    {t("saveQuotation")}
                  </Button>
                </>
              ) : null}
            </div>
            {!customer && !quote ? <p className="text-muted text-xs">{t("needCustomer")}</p> : null}
          </div>
        ) : null}
      </div>

      {creatingCustomer ? (
        <CreateCustomerDialog
          onClose={() => setCreatingCustomer(false)}
          onCreated={(created) => {
            setCustomer({
              value: created.id,
              label: created.displayName,
              description: created.customerCode ?? undefined,
            });
            setCreatingCustomer(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** One quantity as the API priced it — or why it could not (D-043: no price path → RFQ). */
function StepRow({ step }: { step: Step }) {
  const t = useTranslations("cs.workspace");
  const format = useFormat();
  const cell = "px-2 py-2 text-end tabular-nums";
  if (!step.instant) {
    return (
      <tr className="border-border border-b">
        <td className="px-2 py-2 tabular-nums">{format.number(step.quantity)}</td>
        <td colSpan={7} className="text-muted px-2 py-2">
          {t(`noPrice.${step.reason ?? "not_priceable"}`)}
        </td>
      </tr>
    );
  }
  const oneOff = [step.designFeeAmount, step.structureDesignFeeAmount, step.toolingAmount].filter(
    (amount) => amount && amount !== "0.00",
  );
  const margin = step.internal?.marginPct ?? null;
  return (
    <tr className="border-border border-b">
      <td className="px-2 py-2 tabular-nums">
        {format.number(step.quantity)}
        {margin ? (
          <Badge size="sm" tone={step.internal?.belowMarginFloor ? "danger" : "neutral"} className="ms-2">
            {t("margin", { pct: format.percent(margin) })}
          </Badge>
        ) : null}
      </td>
      <td className={cell}>{format.thb(step.unitPrice)}</td>
      <td className={cell}>{format.thb(step.productAmount)}</td>
      <td className={cell}>
        {oneOff.length ? oneOff.map((amount, index) => <div key={index}>{format.thb(amount)}</div>) : "—"}
        {step.toolingAmount && step.toolingAmount !== "0.00" ? (
          <div className="text-muted text-xs">{t("tooling", { amount: format.thb(step.toolingAmount) })}</div>
        ) : null}
      </td>
      <td className={cell}>
        {step.shippingPending ? (
          <span className="text-muted text-xs">
            {t(`shippingPending.${step.shippingPendingReason ?? "no_postcode"}`)}
          </span>
        ) : (
          format.thb(step.shippingAmount)
        )}
      </td>
      <td className={cell}>{format.thb(step.vatAmount)}</td>
      <td className={`${cell} font-medium`}>{format.thb(step.grossAmount)}</td>
      <td className="px-2 py-2 text-xs">
        {step.leadTimeDays === null ? "—" : t("leadDays", { days: step.leadTimeDays })}
        {step.earliestShipDate ? (
          <div className="text-muted">{t("earliest", { date: format.date(step.earliestShipDate) })}</div>
        ) : null}
      </td>
    </tr>
  );
}
