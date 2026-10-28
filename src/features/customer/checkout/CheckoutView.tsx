"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { ONLINE_PAYMENT_METHODS, type PaymentMethod } from "@/domain/payment-methods";
import { isFreeShipping, shippingAmountText } from "@/features/shared/format/shipping";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { trackCheckout } from "@/lib/analytics/checkout";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import type { PriceRow } from "@/ui/components/PriceSummary";
import { RadioCards } from "@/ui/components/RadioCards";
import { Skeleton } from "@/ui/components/Skeleton";
import { Switch } from "@/ui/components/Switch";
import { Icon, type IconName } from "@/ui/icons";

import { addressLine, type Address, type TaxProfile } from "../account/address";
import { AddressForm } from "../account/AddressForm";
import { formatTaxId } from "../account/tax-id";
import { TaxProfileForm } from "../account/TaxProfileForm";
import { editCart, type Cart } from "../cart/cart-client";
import { Destinations } from "../cart/Destinations";
import { PromoCodeBox, type AppliedPromotion } from "../cart/PromoCodeBox";
import { pick } from "../catalog/localize";
import { useDebounced } from "../configurator/pricing";
import { productNameOf } from "../orders/summary";
import { CheckoutStepper } from "./flow/CheckoutStepper";
import { MobileBar, OrderSummary, type SummaryAction } from "./flow/OrderSummary";
import {
  addressBlockers,
  blockersUpTo,
  cartBlockers,
  furthestStep,
  isSplit,
  nextStep,
  parseStep,
  paymentBlockers,
  reviewBlockers,
  sharedAddressId,
  type Blocker,
  type CheckoutPageStep,
  type CheckoutStep,
} from "./flow/steps";
import { leadDaysOf, useTrustLines } from "./flow/trust";

type Preview = Schemas["CheckoutPreviewDto"];
type Body = Schemas["CheckoutDto"];

/** The notices the storefront has words for (the contract names none; getpack-api's checkout extensions do). */
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
const PROMOTION_NOTICES = new Set(["promotion.applied", "discount.applied"]);
/** Preview refusals the address step names as its blockers (not repeated as an error in the summary). */
const ADDRESS_PROBLEMS = new Set([
  "checkout.destinations_incomplete",
  "checkout.shipping_unavailable",
  "checkout.rfq_destination_fixed",
]);
const METHOD_ICONS: Partial<Record<PaymentMethod, IconName>> = {
  scb_qr: "scan",
  card_2c2p: "credit-card",
  online_banking_2c2p: "building",
  bank_transfer_slip: "receipt",
};

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
  /** The tax invoice issuer's name from settings (`PublicConfigDto.issuer`); null leaves it out. */
  issuerName?: string | null;
}

/** The figures of the summary from the preview — every one the API's, in the API's order of a bill. */
export function previewFigures(preview: Pick<Preview, "display" | "totals">) {
  return {
    goods: preview.display.goodsGrossAmount,
    discount: preview.display.discountGrossAmount !== "0.00" ? preview.display.discountGrossAmount : null,
    shipping: preview.display.shippingGrossAmount,
    vat: preview.display.vatAmount,
    withholding: preview.totals.whtAmount !== "0.00" ? preview.totals.whtAmount : null,
    /** The total shown = the total the order is placed with (`expectedGrossAmount`). */
    total: preview.totals.grossAmount,
  };
}

/** The body `store.checkout.place` gets: what was previewed, guarded by the total the customer saw. */
export function placeBody(body: Body, preview: Pick<Preview, "totals">): Body {
  return { ...body, expectedGrossAmount: preview.totals.grossAmount };
}

/**
 * Checkout, steps 2–4 of 4 (checkout redesign Phase 1, F3 3.3): ที่อยู่และการจัดส่ง → ใบกำกับภาษีและชำระเงิน →
 * ทบทวนและยืนยัน on one page (`?step=`), so the preview, the idempotency key and the cart's ETag queue carry over.
 * Every figure is the API's preview (`store.checkout.preview`), asked for again after each change; placing
 * (`store.checkout.place`) carries the total the customer saw as `expectedGrossAmount`, and if it moved the customer
 * sees the old and new totals and confirms again (design-system.md §1.3).
 *
 * - Delivery: one address for everything by default (`store.cart.setDestinations`, each line whole); "แบ่งส่งหลาย
 *   ที่อยู่" opens the per-line allocation (D-110). A single-address order never touches the allocation.
 * - Tax invoice: off = a receipt; on = a tax profile (D-125), the full tax id shown (DECISIONS-STAGE-A §3).
 * - The payment method is chosen here and used when paying (`store.payments.initiate`); the schedule is the rules'
 *   (D-020, DECISIONS-STAGE-A §3: default full payment) and shown, not chosen; ผ่อนชำระ stays hidden until live.
 * - Over a company's threshold the order is placed as `pending_company_approval` (D-123).
 *
 * CONTRACT-GAP store.checkout — no contact block or note to the team (delivery-note PDPA text still open,
 * DECISIONS-STAGE-A §5). The schedule is the rules' (`scheduleKey` stays requested, proposed rejection).
 */
