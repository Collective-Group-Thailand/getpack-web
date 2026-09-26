"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { z } from "zod";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import type { checkoutInput } from "@/lib/api/requests/store-checkout";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field, FormSection } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { PriceSummary, type PriceRow } from "@/ui/components/PriceSummary";
import { RadioCards } from "@/ui/components/RadioCards";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";

import type { Address } from "../account/AddressForm";
import { formatTaxId } from "../account/tax-id";
import type { TaxProfile } from "../account/TaxProfileForm";
import { useDebounced } from "../configurator/pricing";

const AddressSheet = dynamic(() => import("../cart/AddressSheet").then((module) => module.AddressSheet), {
  ssr: false,
});
const TaxProfileSheet = dynamic(() => import("./TaxProfileSheet").then((module) => module.TaxProfileSheet), {
  ssr: false,
});

type Input = z.input<typeof checkoutInput>;
type Preview = ResponseOf<Requests, "POST /v1/store/checkout/actions/preview">;
type PaymentMethod = Preview["paymentMethods"][number]["method"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
const NO_TAX = "__receipt__";

export interface CheckoutViewProps {
  contact: { name: string; phone: string; email: string };
  addresses: Address[];
  taxProfiles: TaxProfile[];
  /** Whether the cart already splits lines across addresses — then that is the default. */
  cartSplits: boolean;
}

/**
 * The checkout (F3 3.3): contact → delivery → tax invoice → promotions → points → payment schedule
 * → method → review, on one page so nothing typed is asked for twice (WCAG 3.3.7). Every figure is
 * the API's preview, asked for again after each change; placing re-prices, and if anything moved
 * the customer sees the old and new totals and confirms again (design-system.md §1.3).
 */
export function CheckoutView({
  contact: initialContact,
  addresses: initialAddresses,
  taxProfiles: initialProfiles,
  cartSplits,
}: CheckoutViewProps) {
  const t = useTranslations("checkout");
  const tMethods = useTranslations("checkout.methods");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [contact, setContact] = useState(initialContact);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [profiles, setProfiles] = useState(initialProfiles);
  const defaultAddress = initialAddresses.find((address) => address.isDefault) ?? initialAddresses[0];
  const [mode, setMode] = useState<"shared" | "per_item">(cartSplits || !defaultAddress ? "per_item" : "shared");
  const [addressId, setAddressId] = useState(defaultAddress?.id ?? "");
  const [taxProfileId, setTaxProfileId] = useState<string>(
    initialProfiles.find((profile) => profile.isDefault)?.id ?? NO_TAX,
  );
  const [codes, setCodes] = useState<string[]>([]);
  const [codeDraft, setCodeDraft] = useState("");
  const [points, setPoints] = useState(0);
  const [scheduleKey, setScheduleKey] = useState<string | undefined>(undefined);
  const [method, setMethod] = useState<PaymentMethod>("scb_qr");
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<"address" | "tax" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [repriced, setRepriced] = useState<{ before: Preview["totals"] } | null>(null);
  const idempotencyKey = useRef(newKey());

  const input: Input = {
    contact,
    delivery: mode === "shared" && addressId ? { mode: "shared", addressId } : { mode: "per_item" },
    taxProfileId: taxProfileId === NO_TAX ? null : taxProfileId,
    couponCodes: codes,
    pointsToRedeem: points,
    ...(scheduleKey ? { scheduleKey } : {}),
    paymentMethod: method,
    ...(note.trim() ? { note: note.trim() } : {}),
  };
  const key = JSON.stringify(input);
  const settled = useDebounced(key, 400);
  const preview = useQuery({
    queryKey: [...queryKeys.resource("customer", "checkout-preview"), settled],
    queryFn: ({ signal }) =>
      browserRequests().call("POST /v1/store/checkout/actions/preview", { body: JSON.parse(settled) as Input, signal }),
    placeholderData: (previous) => previous,
    staleTime: 0,
  });
  const data = preview.data;
  const pending = key !== settled || preview.isFetching;

  const contactValid =
    contact.name.trim() !== "" && /^0\d{8,9}$/.test(contact.phone) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email);
  const canPlace = Boolean(data) && !pending && contactValid && data!.blockers.length === 0;

  async function place() {
    if (!data) return;
    setPlacing(true);
    setFailure(null);
    try {
      const placed = await browserRequests().call("POST /v1/store/checkout", {
        body: { ...input, previewToken: data.previewToken },
        idempotencyKey: idempotencyKey.current,
      });
      track("order_placed", { route: "/checkout", quoteMode: "instant" });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
      if (!placed.firstInstalment) {
        router.push(`/account/orders?placed=${encodeURIComponent(placed.groupCode)}`);
        return;
      }
      const payment = await browserRequests().call("POST /v1/store/instalments/{instalmentId}/payments", {
        path: { instalmentId: placed.firstInstalment.id },
        body: {
          method,
          returnUrl: `${window.location.origin}${window.location.pathname.replace(/\/checkout.*$/, "")}/checkout/return`,
        },
        idempotencyKey: `${idempotencyKey.current}:pay`,
      });
      router.push(`/checkout/pay/${payment.id}`);
    } catch (error) {
      setConfirming(false);
      if (isApiError(error) && (error.code === "checkout.repriced" || error.code === "checkout.preview_expired")) {
        // Priced again from scratch: the customer sees both totals and confirms the new one.
        setRepriced({ before: data.totals });
        idempotencyKey.current = newKey();
        await preview.refetch();
      } else {
        if (isApiError(error)) idempotencyKey.current = newKey();
        setFailure(isApiError(error) ? error.detail : t("failed"));
      }
      setPlacing(false);
    }
  }

  const totalsRows = (totals: Preview["totals"]): PriceRow[] => [
    { label: t("summary.items"), value: format.thb(totals.itemsAmount) },
    ...(totals.discountAmount !== "0.00"
      ? [
          {
            label: t("summary.discount"),
            value: t("summary.minus", { amount: format.thb(totals.discountAmount) }),
            tone: "discount" as const,
          },
        ]
      : []),
    ...(totals.shippingAmount !== "0.00"
      ? [{ label: t("summary.shipping"), value: format.thb(totals.shippingAmount) }]
      : []),
    ...(totals.pointsAmount !== "0.00"
      ? [
          {
            label: t("summary.points"),
            value: t("summary.minus", { amount: format.thb(totals.pointsAmount) }),
            tone: "discount" as const,
          },
        ]
      : []),
    {
      label: t("summary.vat"),
      value: format.thb(totals.vatAmount),
      tone: "muted" as const,
      hint: t("summary.vatHint"),
    },
    ...(totals.withholdingAmount !== "0.00"
      ? [
          {
            label: t("summary.withholding"),
            value: t("summary.minus", { amount: format.thb(totals.withholdingAmount) }),
            hint: t("summary.withholdingHint"),
          },
        ]
      : []),
  ];

  const schedule = data?.schedule.options.find((option) => option.key === data.schedule.selectedKey);

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-10">
        <FormSection title={t("contact.title")} description={t("contact.hint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("contact.name")}
              required
              requiredLabel={t("requiredMark")}
              error={contact.name.trim() ? undefined : t("contact.nameRequired")}
            >
              <Input
                autoComplete="name"
                value={contact.name}
                onChange={(event) => setContact({ ...contact, name: event.target.value })}
              />
            </Field>
            <Field label={t("contact.phone")} required requiredLabel={t("requiredMark")}>
              <PhoneInput value={contact.phone} onChange={(phone) => setContact({ ...contact, phone })} />
            </Field>
            <Field
              label={t("contact.email")}
              hint={t("contact.emailHint")}
              required
              requiredLabel={t("requiredMark")}
              className="sm:col-span-2"
              error={
                contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)
                  ? t("contact.emailInvalid")
                  : undefined
              }
            >
              <Input
                type="email"
                autoComplete="email"
                value={contact.email}
                onChange={(event) => setContact({ ...contact, email: event.target.value })}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title={t("delivery.title")}>
          <RadioCards
            aria-label={t("delivery.title")}
            columns={2}
            value={mode}
            onValueChange={(value) => setMode(value as "shared" | "per_item")}
            options={[
              {
                value: "shared",
                label: t("delivery.shared"),
                description: t("delivery.sharedHint"),
                disabled: addresses.length === 0,
              },
              { value: "per_item", label: t("delivery.perItem"), description: t("delivery.perItemHint") },
            ]}
          />
          {mode === "shared" ? (
            <RadioCards
              aria-label={t("delivery.address")}
              columns={2}
              value={addressId}
              onValueChange={setAddressId}
              options={addresses.map((address) => ({
                value: address.id,
                label: `${address.label} — ${address.recipientName}`,
                description: [address.line1, address.district, address.province, address.postcode]
                  .filter(Boolean)
                  .join(" "),
              }))}
            />
          ) : data ? (
            <ul className="flex flex-col gap-2 text-sm">
              {data.items.map((item) => (
                <li key={item.cartItemId} className="border-border rounded-lg border p-3">
                  <p className="font-medium">{item.name}</p>
                  {item.destinations.map((destination, index) => (
                    <p key={index} className="text-muted">
                      {t("delivery.line", {
                        quantity: format.number(destination.quantity),
                        unit: item.unit,
                        label: destination.label,
                      })}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
          <Button variant="ghost" size="sm" iconStart="plus" className="self-start" onClick={() => setSheet("address")}>
            {t("delivery.newAddress")}
          </Button>
        </FormSection>

        <FormSection title={t("tax.title")} description={t("tax.hint")}>
          <RadioCards
            aria-label={t("tax.title")}
            columns={2}
            value={taxProfileId}
            onValueChange={setTaxProfileId}
            options={[
              { value: NO_TAX, label: t("tax.receipt"), description: t("tax.receiptHint") },
              ...profiles.map((profile) => ({
                value: profile.id,
                label: profile.name,
                description: `${t(`tax.types.${profile.taxType}`)} · ${formatTaxId(profile.taxId)} · ${
                  profile.branchType === "head_office"
                    ? t("tax.headOffice")
                    : t("tax.branch", { code: profile.branchCode })
                }${profile.withholdsTax ? ` · ${t("tax.withholds")}` : ""}`,
              })),
            ]}
          />
          <Button variant="ghost" size="sm" iconStart="plus" className="self-start" onClick={() => setSheet("tax")}>
            {t("tax.new")}
          </Button>
        </FormSection>

        <FormSection title={t("promotions.title")} description={t("promotions.hint")}>
          <form
            className="flex items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const code = codeDraft.trim().toUpperCase();
              if (code && !codes.includes(code) && codes.length < 3) setCodes([...codes, code]);
              setCodeDraft("");
            }}
          >
            <Field label={t("promotions.code")} className="flex-1">
              <Input
                value={codeDraft}
                autoComplete="off"
                className="uppercase"
                onChange={(event) => setCodeDraft(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              className="mt-[1.625rem]"
              disabled={!codeDraft.trim() || codes.length >= 3}
            >
              {t("promotions.apply")}
            </Button>
          </form>
          {data?.promotions.applied.length ? (
            <ul className="flex flex-col gap-2">
              {data.promotions.applied.map((promotion, index) => (
                <li
                  key={index}
                  className="bg-success-subtle text-success-subtle-fg flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                >
                  <span>
                    <Icon
                      name={promotion.kind === "automatic" ? "sparkles" : "ticket"}
                      size={16}
                      aria-hidden="true"
                      className="me-1 inline"
                    />
                    {promotion.code ? `${promotion.code} · ` : ""}
                    {promotion.title}
                    {promotion.capped && promotion.cappedNote ? (
                      <span className="block text-xs">{promotion.cappedNote}</span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    {t("summary.minus", { amount: format.thb(promotion.discountAmount) })}
                    {promotion.code ? (
                      <IconButton
                        name="close"
                        size="sm"
                        variant="ghost"
                        label={t("promotions.remove", { code: promotion.code })}
                        onClick={() => setCodes(codes.filter((code) => code !== promotion.code))}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {data?.promotions.rejected.map((rejected) => (
            <Callout key={rejected.code} tone="warning">
              <span className="flex items-center justify-between gap-2">
                {t("promotions.rejected", { code: rejected.code, message: rejected.message })}
                <IconButton
                  name="close"
                  size="sm"
                  variant="ghost"
                  label={t("promotions.remove", { code: rejected.code })}
                  onClick={() => setCodes(codes.filter((code) => code !== rejected.code))}
                />
              </span>
            </Callout>
          ))}
        </FormSection>

        {data && data.points.balance > 0 ? (
          <FormSection
            title={t("points.title")}
            description={t("points.hint", {
              balance: format.number(data.points.balance),
              value: format.thb(data.points.pointValue),
              min: format.number(data.points.min),
              max: format.number(data.points.max),
            })}
          >
            <div className="flex items-end gap-2">
              <Field label={t("points.redeem")} className="w-48">
                <NumberInput
                  min={0}
                  max={data.points.max}
                  step={1}
                  unit={t("points.unit")}
                  value={points || ""}
                  onChange={(event) => setPoints(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                />
              </Field>
              <Button
                variant="secondary"
                onClick={() => setPoints(data.points.max)}
                disabled={data.points.max < data.points.min}
              >
                {t("points.useMax")}
              </Button>
            </div>
            {data.points.redeemed > 0 ? (
              <p className="text-sm">
                {t("points.redeemed", {
                  points: format.number(data.points.redeemed),
                  amount: format.thb(data.points.redeemedAmount),
                })}
              </p>
            ) : null}
            <p className="text-muted text-xs">{t("points.toEarn", { points: format.number(data.points.toEarn) })}</p>
          </FormSection>
        ) : null}

        <FormSection title={t("schedule.title")} description={data?.schedule.note ?? undefined}>
          {data ? (
            <RadioCards
              aria-label={t("schedule.title")}
              columns={2}
              value={data.schedule.selectedKey}
              onValueChange={setScheduleKey}
              options={data.schedule.options.map((option) => ({
                value: option.key,
                label: option.label,
                description: (
                  <>
                    <span className="block">{option.description}</span>
                    {option.instalments.map((instalment) => (
                      <span key={instalment.seq} className="block tabular-nums">
                        {instalment.label}: {format.thb(instalment.grossAmount)}
                      </span>
                    ))}
                  </>
                ),
              }))}
            />
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </FormSection>

        <FormSection title={t("method.title")}>
          {data ? (
            <RadioCards
              aria-label={t("method.title")}
              columns={2}
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
              options={data.paymentMethods.map((option) => ({
                value: option.method,
                label: tMethods(`${option.method}.label`),
                description: option.available ? tMethods(`${option.method}.description`) : option.unavailableReason,
                disabled: !option.available,
              }))}
            />
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </FormSection>

        <FormSection title={t("note.title")}>
          <Field label={t("note.label")} hint={t("note.hint")}>
            <Textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormSection>
      </div>

      <aside
        aria-labelledby="checkout-summary"
        className="border-border h-fit rounded-2xl border p-5 lg:sticky lg:top-20"
      >
        <h2 id="checkout-summary" className="text-lg font-semibold">
          {t("summary.title")}
        </h2>
        {repriced && data ? (
          <Callout tone="warning" live className="mt-4" title={t("repriced.title")}>
            {t("repriced.body", {
              before: format.thb(repriced.before.grossAmount),
              after: format.thb(data.totals.grossAmount),
            })}
          </Callout>
        ) : null}
        {data ? (
          <div className={pending ? "opacity-60" : undefined} aria-busy={pending || undefined}>
            <PriceSummary
              className="mt-4"
              aria-label={t("summary.title")}
              rows={totalsRows(data.totals)}
              total={{ label: t("summary.total"), value: format.thb(data.totals.grossAmount) }}
            />
            <div className="bg-bg-subtle mt-4 rounded-lg p-3">
              <p className="text-sm">{schedule?.label}</p>
              <p className="text-lg font-bold tabular-nums">
                {t("summary.payNow", { amount: format.thb(data.totals.payableNowAmount) })}
              </p>
            </div>
            {data.taxInvoice ? (
              <p className="text-muted mt-3 text-xs">
                {t("summary.taxInvoice", {
                  name: data.taxInvoice.name,
                  taxId: formatTaxId(data.taxInvoice.taxId),
                  branch: data.taxInvoice.branch,
                })}
              </p>
            ) : null}
          </div>
        ) : preview.isError ? (
          <Callout tone="danger" className="mt-4">
            {isApiError(preview.error) ? preview.error.detail : t("previewFailed")}
          </Callout>
        ) : (
          <Skeleton className="mt-4 h-40 w-full" />
        )}
        {data && data.blockers.length > 0 ? (
          <Callout tone="warning" className="mt-4" title={t("blockedTitle")}>
            <ul className="list-disc ps-5">
              {data.blockers.map((blocker) => (
                <li key={blocker.code}>{blocker.message}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        {failure ? (
          <Callout tone="danger" live className="mt-4">
            {failure}
          </Callout>
        ) : null}
        <Button
          block
          size="lg"
          className="mt-4"
          disabled={!canPlace}
          loading={placing}
          onClick={() => setConfirming(true)}
        >
          {data ? t("place", { amount: format.thb(data.totals.payableNowAmount) }) : t("placeLoading")}
        </Button>
        <p className="text-muted mt-3 text-xs">{t("terms")}</p>
      </aside>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirm.title")}
        description={
          data
            ? t("confirm.body", {
                total: format.thb(data.totals.grossAmount),
                now: format.thb(data.totals.payableNowAmount),
                method: tMethods(`${method}.label`),
              })
            : ""
        }
        confirmLabel={t("confirm.yes")}
        cancelLabel={t("confirm.no")}
        loading={placing}
        onConfirm={() => void place()}
      />

      {sheet === "address" ? (
        <AddressSheet
          open
          onOpenChange={(open) => !open && setSheet(null)}
          onSaved={(address) => {
            setAddresses((current) => [...current, address]);
            setAddressId(address.id);
            setMode("shared");
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "tax" ? (
        <TaxProfileSheet
          open
          onOpenChange={(open) => !open && setSheet(null)}
          onSaved={(profile) => {
            setProfiles((current) => [...current, profile]);
            setTaxProfileId(profile.id);
            setSheet(null);
          }}
        />
      ) : null}
    </div>
  );
}
