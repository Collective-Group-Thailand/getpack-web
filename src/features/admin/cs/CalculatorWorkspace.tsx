"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { z } from "zod";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { csCalculation, discountMemo, quotationDetail } from "@/lib/api/requests/admin-sales";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { download, problemMessage, QueryError, useCan } from "../console";
import { CalculatorForm, emptyInput, missingFields, type CalculatorInput, type CalculatorKey } from "./forms";

type Calculation = z.output<typeof csCalculation>;
type Result = Calculation["results"][number];
type Quotation = z.output<typeof quotationDetail>;
type Memo = z.output<typeof discountMemo>;

const MAX_TIERS = 6;

/** Compares two percentage strings. A comparison, not arithmetic on money. */
const pctAbove = (value: string, limit: string) => Number(value) > Number(limit);

/**
 * A CS calculator (F2 2.2, A.2.3, A.3): inputs on the left in steps, results on the right as a
 * factory × print type × quantity comparison, and a sticky bar that saves, discounts and turns
 * the chosen row into an order.
 *
 * Nothing here computes a price. The API does (B2.3); it also marks the cheapest and fastest rows,
 * sends the discount CS may give without a memo (D-052, from the setting — never hard-coded), and
 * shows the resulting margin only to roles allowed to see it (D-141).
 */