export function CheckoutView({
  cart: initialCart,
  addresses: initialAddresses,
  taxProfiles: initialProfiles,
  pointsBalance,
  company,
  issuerName = null,
}: CheckoutViewProps) {
  const t = useTranslations("checkout");
  const tFlow = useTranslations("checkout.flow");
  const tShipping = useTranslations("common.shipping");
  const tMethods = useTranslations("checkout.methods");
  const tNotices = useTranslations("checkout.notices");
  const tDesign = useTranslations("configurator.design.options");
  const tUnits = useTranslations("catalog.stock.units");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const step: CheckoutPageStep = parseStep(searchParams.get("step"));

  const [cart, setCart] = useState(initialCart);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [split, setSplit] = useState(() => isSplit(initialCart));
  const defaultAddress = initialAddresses.find((address) => address.isDefault) ?? initialAddresses[0];
  const [addressId, setAddressId] = useState(() => sharedAddressId(initialCart) ?? defaultAddress?.id ?? "");
  const [addingAddress, setAddingAddress] = useState(initialAddresses.length === 0);
  const defaultProfile = initialProfiles.find((profile) => profile.isDefault) ?? null;
  const [taxInvoice, setTaxInvoice] = useState(defaultProfile !== null);
  const [taxProfileId, setTaxProfileId] = useState<string | null>(defaultProfile?.id ?? initialProfiles[0]?.id ?? null);
  const [addingProfile, setAddingProfile] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("scb_qr");
  const [poNumber, setPoNumber] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [repriced, setRepriced] = useState<{ before: string } | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey());
  const mainRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLButtonElement>(null);
  const poRef = useRef<HTMLInputElement>(null);

  // The funnel's checkout step, once per visit, however the customer got here — the cart, or the
  // studio's "order now" straight to checkout (U4.6, U5.1).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("checkout_started", { route: "/checkout" });
  }, []);
  useEffect(() => {
    trackCheckout("checkout_step_view", { step });
  }, [step]);

  const api = browserApi();
  const edit = useMutation({
    mutationFn: async (run: () => Promise<Cart>) => run(),
    onSuccess: (next) => {
      setCart(next);
      queryClient.setQueryData(queryKeys.resource("customer", "cart"), next);
    },
    onError: (error) => setFailure(isApiError(error) ? error.detail : t("failed")),
  });

  /** Each line's whole quantity to one address (`store.cart.setDestinations`), one edit after the other. */
  const writeAll = useCallback(
    (id: string, from: Cart) =>
      edit.mutate(async () => {
        let next = from;
        for (const item of from.items)
          next = await editCart((ifMatch) =>
            api.PUT("/v1/store/cart/items/{itemId}/destinations", {
              params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
              body: { destinations: [{ addressId: id, quantity: item.quantity }] },
            }),
          );
        return next;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `edit` and `api` are stable for the page's life
    [],
  );
  /** One address for every line. */
  function shipAllTo(id: string, from: Cart) {
    setAddressId(id);
    writeAll(id, from);
  }

  // A line with no destination at all (nothing to lose) goes to the chosen address at once, so a single-address
  // order needs no click here; the page never rewrites a destination the customer set.
  const autoShipped = useRef(false);
  useEffect(() => {
    if (autoShipped.current || split || !addressId) return;
    if (!initialCart.items.some((item) => item.destinations.length === 0)) return;
    autoShipped.current = true;
    writeAll(addressId, initialCart);
  }, [addressId, initialCart, writeAll, split]);

  const body: Body = {
    taxProfileId: taxInvoice ? taxProfileId : null,
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
    retry: false,
  });
  const data: Preview | undefined = preview.isError ? undefined : preview.data;
  const previewError = preview.isError && isApiError(preview.error) ? preview.error.code : null;
  const pending = key !== settled || preview.isFetching || edit.isPending;

  // Arrival for one address: the cart's estimate to its postcode (`store.cart.estimateShipping`).
  const chosenAddress = addresses.find((address) => address.id === addressId) ?? null;
  const estimate = useQuery({
    queryKey: [...queryKeys.resource("customer", "cart-shipping-estimate"), chosenAddress?.postcode, cart.updatedAt],
    enabled: !split && chosenAddress !== null,
    queryFn: async ({ signal }) =>
      (
        await api.POST("/v1/store/cart/actions/estimate-shipping", {
          body: { postcode: chosenAddress!.postcode },
          signal,
        })
      ).data!,
    staleTime: 60_000,
    retry: false,
  });

  const needsApproval =
    data?.company?.approvalRequired ??
    data?.notices.some((notice) => notice.code === "company.approval_required") ??
    false;
  // The methods the preview offers now (D-176), within the ones the storefront has a payment page for.
  const offered = (data?.paymentMethods ?? [])
    .filter((option) => option.available && ONLINE_PAYMENT_METHODS.includes(option.method))
    .map((option) => option.method);
  const methods = data ? offered : ONLINE_PAYMENT_METHODS;
  const chosenMethod = methods.includes(method) ? method : (methods[0] ?? method);
  const pointsBounds = data?.points ?? null;
  const dueNow = data?.paymentSchedule?.instalments.find((instalment) => instalment.dueTrigger === "at_checkout");
  const methodShown = Boolean(dueNow) && !needsApproval && !data?.company?.onCredit;
  const plan = data?.paymentSchedule?.templateKey ?? "none";

  // Every step's blockers, from what the API said; the stepper and the primary action follow them.
  const blockers: Blocker[] = [
    ...cartBlockers(cart),
    ...addressBlockers(cart, split, previewError),
    ...paymentBlockers({
      poRequired: company?.poNumberPolicy === "required",
      poNumber,
      taxInvoice,
      taxProfileId,
      previewReady: Boolean(data) && !pending,
    }),
    ...reviewBlockers(agreed),
  ];
  const furthest = furthestStep(blockers);
  const here = blockersUpTo(step, blockers);
  const nameOf = (id?: string) => {
    const item = cart.items.find((candidate) => candidate.id === id);
    return item ? productNameOf(locale, item.summary) : "";
  };
  const blockerText = (blocker: Blocker) =>
    tFlow(`blockers.${blocker.reason}`, {
      name: nameOf(blocker.itemId),
      quantity: format.number(cart.items.find((item) => item.id === blocker.itemId)?.quantity ?? 0),
    });

  function go(next: CheckoutStep) {
    if (next === "cart") {
      router.push("/cart");
      return;
    }
    window.history.pushState(null, "", `?step=${next}`);
    window.scrollTo({ top: 0 });
  }

  /** The primary action pressed while blocked: say why, and take the customer to it (focus to the first field). */
  function onBlocked() {
    const first = here[0];
    if (!first) return;
    trackCheckout("checkout_blocked", { step, reason: first.reason });
    if (first.step !== step) {
      go(first.step);
      return;
    }
    if (first.reason === "terms") {
      setAgreeError(true);
      termsRef.current?.focus();
    } else if (first.reason === "po_required") poRef.current?.focus();
    else mainRef.current?.querySelector<HTMLElement>("input, button[role='radio'], [role='switch'], button")?.focus();
  }

  // A code the API refuses outright (unknown, attempts exhausted — D-053) is the box's own error,
  // not a checkout failure: the rest of the page is still fine.
  async function applyCode(code: string) {
    setCodeError(null);
    try {
      const next = await editCart((ifMatch) =>
        api.POST("/v1/store/cart/codes", { params: { header: { "If-Match": ifMatch } }, body: { code } }),
      );
      setCart(next);
      queryClient.setQueryData(queryKeys.resource("customer", "cart"), next);
      const entry = next.codes.find((candidate) => candidate.code === code);
      trackCheckout("checkout_code_apply", { result: entry?.status === "validated" ? "validated" : "rejected" });
    } catch (error) {
      trackCheckout("checkout_code_apply", { result: "error" });
      setCodeError(isApiError(error) ? error.detail : t("failed"));
    }
  }

  function removeCode(code: string) {
    setCodeError(null);
    edit.mutate(() =>
      editCart((ifMatch) =>
        api.DELETE("/v1/store/cart/codes/{code}", { params: { path: { code }, header: { "If-Match": ifMatch } } }),
      ),
    );
  }

  // What the promotions are worth, from the preview's notices — shown with the codes.
  const appliedPromotions: AppliedPromotion[] = (data?.notices ?? []).flatMap((notice) => {
    if (!PROMOTION_NOTICES.has(notice.code)) return [];
    const params = notice.params ?? {};
    const amount = typeof params["amount"] === "string" ? params["amount"] : null;
    if (!amount) return [];
    const name = typeof params["name"] === "string" && params["name"] ? params["name"] : tNotices("discount_name");
    return [{ name, amount }];
  });

  async function place() {
    if (!data) return;
    setPlacing(true);
    setFailure(null);
    trackCheckout("checkout_confirm", { method: methodShown ? chosenMethod : null, plan });
    try {
      const { data: group } = await api.POST("/v1/store/checkout", {
        params: { header: { "Idempotency-Key": idempotencyKey.current } },
        body: placeBody(body, data),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
      if (group!.status === "pending_company_approval") {
        // D-123: over the company threshold — placed, and waiting for the company's approver.
        router.push(`/business/approvals?sent=${encodeURIComponent(group!.groupCode)}`);
        return;
      }
      track("order_placed", { route: "/checkout", orderGroupId: group!.id });
      // The studio funnel's last step (D-286): an order with a design version from the studio.
      if (cart.items.some((item) => item.designDocumentId && item.designVersionNo))
        track("studio_ordered", { route: "/checkout" });
      if (!dueNow) {
        router.push(`/account/orders?placed=${encodeURIComponent(group!.groupCode)}`);
        return;
      }
      // The order exists from here on: whatever happens to the payment, the customer is taken to it
      // and never left on an emptied checkout (round 2, B1). Its own key — the API takes a UUID only.
      try {
        const { data: payment } = await api.POST("/v1/store/order-groups/{groupId}/payments", {
          params: { path: { groupId: group!.id }, header: { "Idempotency-Key": newIdempotencyKey() } },
          body: { method: chosenMethod },
        });
        router.push(`/checkout/pay/${payment!.id}`);
      } catch {
        const [only] = group!.orders;
        router.push(
          group!.orders.length === 1 && only
            ? `/account/orders/${only.id}?payment=not_started`
            : `/account/orders?placed=${encodeURIComponent(group!.groupCode)}&payment=not_started`,
        );
      }
    } catch (error) {
      if (isApiError(error) && (error.code === "checkout.total_changed" || error.code === "checkout.price_expired")) {
        // Priced again from scratch: the customer sees both totals and confirms the new one.
        setRepriced({ before: data.totals.grossAmount });
        idempotencyKey.current = newIdempotencyKey();
        await preview.refetch();
      } else {
        if (isApiError(error)) idempotencyKey.current = newIdempotencyKey();
        setFailure(isApiError(error) ? error.detail : t("failed"));
      }
      setPlacing(false);
    }
  }

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

  const destinationCount = new Set(
    cart.items.flatMap((item) => item.destinations.map((destination) => destination.addressId)),
  ).size;
  const figures = data ? previewFigures(data) : null;
  const rows: PriceRow[] = figures
    ? [
        {
          label: tFlow("summary.goods", { count: cart.items.length }),
          hint: tFlow("summary.vatIncluded"),
          value: format.thb(figures.goods),
        },
        ...(figures.discount
          ? [
              {
                label: tFlow("summary.discount"),
                value: t("summary.minus", { amount: format.thb(figures.discount) }),
                tone: "discount" as const,
              },
            ]
          : []),
        {
          label: split ? tFlow("summary.shippingSplit", { count: destinationCount }) : tFlow("summary.shipping"),
          value: shippingAmountText(figures.shipping, format.thb, tShipping("free")),
        },
        { label: tFlow("summary.vat"), value: format.thb(figures.vat) },
      ]
    : [
        {
          label: tFlow("summary.goods", { count: cart.items.length }),
          hint: tFlow("summary.vatIncluded"),
          value: format.thb(cart.productGrossAmount),
        },
        { label: tFlow("summary.shipping"), value: tFlow("summary.shippingLater"), tone: "muted" },
        ...(cart.vatAmount ? [{ label: tFlow("summary.vat"), value: format.thb(cart.vatAmount) }] : []),
      ];
  const totalValue = format.thb(figures?.total ?? cart.productGrossAmount);
  const totalHint = figures ? undefined : tFlow("summary.totalNoShipping");
  const trust = useTrustLines({
    items: cart.items,
    readyDate: estimate.data?.readyDate ?? null,
    methods: data ? offered.map((option) => tMethods(`${option}.label`)) : [],
  });

  const following = nextStep(step);
  const primary: SummaryAction =
    step === "review"
      ? {
          label: needsApproval ? tFlow("confirmApproval") : dueNow ? tFlow("confirm") : tFlow("confirmLater"),
          onClick: () => void place(),
          loading: placing,
          disabled: !data || pending,
        }
      : { label: tFlow("next", { step: tFlow(`steps.${following!}`) }), onClick: () => go(following!) };
  const mobileAction: SummaryAction = {
    ...primary,
    label: step === "review" ? tFlow("confirmShort") : tFlow("nextShort"),
  };

  const box = "border-border bg-surface rounded-card border px-4 py-4.5 sm:px-6 sm:py-5.5";
  const navButtons = (
    <div className="mt-1 flex justify-between gap-2.5">
      <Button
        variant="secondary"
        size="lg"
        onClick={() => go(step === "address" ? "cart" : step === "payment" ? "address" : "payment")}
      >
        {tFlow("back")}
      </Button>
      {step !== "review" ? (
        here.length > 0 ? (
          <Button size="lg" className="opacity-50" aria-disabled="true" onClick={onBlocked}>
            {primary.label}
          </Button>
        ) : (
          <Button size="lg" onClick={primary.onClick}>
            {primary.label}
          </Button>
        )
      ) : null}
    </div>
  );

  const profile = profiles.find((candidate) => candidate.id === taxProfileId) ?? null;
  const designAfter = (() => {
    const options = new Set(cart.items.map((item) => item.designOption));
    if (cart.items.every((item) => item.reusesApprovedArtwork)) return tFlow("review.afterReuse");
    if (options.has("hired_design")) return tFlow("review.afterHired");
    if (options.has("online_designer")) return tFlow("review.afterStudio");
    return tFlow("review.afterOwnFile");
  })();
  const arrival = estimate.data?.available ? estimate.data.arrival : null;
  const leadDays = leadDaysOf(cart.items);

  return (
    <>
      <CheckoutStepper
        current={step}
        reachable={furthest}
        inPage={["address", "payment", "review"]}
        onSelect={(selected) => go(selected)}
      />
      <div className="grid items-start gap-8 pt-4 pb-28 min-[1100px]:grid-cols-[minmax(0,1fr)_23.75rem] sm:pb-24">
        <div ref={mainRef} className="flex min-w-0 flex-col gap-4">
          {cart.items.some((item) => !item.priceLocked || item.pendingReprice) ? (
            <Callout tone="warning">
              <span>{t("cartNotReady")} </span>
              <Link href="/cart" className="text-primary underline underline-offset-4">
                {tFlow("steps.cart")}
              </Link>
            </Callout>
          ) : null}

          {step === "address" ? (
            <>
              <section aria-labelledby="step-address" className={box}>
                <h2 id="step-address" className="m-0 text-[19px] font-semibold">
                  {tFlow("address.title")}
                </h2>
                <p className="text-muted m-0 mt-1 mb-4 text-sm">
                  {split
                    ? tFlow("address.subSplit")
                    : addresses.length > 0
                      ? tFlow("address.subSaved")
                      : tFlow("address.subNone")}
                </p>
                {split ? (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {cart.items.map((item) => (
                      <li key={item.id} className="border-border rounded-xl border p-3.5">
                        <p className="m-0 mb-2 font-semibold">{productNameOf(locale, item.summary)}</p>
                        <Destinations
                          key={item.destinations.map((d) => `${d.addressId}:${d.quantity}`).join("|") + item.quantity}
                          item={item}
                          addresses={addresses}
                          saving={edit.isPending}
                          onAddAddress={() => setAddingAddress(true)}
                          onSave={(rows) =>
                            edit.mutate(() =>
                              editCart((ifMatch) =>
                                api.PUT("/v1/store/cart/items/{itemId}/destinations", {
                                  params: { path: { itemId: item.id }, header: { "If-Match": ifMatch } },
                                  body: { destinations: rows },
                                }),
                              ),
                            )
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : addresses.length > 0 ? (
                  <RadioCards
                    aria-label={tFlow("address.title")}
                    columns={2}
                    value={addressId}
                    onValueChange={(id) => shipAllTo(id, cart)}
                    options={addresses.map((address) => ({
                      value: address.id,
                      label: `${address.recipientName} · ${address.label}`,
                      description: addressLine(locale, address),
                      badge: address.isDefault ? tFlow("address.default") : undefined,
                    }))}
                  />
                ) : null}
                {addingAddress ? (
                  <div className={addresses.length > 0 ? "border-border mt-4 border-t pt-4" : undefined}>
                    <AddressForm
                      onCancel={addresses.length > 0 ? () => setAddingAddress(false) : undefined}
                      onSaved={(address) => {
                        setAddresses((current) => [...current, address]);
                        setAddingAddress(false);
                        if (!split) shipAllTo(address.id, cart);
                      }}
                    />
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconStart="plus"
                    className="mt-3"
                    onClick={() => setAddingAddress(true)}
                  >
                    {tFlow("address.add")}
                  </Button>
                )}
              </section>

              <section className={box}>
                <Switch
                  className="border-border rounded-xl border p-3.5"
                  checked={split}
                  labelPosition="start"
                  label={<b className="text-[14.5px] font-semibold">{tFlow("address.split")}</b>}
                  description={tFlow("address.splitHint")}
                  onCheckedChange={(on) => {
                    setSplit(on);
                    trackCheckout("checkout_split_toggle", { on });
                    if (!on && addressId) shipAllTo(addressId, cart);
                  }}
                />
              </section>

              <section aria-labelledby="step-shipping" className={box}>
                <div className="flex gap-3 text-[13.5px]">
                  <Icon name="truck" size={20} aria-hidden="true" className="text-muted mt-0.5 shrink-0" />
                  <div className="min-w-0" aria-live="polite">
                    <h2 id="step-shipping" className="text-fg m-0 text-sm font-semibold">
                      {tFlow("address.shippingTitle")}
                    </h2>
                    {pending && !data ? (
                      <p className="text-muted m-0">{tFlow("address.pending")}</p>
                    ) : figures ? (
                      <p className="text-muted m-0">
                        {[
                          isFreeShipping(figures.shipping)
                            ? tShipping("free")
                            : tFlow("address.shippingAmount", { amount: format.thb(figures.shipping) }),
                          !split && estimate.data?.zone
                            ? tFlow("address.zone", {
                                zone: locale === "en" ? estimate.data.zone.en : estimate.data.zone.th,
                              })
                            : null,
                          arrival
                            ? arrival.from === arrival.to
                              ? tFlow("address.arrivalOne", { date: format.date(arrival.from) })
                              : tFlow("address.arrival", {
                                  from: format.date(arrival.from),
                                  to: format.date(arrival.to),
                                })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : (
                      <p className="text-muted m-0">{tFlow("address.chooseFirst")}</p>
                    )}
                  </div>
                </div>
              </section>
              {navButtons}
            </>
          ) : null}

          {step === "payment" ? (
            <>
              <section aria-labelledby="step-tax" className={box}>
                <h2 id="step-tax" className="sr-only">
                  {tFlow("payment.profiles")}
                </h2>
                <Switch
                  className="border-border rounded-xl border p-3.5"
                  checked={taxInvoice}
                  labelPosition="start"
                  label={<b className="text-[14.5px] font-semibold">{tFlow("payment.taxToggle")}</b>}
                  description={
                    issuerName ? tFlow("payment.taxIssuer", { issuer: issuerName }) : tFlow("payment.taxNoIssuer")
                  }
                  onCheckedChange={(on) => {
                    setTaxInvoice(on);
                    trackCheckout("checkout_tax_invoice_toggle", { on });
                    if (on && profiles.length === 0) setAddingProfile(true);
                  }}
                />
                {taxInvoice ? (
                  <div className="mt-4 flex flex-col gap-3">
                    {profiles.length > 0 ? (
                      <RadioCards
                        aria-label={tFlow("payment.profiles")}
                        columns={2}
                        value={taxProfileId ?? undefined}
                        onValueChange={setTaxProfileId}
                        options={profiles.map((candidate) => ({
                          value: candidate.id,
                          label: candidate.name,
                          // DECISIONS-STAGE-A §3: the full tax id, never masked.
                          description: `${t(`tax.types.${candidate.taxType}`)} · ${formatTaxId(candidate.taxId)} · ${
                            candidate.branchType === "head_office"
                              ? t("tax.headOffice")
                              : t("tax.branch", { code: candidate.branchCode })
                          }${candidate.withholdsTax ? ` · ${t("tax.withholds")}` : ""}`,
                        }))}
                      />
                    ) : null}
                    {addingProfile ? (
                      <div className={profiles.length > 0 ? "border-border border-t pt-4" : undefined}>
                        <TaxProfileForm
                          shippingAddress={split ? null : chosenAddress}
                          onCancel={() => setAddingProfile(false)}
                          onSaved={(saved) => {
                            setProfiles((current) => [...current, saved]);
                            setTaxProfileId(saved.id);
                            setAddingProfile(false);
                          }}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconStart="plus"
                        className="self-start"
                        onClick={() => setAddingProfile(true)}
                      >
                        {tFlow("payment.newProfile")}
                      </Button>
                    )}
                  </div>
                ) : null}
              </section>

              <section aria-labelledby="step-methods" className={box}>
                <h2 id="step-methods" className="m-0 text-[19px] font-semibold">
                  {tFlow("payment.methodsTitle")}
                </h2>
                <p className="text-muted m-0 mt-1 mb-4 text-sm">
                  {data && !methodShown ? tFlow("payment.methodsNone") : tFlow("payment.methodsSub")}
                </p>
                {!data ? (
                  <Skeleton className="h-24 w-full" />
                ) : methodShown ? (
                  <RadioCards
                    aria-label={tFlow("payment.methodsTitle")}
                    columns={2}
                    value={chosenMethod}
                    onValueChange={(value) => {
                      setMethod(value as PaymentMethod);
                      trackCheckout("checkout_payment_select", { method: value, plan });
                    }}
                    options={methods.map((option) => ({
                      value: option,
                      label: (
                        <span className="inline-flex items-center gap-2">
                          {METHOD_ICONS[option] ? (
                            <Icon name={METHOD_ICONS[option]!} size={18} aria-hidden="true" />
                          ) : null}
                          {tMethods(`${option}.label`)}
                        </span>
                      ),
                      description: tMethods(`${option}.description`),
                    }))}
                  />
                ) : null}
                <h3 className="m-0 mt-4.5 text-[13.5px] font-semibold">{tFlow("payment.planTitle")}</h3>
                <p className="text-muted m-0 mb-2 text-xs">{tFlow("payment.planHint")}</p>
                {data ? (
                  data.paymentSchedule ? (
                    <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
                      {data.paymentSchedule.instalments.map((instalment) => (
                        <li
                          key={instalment.seq}
                          className="border-border bg-surface rounded-xl border px-3 py-2.5 text-[13.5px]"
                        >
                          <b className="block font-semibold">{pick(locale, instalment.labelTh, instalment.labelEn)}</b>
                          <small className="text-muted text-xs tabular-nums">
                            {format.thb(instalment.grossAmount)}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted m-0 text-sm">{t("schedule.none")}</p>
                  )
                ) : (
                  <Skeleton className="h-14 w-full" />
                )}
              </section>

              {(pointsBounds?.balance ?? pointsBalance) > 0 ? (
                <section aria-labelledby="step-points" className={box}>
                  <h2 id="step-points" className="m-0 text-[17px] font-semibold">
                    {tFlow("payment.pointsTitle")}
                  </h2>
                  <p className="text-muted m-0 mt-1 mb-3 text-sm">
                    {t("points.hint", { balance: format.number(pointsBounds?.balance ?? pointsBalance) })}
                  </p>
                  <Field
                    label={t("points.redeem")}
                    className="w-48"
                    hint={
                      pointsBounds
                        ? t("points.bounds", {
                            min: format.number(pointsBounds.minimumPoints),
                            max: format.number(pointsBounds.maximumPoints),
                          })
                        : undefined
                    }
                  >
                    <NumberInput
                      min={0}
                      max={pointsBounds?.maximumPoints ?? pointsBalance}
                      step={1}
                      unit={t("points.unit")}
                      value={points || ""}
                      onChange={(event) => setPoints(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                    />
                  </Field>
                </section>
              ) : null}

              {company ? (
                <section aria-labelledby="step-company" className={box}>
                  <h2 id="step-company" className="m-0 text-[17px] font-semibold">
                    {tFlow("payment.companyTitle")}
                  </h2>
                  <p className="text-muted m-0 mt-1 mb-3 text-sm">
                    {t("company.intro", { name: company.legalName, code: company.companyCode ?? "" })}
                  </p>
                  {company.poNumberPolicy !== "none" ? (
                    <Field
                      label={t("company.po")}
                      hint={company.poNumberPolicy === "required" ? t("company.poRequired") : t("company.poOptional")}
                      required={company.poNumberPolicy === "required"}
                      requiredLabel={t("company.required")}
                    >
                      <Input
                        ref={poRef}
                        value={poNumber}
                        maxLength={60}
                        onChange={(event) => setPoNumber(event.target.value)}
                        className="max-w-64"
                      />
                    </Field>
                  ) : null}
                  {data?.company ? (
                    <p className="text-muted m-0 mt-2 text-sm">
                      {data.company.onCredit
                        ? t("company.onCredit", {
                            days: data.company.creditTermDays ?? 0,
                            available: format.thb(data.company.creditAvailableAmount),
                          })
                        : t("company.prepaid")}
                      {data.company.approvalRequired && data.company.approvalThreshold
                        ? ` · ${t("company.approval", { amount: format.thb(data.company.approvalThreshold) })}`
                        : ""}
                    </p>
                  ) : null}
                </section>
              ) : null}
              {navButtons}
            </>
          ) : null}

          {step === "review" ? (
            <>
              <section aria-labelledby="step-review" className={box}>
                <h2 id="step-review" className="m-0 text-[19px] font-semibold">
                  {tFlow("review.title")}
                </h2>
                <p className="text-muted m-0 mt-1 mb-4 text-sm">{tFlow("review.sub")}</p>
                <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[8.75rem_minmax(0,1fr)]">
                  <dt className="text-muted">{tFlow("review.items")}</dt>
                  <dd className="m-0">
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {cart.items.map((item, index) => (
                        <li key={item.id}>
                          {tFlow("review.itemLine", {
                            name: productNameOf(locale, item.summary),
                            quantity: format.number(item.quantity),
                            unit: tUnits(item.summary.unit),
                          })}
                          {index === cart.items.length - 1 ? (
                            <EditLink label={tFlow("review.items")} onClick={() => go("cart")} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </dd>
                  <dt className="text-muted">{tFlow("review.design")}</dt>
                  <dd className="m-0">
                    {[...new Set(cart.items.map((item) => tDesign(`${item.designOption}.label`)))].join(" · ")}
                  </dd>
                  <dt className="text-muted">{tFlow("review.delivery")}</dt>
                  <dd className="m-0">
                    {split
                      ? tFlow("review.splitCount", { count: destinationCount })
                      : chosenAddress
                        ? `${chosenAddress.recipientName} · ${addressLine(locale, chosenAddress)}`
                        : "—"}
                    <EditLink label={tFlow("review.delivery")} onClick={() => go("address")} />
                  </dd>
                  {arrival || leadDays !== null ? (
                    <>
                      <dt className="text-muted">{tFlow("review.arrival")}</dt>
                      <dd className="m-0">
                        {[
                          arrival
                            ? arrival.from === arrival.to
                              ? format.date(arrival.from)
                              : `${format.date(arrival.from)} – ${format.date(arrival.to)}`
                            : null,
                          leadDays !== null ? tFlow("summary.production", { days: leadDays }) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted">{tFlow("review.tax")}</dt>
                  <dd className="m-0">
                    {taxInvoice && profile
                      ? `${profile.name} · ${formatTaxId(profile.taxId)} · ${
                          profile.branchType === "head_office"
                            ? t("tax.headOffice")
                            : t("tax.branch", { code: profile.branchCode })
                        }`
                      : tFlow("review.receipt")}
                    <EditLink label={tFlow("review.tax")} onClick={() => go("payment")} />
                  </dd>
                  <dt className="text-muted">{tFlow("review.payment")}</dt>
                  <dd className="m-0">
                    {[
                      methodShown ? tMethods(`${chosenMethod}.label`) : tFlow("review.paymentLater"),
                      data?.paymentSchedule
                        ? data.paymentSchedule.instalments
                            .map((instalment) => pick(locale, instalment.labelTh, instalment.labelEn))
                            .join(" + ")
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    <EditLink label={tFlow("review.payment")} onClick={() => go("payment")} />
                  </dd>
                  <dt className="text-muted">{tFlow("review.standards")}</dt>
                  <dd className="m-0">{tFlow("review.standardsText")}</dd>
                </dl>
                <div className="mt-4">
                  <Checkbox
                    ref={termsRef}
                    checked={agreed}
                    aria-invalid={agreeError && !agreed ? true : undefined}
                    aria-describedby={agreeError && !agreed ? "terms-error" : undefined}
                    onCheckedChange={(checked) => {
                      setAgreed(checked === true);
                      if (checked === true) setAgreeError(false);
                    }}
                    label={tFlow.rich("review.agree", {
                      terms: (chunks) => (
                        <Link href="/legal/terms" className="text-primary underline underline-offset-4">
                          {chunks}
                        </Link>
                      ),
                      guarantee: (chunks) => (
                        <Link href="/guarantee" className="text-primary underline underline-offset-4">
                          {chunks}
                        </Link>
                      ),
                    })}
                  />
                  {agreeError && !agreed ? (
                    <p id="terms-error" role="alert" className="text-danger m-0 mt-1.5 text-xs font-medium">
                      {tFlow("review.agreeError")}
                    </p>
                  ) : null}
                </div>
              </section>
              <section className={box}>
                <div className="flex gap-3 text-[13.5px]">
                  <Icon name="upload" size={20} aria-hidden="true" className="text-muted mt-0.5 shrink-0" />
                  <p className="text-muted m-0">
                    <b className="text-fg block">{tFlow("review.after")}</b>
                    {designAfter}
                  </p>
                </div>
              </section>
              {navButtons}
            </>
          ) : null}
        </div>

        <OrderSummary
          rows={rows}
          total={{ label: tFlow("summary.total"), value: totalValue, hint: totalHint }}
          pending={pending}
          codes={
            <PromoCodeBox
              variant="compact"
              codes={cart.codes}
              maxCodes={cart.maxCodes}
              note={step === "payment" ? undefined : tFlow("summary.codesNote")}
              pending={edit.isPending}
              applied={appliedPromotions}
              error={codeError}
              onApply={applyCode}
              onRemove={removeCode}
            />
          }
          extra={
            <>
              {repriced && data ? (
                <Callout tone="warning" live title={t("repriced.title")}>
                  {t("repriced.body", {
                    before: format.thb(repriced.before),
                    after: format.thb(data.totals.grossAmount),
                  })}
                </Callout>
              ) : null}
              {figures?.withholding ? (
                <p className="text-muted m-0 text-xs">
                  {t("summary.withholding")} {t("summary.minus", { amount: format.thb(figures.withholding) })} ·{" "}
                  {t("summary.withholdingHint")}
                </p>
              ) : null}
              {dueNow && (data?.paymentSchedule?.instalments.length ?? 0) + (figures?.withholding ? 1 : 0) > 1 ? (
                <div className="bg-bg-subtle rounded-lg p-3">
                  <p className="m-0 text-sm">{pick(locale, dueNow.labelTh, dueNow.labelEn)}</p>
                  <p className="m-0 text-lg font-bold tabular-nums">
                    {tFlow("summary.payNow", { amount: format.thb(dueNow.cashAmount) })}
                  </p>
                </div>
              ) : null}
              {data?.points && data.points.toEarn > 0 ? (
                <p className="text-muted m-0 text-xs">
                  {tFlow("summary.pointsToEarn", { points: format.number(data.points.toEarn) })}
                </p>
              ) : null}
              {/* Delivery the API refuses is a step-2 blocker; anything else it refuses is said here. */}
              {preview.isError && !ADDRESS_PROBLEMS.has(previewError ?? "") ? (
                <Callout tone="danger" title={t("blockedTitle")}>
                  {isApiError(preview.error) ? preview.error.detail : t("previewFailed")}
                </Callout>
              ) : null}
              {failure ? (
                <Callout tone="danger" live>
                  {failure}
                </Callout>
              ) : null}
            </>
          }
          notices={
            data && data.notices.some((notice) => !PROMOTION_NOTICES.has(notice.code)) ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {data.notices
                  .filter((notice) => !PROMOTION_NOTICES.has(notice.code))
                  .map((notice, index) => (
                    <li key={`${notice.code}-${index}`} className="bg-bg-subtle rounded-lg px-3 py-2">
                      {noticeText(notice)}
                    </li>
                  ))}
              </ul>
            ) : null
          }
          blockers={here.map(blockerText)}
          primary={primary}
          onBlocked={onBlocked}
          trust={trust}
        />
      </div>
      <MobileBar
        total={totalValue}
        note={figures ? tFlow("summary.totalWithShipping") : tFlow("summary.totalNoShipping")}
        action={mobileAction}
        blocked={here.length > 0}
        onBlocked={onBlocked}
      />
    </>
  );
}

function EditLink({ label, onClick }: { label: string; onClick: () => void }) {
  const t = useTranslations("checkout.flow.review");
  return (
    <button
      type="button"
      className="text-primary focus-visible:ring-focus-ring ms-2 rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-2"
      onClick={onClick}
    >
      {t("edit")}
      <span className="sr-only"> {label}</span>
    </button>
  );
}
