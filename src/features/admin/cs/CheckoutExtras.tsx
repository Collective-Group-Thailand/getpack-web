"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, useCan } from "../console";

type Cart = Schemas["CartDto"];
type CartItem = Cart["items"][number];
type Preview = Schemas["CheckoutPreviewDto"];

/**
 * Coupon codes on the customer's cart (D-053): a code is checked when entered — status, window,
 * whether it is this customer's, uses left — and kept; the checkout preview then shows the
 * discount or why it does not apply. Usage is reserved only at checkout.
 */
export function CartCodes({
  customerId,
  cart,
  etag,
  onChanged,
}: {
  customerId: string;
  cart: Cart;
  /** The cart's ETag: codes change the cart, so each write sends it as `If-Match`. */
  etag: string | null;
  onChanged: () => void;
}) {
  const t = useTranslations("cs.checkout.codes");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const path = { customerId };
  const apply = async () => {
    const value = code.trim().toUpperCase();
    if (!value) return;
    setBusy("apply");
    try {
      await adminBrowserApis().contract.POST("/v1/admin/customers/{customerId}/cart/codes", {
        params: { path, header: { "If-Match": etag ?? "" } },
        body: { code: value },
      });
      setCode("");
      onChanged();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(null);
    }
  };
  const remove = async (value: string) => {
    setBusy(value);
    try {
      await adminBrowserApis().contract.DELETE("/v1/admin/customers/{customerId}/cart/codes/{code}", {
        params: { path: { ...path, code: value }, header: { "If-Match": etag ?? "" } },
      });
      onChanged();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field label={t("label")} className="flex-1">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void apply();
              }
            }}
          />
        </Field>
        <Button variant="secondary" loading={busy === "apply"} disabled={!code.trim()} onClick={() => void apply()}>
          {t("apply")}
        </Button>
      </div>
      <p className="text-muted -mt-1 text-xs">{t("hint")}</p>
      {cart.codes.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {cart.codes.map((entry) => (
            <li key={entry.code} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{entry.code}</span>
              {entry.status === "validated" ? (
                <Badge size="sm" tone="success" icon="check">
                  {t("validated")}
                </Badge>
              ) : (
                <Badge size="sm" tone="danger" icon="ban">
                  {t("rejected")}
                </Badge>
              )}
              {entry.rejectReason ? <span className="text-muted text-xs">{entry.rejectReason}</span> : null}
              <IconButton
                name="close"
                size="sm"
                variant="ghost"
                label={t("remove", { code: entry.code })}
                disabled={busy === entry.code}
                onClick={() => void remove(entry.code)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A cart item whose 15-day price lock passed (D-051): CS re-prices it into a new quotation at
 * today's prices, the item shows the difference, and the new price is taken only when accepted.
 */
export function CartItemReprice({
  customerId,
  item,
  etag,
  onChanged,
}: {
  customerId: string;
  item: CartItem;
  etag: string | null;
  onChanged: () => void;
}) {
  const t = useTranslations("cs.checkout.reprice");
  const format = useFormat();
  const [busy, setBusy] = useState(false);
  const path = { customerId, itemId: item.id };
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      onChanged();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  };
  if (item.pendingReprice) {
    const change = item.pendingReprice;
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <span>
          {t("difference", {
            from: format.thb(change.previousGrossAmount),
            to: format.thb(change.newGrossAmount),
          })}
        </span>
        <Button
          size="sm"
          loading={busy}
          onClick={() =>
            void run(
              () =>
                adminBrowserApis().contract.POST(
                  "/v1/admin/customers/{customerId}/cart/items/{itemId}/actions/confirm-reprice",
                  {
                    params: { path, header: { "If-Match": etag ?? "" } },
                  },
                ),
              t("accepted"),
            )
          }
        >
          {t("accept")}
        </Button>
      </span>
    );
  }
  if (item.priceLocked) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={() =>
        void run(
          () =>
            adminBrowserApis().contract.POST("/v1/admin/customers/{customerId}/cart/items/{itemId}/actions/reprice", {
              params: { path },
            }),
          t("repriced"),
        )
      }
    >
      {t("reprice")}
    </Button>
  );
}

/**
 * A payment schedule other than the one checkout would pick (D-020, "overridden with
 * permission"): only templates in force, with the reason recorded on the group.
 */
export function ScheduleChoice({
  value,
  onChange,
}: {
  value: { templateKey: string; reason: string } | null;
  onChange: (value: { templateKey: string; reason: string } | null) => void;
}) {
  const t = useTranslations("cs.checkout.schedule");
  const locale = useLocale();
  const format = useFormat();
  const allowed = useCan("payment_schedules.override");
  const templates = useQuery({
    enabled: allowed,
    queryKey: queryKeys.list("admin", "payment_schedule_template"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/payment-schedule-templates")).data!,
  });
  if (!allowed) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("label")} hint={t("hint")}>
        <SearchableSelect
          value={value?.templateKey ?? "auto"}
          onValueChange={(templateKey) =>
            onChange(templateKey === "auto" ? null : { templateKey, reason: value?.reason ?? "" })
          }
          options={[
            { value: "auto", label: t("auto") },
            ...(templates.data ?? [])
              .filter((template) => template.versionNo !== null)
              .map((template) => ({
                value: template.key,
                label: `${locale === "en" ? template.nameEn : template.nameTh} · ${template.instalments
                  .map((instalment) => format.percent(instalment.pct))
                  .join(" / ")}`,
              })),
          ]}
        />
      </Field>
      {value ? (
        <Field label={t("reason")} required>
          <Input value={value.reason} onChange={(event) => onChange({ ...value, reason: event.target.value })} />
        </Field>
      ) : null}
    </div>
  );
}

/**
 * What checkout would charge, priced exactly as it will be (`admin.checkout.preview`): locked
 * quotation prices, shipping per destination, discounts with any cap, VAT, the withholding of the
 * chosen tax profile and the instalments. Nothing is written.
 */
export function PreviewPanel({ preview }: { preview: Preview }) {
  const t = useTranslations("cs.checkout.preview");
  const locale = useLocale();
  const format = useFormat();
  const totals = preview.totals;
  const notice = (code: string, params: Record<string, unknown> = {}) => {
    const key = `notices.${code.replace(/\./g, "_")}`;
    const values = Object.fromEntries(Object.entries(params).map(([name, value]) => [name, String(value)]));
    return t.has(key) ? t(key, values) : code;
  };
  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("net")}</dt>
        <dd className="text-end tabular-nums">{format.thb(totals.netAmount)}</dd>
        <dt className="text-muted">{t("shipping")}</dt>
        <dd className="text-end tabular-nums">{format.thb(totals.shippingNetAmount)}</dd>
        <dt className="text-muted">{t("discount")}</dt>
        <dd className="text-end tabular-nums">{t("minus", { amount: format.thb(totals.discountAmount) })}</dd>
        <dt className="text-muted">{t("vat")}</dt>
        <dd className="text-end tabular-nums">{format.thb(totals.vatAmount)}</dd>
        <dt className="font-medium">{t("gross")}</dt>
        <dd className="text-end font-semibold tabular-nums">{format.thb(totals.grossAmount)}</dd>
        {preview.withholding ? (
          <>
            <dt className="text-muted">{t("wht")}</dt>
            <dd className="text-end tabular-nums">{t("minus", { amount: format.thb(totals.whtAmount) })}</dd>
            <dt className="font-medium">{t("cash")}</dt>
            <dd className="text-end font-semibold tabular-nums">{format.thb(totals.cashAmount)}</dd>
          </>
        ) : null}
      </dl>
      {preview.orders.flatMap((order) => order.discounts).length ? (
        <ul className="mt-3 flex flex-col gap-0.5 text-xs">
          {preview.orders
            .flatMap((order) => order.discounts)
            .map((discount, index) => (
              <li key={index}>
                {t("discountLine", { source: discount.code ?? discount.source, amount: format.thb(discount.amount) })}
                {discount.cappedAmount !== "0.00"
                  ? ` · ${t("capped", { amount: format.thb(discount.cappedAmount) })}`
                  : ""}
              </li>
            ))}
        </ul>
      ) : null}
      {preview.paymentSchedule ? (
        <ol className="border-border mt-3 flex flex-col gap-0.5 border-t pt-2 text-xs">
          {preview.paymentSchedule.instalments.map((instalment) => (
            <li key={instalment.seq} className="flex justify-between gap-2">
              <span>{locale === "en" ? instalment.labelEn : instalment.labelTh}</span>
              <span className="tabular-nums">{format.thb(instalment.cashAmount)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {preview.company?.approvalRequired ? <Callout tone="info" className="mt-3" title={t("companyApproval")} /> : null}
      {preview.notices.length ? (
        <ul className="text-warning-subtle-fg mt-3 flex flex-col gap-0.5 text-xs">
          {preview.notices.map((entry, index) => (
            <li key={index}>{notice(entry.code, entry.params ?? {})}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
