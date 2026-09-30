"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ONLINE_PAYMENT_METHODS, type PaymentMethod } from "@/domain/payment-methods";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field, FormSection } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";
import { PriceSummary, type PriceRow } from "@/ui/components/PriceSummary";
import { RadioCards } from "@/ui/components/RadioCards";
import { Skeleton } from "@/ui/components/Skeleton";

import { addressLine, type Address, type TaxProfile } from "../account/address";
import { formatTaxId } from "../account/tax-id";
import { editCart, type Cart } from "../cart/cart-client";
import { pick } from "../catalog/localize";
import { useDebounced } from "../configurator/pricing";

const AddressSheet = dynamic(() => import("../cart/AddressSheet").then((module) => module.AddressSheet), {
  ssr: false,
});
const TaxProfileSheet = dynamic(() => import("./TaxProfileSheet").then((module) => module.TaxProfileSheet), {
  ssr: false,
});

type Preview = Schemas["CheckoutPreviewDto"];
type Body = Schemas["CheckoutDto"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
const NO_TAX = "__receipt__";
/** The notices the storefront has words for (the contract names none; packio-api's checkout extensions do). */
const KNOWN_NOTICES = new Set([
  "promotion.applied",
  "promotion.capped",
  "promotion.rejected",
  "promotion.payment_method_required",
  "discount.applied",
  "discount.capped",
  "points.applied",
  "points.capped",
  "points.rejected",
  "company.approval_required",
  "company.credit_order",
  "company.credit_unavailable",
]);

/** What the company block of a checkout needs from `CompanyDto`. */
export type CheckoutCompany = Pick<
  Schemas["CompanyDto"],
  "id" | "legalName" | "companyCode" | "poNumberPolicy" | "orderApprovalThreshold"
>;

export interface CheckoutViewProps {
  cart: Cart;
  addresses: Address[];
  taxProfiles: TaxProfile[];
  /** Points the customer holds (`store.loyalty.get`). */
  pointsBalance: number;
  /** The company the customer orders for, if they belong to one (`store.companies.listMine`). */
  company: CheckoutCompany | null;
  /** Product type code → name, since a cart line names its type only. */
  typeNames: Record<string, string>;
}

/**
 * The checkout (F3 3.3): delivery → tax invoice → codes → points → company → the payment schedule
 * the rules chose → how to pay → review, on one page. Every figure is the API's preview
 * (`store.checkout.preview`), asked for again after each change; placing (`store.checkout.place`)
 * carries the total the customer saw as `expectedGrossAmount`, and if it moved the customer sees the
 * old and new totals and confirms again (design-system.md §1.3).
 *
 * What the published checkout does differently, and so this page:
 * - delivery and codes are the cart's: one address for everything is set on each line
 *   (`store.cart.setDestinations`), and a code is applied to the cart (`store.cart.applyCode`);
 * - the payment method is chosen when paying (`store.payments.initiate`, per order group);
 * - over a company's threshold the order is placed as `pending_company_approval` (D-123).
 *
 * CONTRACT-GAP store.checkout — no contact block, no note to the team, no choice of payment schedule
 * (`scheduleKey`, kept requested), no list of payment methods, no points bounds or points to earn, no
 * company credit summary in the preview.
 */
export function CheckoutView({
  cart: initialCart,
  addresses: initialAddresses,
  taxProfiles: initialProfiles,
  pointsBalance,
  company,
  typeNames,
}: CheckoutViewProps) {
  const t = useTranslations("checkout");
  const tMethods = useTranslations("checkout.methods");
  const tNotices = useTranslations("checkout.notices");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [cart, setCart] = useState(initialCart);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [profiles, setProfiles] = useState(initialProfiles);
  // "One address for everything" is what the cart already says when every line goes, whole, to
  // the same saved address; the page never rewrites the cart on its own.
  const single = new Set(
    initialCart.items.map((item) => (item.destinations.length === 1 ? item.destinations[0]!.addressId : null)),
  );
  const sharedId = single.size === 1 ? [...single][0] : null;
  const defaultAddress = initialAddresses.find((address) => address.isDefault) ?? initialAddresses[0];
  const [mode, setMode] = useState<"shared" | "per_item">(sharedId ? "shared" : "per_item");
  const [addressId, setAddressId] = useState(sharedId ?? defaultAddress?.id ?? "");
  const [taxProfileId, setTaxProfileId] = useState<string>(
    initialProfiles.find((profile) => profile.isDefault)?.id ?? NO_TAX,
  );
  const [codeDraft, setCodeDraft] = useState("");
  const [points, setPoints] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("scb_qr");
  const [poNumber, setPoNumber] = useState("");
  const [sheet, setSheet] = useState<"address" | "tax" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [repriced, setRepriced] = useState<{ before: string } | null>(null);
  const idempotencyKey = useRef(newKey());

  const api = browserApi();
  const edit = useMutation({
    mutationFn: async (run: () => Promise<Cart>) => run(),
    onSuccess: (next) => {
      setCart(next);
      queryClient.setQueryData(queryKeys.resource("customer", "cart"), next);
    },
    onError: (error) => setFailure(isApiError(error) ? error.detail : t("failed")),
  });

  /** One address for every line: each line's whole quantity goes there (`store.cart.setDestinations`). */
  function shipAllTo(id: string) {
    setAddressId(id);
    edit.mutate(async () => {
      let next = cart;
      for (const item of cart.items)
        next = await editCart((ifMatch) =>
          api.PUT("/v1/store/cart/items/{itemId}/destinations", {
            params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
            body: { destinations: [{ addressId: id, quantity: item.quantity }] },
          }),
        );
      return next;
    });
  }

  const body: Body = {
    taxProfileId: taxProfileId === NO_TAX ? null : taxProfileId,
    ...(points >= 1 ? { redeemPoints: points } : {}),
    ...(company ? { companyId: company.id } : {}),
    ...(company && poNumber.trim() ? { poNumber: poNumber.trim() } : {}),
  };
  // The cart's `updatedAt` is in the key, so a change to its codes or destinations prices again.
  const key = JSON.stringify({ body, cart: cart.updatedAt, codes: cart.codes, destinations: cart.items });
  const settled = useDebounced(key, 400);
  const preview = useQuery({
    queryKey: [...queryKeys.resource("customer", "checkout-preview"), settled],
    queryFn: async ({ signal }) =>
      (
        await api.POST("/v1/store/checkout/actions/preview", {
          body: (JSON.parse(settled) as { body: Body }).body,
          signal,
        })
      ).data!,
    placeholderData: (previous) => previous,
    staleTime: 0,
  });
  const data: Preview | undefined = preview.data;
  const pending = key !== settled || preview.isFetching || edit.isPending;
  const needsApproval = data?.notices.some((notice) => notice.code === "company.approval_required") ?? false;
  const dueNow = data?.paymentSchedule?.instalments.find((instalment) => instalment.dueTrigger === "at_checkout");
  const canPlace = Boolean(data) && !pending && (company?.poNumberPolicy !== "required" || poNumber.trim() !== "");

  async function applyCode(code: string) {
    edit.mutate(() =>
      editCart((ifMatch) =>
        api.POST("/v1/store/cart/codes", { params: { header: { "If-Match": ifMatch } }, body: { code } }),
      ),
    );
  }

  function removeCode(code: string) {
    edit.mutate(() =>
      editCart((ifMatch) =>
        api.DELETE("/v1/store/cart/codes/{code}", { params: { path: { code }, header: { "If-Match": ifMatch } } }),
      ),
    );
  }

  async function place() {
    if (!data) return;
    setPlacing(true);
    setFailure(null);
    try {
      const { data: group } = await api.POST("/v1/store/checkout", {
        params: { header: { "Idempotency-Key": idempotencyKey.current } },
        body: { ...body, expectedGrossAmount: data.totals.grossAmount },
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
      if (group!.status === "pending_company_approval") {
        // D-123: over the company threshold — placed, and waiting for the company's approver.
        router.push(`/business/approvals?sent=${encodeURIComponent(group!.groupCode)}`);
        return;
      }
      track("order_placed", { route: "/checkout", quoteMode: "instant" });
      if (!dueNow) {
        router.push(`/account/orders?placed=${encodeURIComponent(group!.groupCode)}`);
        return;
      }
      const { data: payment } = await api.POST("/v1/store/order-groups/{groupId}/payments", {
        params: { path: { groupId: group!.id }, header: { "Idempotency-Key": `${idempotencyKey.current}:pay` } },
        body: { method },
      });
      router.push(`/checkout/pay/${payment!.id}`);
    } catch (error) {
      setConfirming(false);
      if (isApiError(error) && (error.code === "checkout.total_changed" || error.code === "checkout.price_expired")) {
        // Priced again from scratch: the customer sees both totals and confirms the new one.
        setRepriced({ before: data.totals.grossAmount });
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
    ...(totals.discountAmount !== "0.00"
      ? [
          {
            label: t("summary.discount"),
            value: t("summary.minus", { amount: format.thb(totals.discountAmount) }),
            tone: "discount" as const,
          },
        ]
      : []),
    ...(totals.shippingNetAmount !== "0.00"
      ? [{ label: t("summary.shipping"), value: format.thb(totals.shippingNetAmount) }]
      : []),
    { label: t("summary.net"), value: format.thb(totals.netAmount) },
    {
      label: t("summary.vat"),
      value: format.thb(totals.vatAmount),
      tone: "muted" as const,
    },
    ...(totals.whtAmount !== "0.00"
      ? [
          {
            label: t("summary.withholding"),
            value: t("summary.minus", { amount: format.thb(totals.whtAmount) }),
            hint: t("summary.withholdingHint"),
          },
        ]
      : []),
  ];

  const profile = profiles.find((candidate) => candidate.id === taxProfileId);
  // The notice's code picks the message; its params fill it (the key is known only at runtime).
  const translate = tNotices as unknown as (key: string, values: Record<string, string>) => string;
  const noticeText = (notice: Schemas["CheckoutNoticeDto"]) =>
    KNOWN_NOTICES.has(notice.code)
      ? translate(notice.code.replace(".", "_"), {
          ...Object.fromEntries(
            Object.entries(notice.params ?? {}).map(([name, value]) => [
              name,
              value === null || value === undefined
                ? ""
                : typeof value === "string" && /^-?\d+\.\d{2}$/.test(value)
                  ? format.thb(value)
                  : Array.isArray(value)
                    ? value.join(", ")
                    : String(value),
            ]),
          ),
        })
      : translate("other", { code: notice.code });

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-10">
        <FormSection title={t("delivery.title")}>
          <RadioCards
            aria-label={t("delivery.title")}
            columns={2}
            value={mode}
            onValueChange={(value) => {
              setMode(value as "shared" | "per_item");
              if (value === "shared" && addressId) shipAllTo(addressId);
            }}
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
              onValueChange={shipAllTo}
              options={addresses.map((address) => ({
                value: address.id,
                label: `${address.label} — ${address.recipientName}`,
                description: addressLine(locale, address),
              }))}
            />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {cart.items.map((item) => (
                <li key={item.id} className="border-border rounded-lg border p-3">
                  <p className="font-medium">{typeNames[item.productTypeCode] ?? item.productTypeCode}</p>
                  {item.destinations.map((destination) => (
                    <p key={destination.id} className="text-muted">
                      {t("delivery.line", {
                        quantity: format.number(destination.quantity),
                        label: `${destination.address.recipientName} · ${destination.address.provinceNameTh}`,
                      })}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
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
              ...profiles.map((candidate) => ({
                value: candidate.id,
                label: candidate.name,
                description: `${t(`tax.types.${candidate.taxType}`)} · ${formatTaxId(candidate.taxId)} · ${
                  candidate.branchType === "head_office"
                    ? t("tax.headOffice")
                    : t("tax.branch", { code: candidate.branchCode })
                }${candidate.withholdsTax ? ` · ${t("tax.withholds")}` : ""}`,
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
              if (code && !cart.codes.some((entry) => entry.code === code)) void applyCode(code);
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
              disabled={!codeDraft.trim()}
              loading={edit.isPending}
            >
              {t("promotions.apply")}
            </Button>
          </form>
          {cart.codes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {cart.codes.map((entry) => (
                <li
                  key={entry.code}
                  className={`${
                    entry.status === "validated"
                      ? "bg-success-subtle text-success-subtle-fg"
                      : "bg-warning-subtle text-warning-subtle-fg"
                  } flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm`}
                >
                  <span>
                    {entry.status === "validated"
                      ? t("promotions.accepted", { code: entry.code })
                      : t("promotions.rejected", { code: entry.code, message: entry.rejectReason ?? "" })}
                  </span>
                  <IconButton
                    name="close"
                    size="sm"
                    variant="ghost"
                    label={t("promotions.remove", { code: entry.code })}
                    onClick={() => removeCode(entry.code)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </FormSection>

        {pointsBalance > 0 ? (
          <FormSection
            title={t("points.title")}
            description={t("points.hint", { balance: format.number(pointsBalance) })}
          >
            <div className="flex items-end gap-2">
              <Field label={t("points.redeem")} className="w-48">
                <NumberInput
                  min={0}
                  max={pointsBalance}
                  step={1}
                  unit={t("points.unit")}
                  value={points || ""}
                  onChange={(event) => setPoints(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                />
              </Field>
            </div>
          </FormSection>
        ) : null}

        {company ? (
          <FormSection
            title={t("company.title")}
            description={t("company.intro", { name: company.legalName, code: company.companyCode ?? "" })}
          >
            {company.poNumberPolicy !== "none" ? (
              <Field
                label={t("company.po")}
                hint={company.poNumberPolicy === "required" ? t("company.poRequired") : t("company.poOptional")}
                required={company.poNumberPolicy === "required"}
                requiredLabel={t("company.required")}
              >
                <Input
                  value={poNumber}
                  maxLength={60}
                  onChange={(event) => setPoNumber(event.target.value)}
                  className="max-w-64"
                />
              </Field>
            ) : null}
          </FormSection>
        ) : null}

        <FormSection title={t("schedule.title")} description={t("schedule.hint")}>
          {data ? (
            data.paymentSchedule ? (
              <ul className="border-border flex flex-col gap-1 rounded-lg border p-3 text-sm">
                {data.paymentSchedule.instalments.map((instalment) => (
                  <li key={instalment.seq} className="flex justify-between gap-3 tabular-nums">
                    <span>{pick(locale, instalment.labelTh, instalment.labelEn)}</span>
                    <span>{format.thb(instalment.grossAmount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">{t("schedule.none")}</p>
            )
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </FormSection>

        {dueNow && !needsApproval ? (
          <FormSection title={t("method.title")} description={t("method.hint")}>
            <RadioCards
              aria-label={t("method.title")}
              columns={2}
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
              options={ONLINE_PAYMENT_METHODS.map((option) => ({
                value: option,
                label: tMethods(`${option}.label`),
                description: tMethods(`${option}.description`),
              }))}
            />
          </FormSection>
        ) : null}
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
              before: format.thb(repriced.before),
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
            {dueNow ? (
              <div className="bg-bg-subtle mt-4 rounded-lg p-3">
                <p className="text-sm">{pick(locale, dueNow.labelTh, dueNow.labelEn)}</p>
                <p className="text-lg font-bold tabular-nums">
                  {t("summary.payNow", { amount: format.thb(dueNow.cashAmount) })}
                </p>
              </div>
            ) : null}
            {profile ? (
              <p className="text-muted mt-3 text-xs">
                {t("summary.taxInvoice", {
                  name: profile.name,
                  taxId: formatTaxId(profile.taxId),
                  branch:
                    profile.branchType === "head_office"
                      ? t("tax.headOffice")
                      : t("tax.branch", { code: profile.branchCode }),
                })}
              </p>
            ) : null}
            {data.notices.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                {data.notices.map((notice, index) => (
                  <li key={`${notice.code}-${index}`} className="bg-bg-subtle rounded-lg px-3 py-2">
                    {noticeText(notice)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : preview.isError ? (
          <Callout tone="danger" className="mt-4" title={t("blockedTitle")}>
            {isApiError(preview.error) ? preview.error.detail : t("previewFailed")}
          </Callout>
        ) : (
          <Skeleton className="mt-4 h-40 w-full" />
        )}
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
          {data
            ? needsApproval
              ? t("company.send")
              : dueNow
                ? t("place", { amount: format.thb(dueNow.cashAmount) })
                : t("placeLater")
            : t("placeLoading")}
        </Button>
        <p className="text-muted mt-3 text-xs">{t("terms")}</p>
      </aside>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={needsApproval ? t("company.confirmTitle") : t("confirm.title")}
        description={
          data && needsApproval && company
            ? t("company.confirmBody", { total: format.thb(data.totals.grossAmount), name: company.legalName })
            : data && dueNow
              ? t("confirm.body", {
                  total: format.thb(data.totals.grossAmount),
                  now: format.thb(dueNow.cashAmount),
                  method: tMethods(`${method}.label`),
                })
              : data
                ? t("confirm.bodyLater", { total: format.thb(data.totals.grossAmount) })
                : ""
        }
        confirmLabel={needsApproval ? t("company.send") : t("confirm.yes")}
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
            setMode("shared");
            shipAllTo(address.id);
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "tax" ? (
        <TaxProfileSheet
          open
          onOpenChange={(open) => !open && setSheet(null)}
          onSaved={(saved) => {
            setProfiles((current) => [...current, saved]);
            setTaxProfileId(saved.id);
            setSheet(null);
          }}
        />
      ) : null}
    </div>
  );
}