export function CalculatorWorkspace({ type }: { type: CalculatorKey }) {
  const t = useTranslations("cs.workspace");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const router = useRouter();
  const canQuote = useCan("quotations.manage");
  const canOrder = useCan("orders.create_on_behalf");

  const [customer, setCustomer] = useState<ComboboxOption | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [input, setInput] = useState<CalculatorInput>(() => emptyInput(type));
  const [tiers, setTiers] = useState<number[]>([]);
  const [tierDraft, setTierDraft] = useState("");
  const [postcode, setPostcode] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [discount, setDiscount] = useState("");
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const data = useQuery({
    queryKey: queryKeys.detail("admin", "cs_input", type),
    queryFn: () => browserRequests().call("GET /v1/admin/cs/{type}/input-data", { path: { type } }),
    staleTime: STALE_TIME.reference,
  });

  const customers = useQuery({
    queryKey: queryKeys.list("admin", "customer", { q: customerQuery }),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/customers", { query: { q: customerQuery || undefined, perPage: 10 } }),
    enabled: customerQuery.trim().length >= 2,
  });

  const place = useQuery({
    queryKey: queryKeys.detail("admin", "postcode", postcode),
    queryFn: () => browserRequests().call("GET /v1/admin/geo/postcodes/{postcode}", { path: { postcode } }),
    enabled: /^\d{5}$/.test(postcode),
    staleTime: STALE_TIME.stable,
    retry: false,
  });

  const calculate = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/cs/{type}/calculate", {
        path: { type },
        body: { customerId: customer?.value, postcode, quantities: tiers, input: input as never },
      }),
    onSuccess: (result) => {
      setSelected(result.results.find((row) => row.cheapest)?.id ?? result.results[0]?.id ?? null);
      setQuote(null);
      setMemo(null);
    },
  });

  const calculation = calculate.data;
  const row = calculation?.results.find((candidate) => candidate.id === selected) ?? null;
  const limit = data.data?.discountPolicy.directLimitPct ?? "0";
  const discountValid = discount === "" || /^\d+(\.\d{1,2})?$/.test(discount);
  const needsMemo = discountValid && discount !== "" && pctAbove(discount, limit);

  const save = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/quotations", {
        body: {
          calculationId: calculation!.calculationId,
          resultId: row!.id,
          customerId: customer!.value,
          ...(memo?.status === "approved"
            ? { discountMemoId: memo.id }
            : discount && !needsMemo
              ? { discountPct: discount }
              : {}),
        },
      }),
    onSuccess: (saved) => {
      setQuote(saved);
      toast.success(t("saved", { code: saved.quoteCode }));
    },
    onError: (error) => toast.error(problemMessage(error, t("saveFailed"))),
  });

  const exportPdf = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/quotations/{quoteId}/actions/export-pdf", {
        path: { quoteId: quote!.id },
      }),
    onSuccess: (file) => download(file.url),
    onError: (error) => toast.error(problemMessage(error, t("exportFailed"))),
  });

  const refreshMemo = useMutation({
    mutationFn: async () => {
      // The memo list follows its approval; fetch it through the list so the status is current.
      const list = await browserRequests().call("GET /v1/admin/discount-memos", { query: { q: memo!.memoCode } });
      return list.data.find((candidate) => candidate.id === memo!.id) ?? memo!;
    },
    onSuccess: (current) => setMemo(current),
  });

  if (data.isError) return <QueryError error={data.error} onRetry={() => void data.refetch()} />;
  if (!data.data) return <Skeleton className="h-[40rem]" />;

  const missing = missingFields(input);
  const ready = missing.length === 0 && tiers.length > 0 && /^\d{5}$/.test(postcode);
  const byQuantity = [...new Set(calculation?.results.map((result) => result.quantity) ?? [])];

  return (
    <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">
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
                description: [item.customerCode, item.phone, item.companyName].filter(Boolean).join(" · "),
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
          <CalculatorForm data={data.data} value={input} onChange={setInput} />
        </Card>

        <Card padding="md">
          <CardHeader>
            <CardTitle>{t("steps.quantities")}</CardTitle>
          </CardHeader>
          <p className="text-muted mb-2 text-xs">{t("tiersHint", { max: MAX_TIERS })}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("presets")}>
            {data.data.quantityPresets.map((preset) => {
              const on = tiers.includes(preset);
              return (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={on ? "primary" : "secondary"}
                  aria-pressed={on}
                  disabled={!on && tiers.length >= MAX_TIERS}
                  onClick={() =>
                    setTiers(on ? tiers.filter((tier) => tier !== preset) : [...tiers, preset].sort((a, b) => a - b))
                  }
                >
                  {format.number(preset)}
                </Button>
              );
            })}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <Field label={t("customQuantity")} className="flex-1">
              <NumberInput min={1} value={tierDraft} onChange={(event) => setTierDraft(event.target.value)} />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={!Number(tierDraft) || tiers.length >= MAX_TIERS}
              onClick={() => {
                const value = Math.floor(Number(tierDraft));
                if (value > 0 && !tiers.includes(value)) setTiers([...tiers, value].sort((a, b) => a - b));
                setTierDraft("");
              }}
            >
              {t("addQuantity")}
            </Button>
          </div>
          {tiers.filter((tier) => !data.data!.quantityPresets.includes(tier)).length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label={t("custom")}>
              {tiers
                .filter((tier) => !data.data!.quantityPresets.includes(tier))
                .map((tier) => (
                  <li key={tier}>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      iconEnd="close"
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
            hint={place.data ? place.data.province : place.isError ? t("postcodeUnknown") : t("postcodeHint")}
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
          <Callout tone="danger" title={calculate.error.detail}>
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
                ...(/^\d{5}$/.test(postcode) ? [] : [t("missing.postcode")]),
              ].join(", "),
            })}
          </p>
        ) : null}
      </form>

      <div className="flex min-w-0 flex-col gap-4">
        {!calculation ? (
          <EmptyState icon="calculator" title={t("noResultsTitle")} description={t("noResultsBody")} />
        ) : (
          <>
            {calculation.routeToRfq ? (
              <Callout tone="warning" title={t("routeToRfq")}>
                <Link href="/rfq" className="text-primary underline">
                  {t("openRfq")}
                </Link>
              </Callout>
            ) : null}
            {calculation.notes.map((note) => (
              <Callout key={note} tone="info" title={note} />
            ))}
            {byQuantity.map((quantity) => (
              <Card key={quantity} padding="md">
                <CardHeader>
                  <CardTitle>{t("forQuantity", { quantity: format.number(quantity) })}</CardTitle>
                </CardHeader>
                <div
                  role="region"
                  aria-label={t("forQuantity", { quantity: format.number(quantity) })}
                  tabIndex={0}
                  className="overflow-x-auto"
                >
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t("forQuantity", { quantity: format.number(quantity) })}</caption>
                    <thead>
                      <tr className="text-muted border-border border-b text-xs">
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          <span className="sr-only">{t("choose")}</span>
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("columns.option")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-end font-medium">
                          {t("columns.perPiece")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-end font-medium">
                          {t("columns.oneOff")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-end font-medium">
                          {t("columns.shipping")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-end font-medium">
                          {t("columns.vat")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-end font-medium">
                          {t("columns.total")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("columns.lead")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.results
                        .filter((result) => result.quantity === quantity)
                        .map((result) => (
                          <ResultRow
                            key={result.id}
                            result={result}
                            selected={selected === result.id}
                            onSelect={() => setSelected(result.id)}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </>
        )}

        {calculation && row ? (
          <div
            className="border-border bg-surface-raised z-sticky shadow-overlay sticky bottom-0 flex flex-col gap-3 rounded-lg border p-4"
            role="region"
            aria-label={t("actionBar")}
          >
            <p className="text-sm">
              {t("chosen", {
                option: `${row.printType.name} · ${format.number(row.quantity)}`,
                total: format.thb(row.grossAmount),
              })}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Field
                label={t("discount")}
                hint={t("discountHint", { limit: format.percent(limit) })}
                error={discountValid ? undefined : t("discountFormat")}
                className="w-44"
              >
                <NumberInput
                  unit="%"
                  inputMode="decimal"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  disabled={Boolean(quote)}
                />
              </Field>
              {row.marginPct ? (
                <p className="text-muted pb-2 text-xs">{t("margin", { pct: format.percent(row.marginPct) })}</p>
              ) : null}
              {needsMemo && !memo ? (
                <Button variant="secondary" iconStart="percent" onClick={() => setMemoOpen(true)} disabled={!customer}>
                  {t("requestMemo")}
                </Button>
              ) : null}
              <div className="ms-auto flex flex-wrap gap-2">
                {quote ? (
                  <>
                    <Button
                      variant="secondary"
                      iconStart="download"
                      loading={exportPdf.isPending}
                      onClick={() => exportPdf.mutate()}
                    >
                      {t("exportPdf")}
                    </Button>
                    {canOrder ? (
                      <Button
                        iconStart="cart"
                        onClick={() => router.push(`/orders/new?quote=${quote.id}&quantity=${row.quantity}`)}
                      >
                        {t("createOrder")}
                      </Button>
                    ) : null}
                  </>
                ) : canQuote ? (
                  <Button
                    iconStart="save"
                    loading={save.isPending}
                    disabled={!customer || !discountValid || (needsMemo && memo?.status !== "approved")}
                    onClick={() => save.mutate()}
                  >
                    {t("saveQuotation")}
                  </Button>
                ) : null}
              </div>
            </div>
            {!customer ? <p className="text-muted text-xs">{t("needCustomer")}</p> : null}
            {memo ? (
              <Callout
                tone={memo.status === "approved" ? "success" : memo.status === "pending_approval" ? "info" : "danger"}
                title={t(
                  `memo.${memo.status === "approved" ? "approved" : memo.status === "pending_approval" ? "pending" : "closed"}`,
                  { code: memo.memoCode, pct: format.percent(memo.approvedPct ?? memo.requestedPct) },
                )}
              >
                <div className="flex gap-3">
                  {memo.approvalRequestId ? (
                    <Link href={`/approvals/${memo.approvalRequestId}`} className="text-primary text-sm underline">
                      {t("memo.open")}
                    </Link>
                  ) : null}
                  {memo.status === "pending_approval" ? (
                    <Button
                      variant="link"
                      size="sm"
                      loading={refreshMemo.isPending}
                      onClick={() => refreshMemo.mutate()}
                    >
                      {t("memo.refresh")}
                    </Button>
                  ) : null}
                </div>
              </Callout>
            ) : null}
            {quote ? (
              <Callout
                tone="success"
                title={t("quoteReady", { code: quote.quoteCode, until: format.date(quote.validUntil) })}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {memoOpen && calculation && row && customer ? (
        <MemoDialog
          calculationId={calculation.calculationId}
          resultId={row.id}
          customerId={customer.value}
          requestedPct={discount}
          limit={limit}
          onClose={() => setMemoOpen(false)}
          onCreated={(created) => {
            setMemo(created);
            setMemoOpen(false);
          }}
        />
      ) : null}
      {creatingCustomer ? (
        <CreateCustomerDialog
          onClose={() => setCreatingCustomer(false)}
          onCreated={(created) => {
            setCustomer({ value: created.id, label: created.displayName, description: created.customerCode });
            setCreatingCustomer(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ResultRow({ result, selected, onSelect }: { result: Result; selected: boolean; onSelect: () => void }) {
  const t = useTranslations("cs.workspace");
  const format = useFormat();
  const oneOff = [result.plateAmount, result.dieBlockAmount, result.designFeeAmount].filter(
    (amount) => amount !== "0.00",
  );
  return (
    <tr className={cn("border-border border-b last:border-0", selected && "bg-primary-subtle/40")}>
      <td className="px-2 py-2">
        <input
          type="radio"
          name={`option-${result.quantity}`}
          className="accent-primary size-4"
          checked={selected}
          onChange={onSelect}
          aria-label={t("chooseRow", { option: `${result.printType.name} ${result.quantity}` })}
        />
      </td>
      <td className="px-2 py-2">
        <p className="font-medium">{result.printType.name}</p>
        <p className="text-muted text-xs">{result.factory.name}</p>
        <span className="mt-1 flex flex-wrap gap-1">
          {result.cheapest ? (
            <Badge size="sm" tone="success" icon="coins">
              {t("cheapest")}
            </Badge>
          ) : null}
          {result.fastest ? (
            <Badge size="sm" tone="info" icon="timer">
              {t("fastest")}
            </Badge>
          ) : null}
          {result.belowMarginFloor ? (
            <Badge size="sm" tone="danger" icon="warning">
              {t("belowFloor")}
            </Badge>
          ) : null}
        </span>
      </td>
      <td className="px-2 py-2 text-end tabular-nums">
        {format.thb(result.unitPrice)}
        <p className="text-muted text-xs">{t("withDelivery", { price: format.thb(result.perPieceWithDelivery) })}</p>
      </td>
      <td className="px-2 py-2 text-end tabular-nums">
        {oneOff.length > 0 ? oneOff.map((amount) => format.thb(amount)).join(" + ") : "—"}
      </td>
      <td className="px-2 py-2 text-end tabular-nums">{format.thb(result.shippingAmount)}</td>
      <td className="px-2 py-2 text-end tabular-nums">{format.thb(result.vatAmount)}</td>
      <td className="px-2 py-2 text-end font-semibold tabular-nums">{format.thb(result.grossAmount)}</td>
      <td className="px-2 py-2 text-xs">
        {t("leadDays", { days: result.leadTimeDays })}
        <p className="text-muted">{t("earliest", { date: format.date(result.earliestShipDate) })}</p>
      </td>
    </tr>
  );
}

function MemoDialog({
  calculationId,
  resultId,
  customerId,
  requestedPct,
  limit,
  onClose,
  onCreated,
}: {
  calculationId: string;
  resultId: string;
  customerId: string;
  requestedPct: string;
  limit: string;
  onClose: () => void;
  onCreated: (memo: Memo) => void;
}) {
  const t = useTranslations("cs.memo");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const create = useMutation({
    mutationFn: async () => {
      const uploaded = await Promise.all(files.map((file) => uploadFile("admin", file, "evidence")));
      return browserRequests().call("POST /v1/admin/discount-memos", {
        body: {
          calculationId,
          resultId,
          customerId,
          requestedPct,
          reason: reason.trim(),
          evidenceFileIds: uploaded.map((file) => file.id),
        },
      });
    },
    onSuccess: (memo) => {
      toast.success(t("created", { code: memo.memoCode }));
      onCreated(memo);
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      description={t("description", { pct: format.percent(requestedPct), limit: format.percent(limit) })}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={reason.trim().length < 3}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error ? <Callout tone="danger" title={problemMessage(create.error, t("failed"))} /> : null}
        <Callout tone="info" title={t("routing")} />
        <Field label={t("reason")} hint={t("reasonHint")} required requiredLabel={tCommon("state.required")}>
          <Textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Field label={t("evidence")} hint={t("evidenceHint")}>
          <FileDropzone
            multiple
            accept="image/*,application/pdf"
            maxBytes={10 * 1024 * 1024}
            onFiles={(picked) => setFiles((current) => [...current, ...picked].slice(0, 10))}
            labels={{
              prompt: t("drop"),
              browse: t("browse"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
        </Field>
        {files.length > 0 ? (
          <ul className="text-sm">
            {files.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Dialog>
  );
}

export function CreateCustomerDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: { id: string; displayName: string; customerCode: string }) => void;
}) {
  const t = useTranslations("cs.newCustomer");
  const tCommon = useTranslations("common");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] = useState<"individual" | "juristic">("individual");

  const create = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/customers", {
        body: { displayName: displayName.trim(), phone, ...(email ? { email } : {}), customerType },
      }),
    onSuccess: (created) => {
      toast.success(t("created", { code: created.customerCode }));
      onCreated(created);
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
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!displayName.trim() || !/^0\d{8,9}$/.test(phone)}
          >
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error ? <Callout tone="danger" title={problemMessage(create.error, t("failed"))} /> : null}
        <Field label={t("name")} required requiredLabel={tCommon("state.required")}>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </Field>
        <Field label={t("phone")} hint={t("phoneHint")} required requiredLabel={tCommon("state.required")}>
          <Input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={t("email")}>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label={t("type")}>
          <div className="flex gap-4 text-sm">
            {(["individual", "juristic"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-primary size-4"
                  name="customer-type"
                  checked={customerType === value}
                  onChange={() => setCustomerType(value)}
                />
                {t(`types.${value}`)}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}
