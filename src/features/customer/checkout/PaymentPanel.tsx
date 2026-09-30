"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ONLINE_PAYMENT_METHODS } from "@/domain/payment-methods";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { PAYMENT_STATUS } from "@/domain/status";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { QRCode } from "@/ui/components/QRCode";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

export type Payment = Schemas["PaymentDto"];
type Method = Payment["method"];

const FINAL = new Set(["succeeded", "failed", "expired", "cancelled", "refunded", "partially_refunded"]);
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/** Minutes and seconds until `until`, ticking; `null` once it has passed. */
function useCountdown(until: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  if (!until) return null;
  const left = Date.parse(until) - now;
  return left > 0 ? left : 0;
}

/**
 * Paying (F3 3.3, `store.payments.get`): a PromptPay/SCB QR drawn from the payload the API gives,
 * with its countdown and the status as it changes (the API settles it from the gateway's webhook;
 * the page watches), the 2C2P redirect for card and online banking, or a transfer and its slip,
 * verified at once or by Finance within 4 business hours (D-061). Another method is one tap away —
 * a new payment on the same order group (`store.payments.initiate`).
 *
 * CONTRACT-GAP store.payments — the published payment has no receiver bank account for a transfer
 * and no failure reason, so the page asks for the slip without showing where to transfer, and a
 * failure says so in general words.
 */
export function PaymentPanel({ initial }: { initial: Payment }) {
  const t = useTranslations("payment");
  const tMethods = useTranslations("checkout.methods");
  const format = useFormat();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const paidOnce = useRef(false);

  const payment = useQuery({
    queryKey: queryKeys.detail("customer", "payment", initial.id),
    queryFn: async () =>
      (await browserApi().GET("/v1/store/payments/{paymentId}", { params: { path: { paymentId: initial.id } } })).data!,
    initialData: initial,
    // The webhook settles it; the realtime channel invalidates this key, and polling covers the gap.
    refetchInterval: (query) =>
      FINAL.has(query.state.data?.status ?? "") || query.state.data?.method === "bank_transfer_slip" ? false : 3000,
  });
  const data = payment.data;
  const left = useCountdown(data.status === "pending" ? data.expiresAt : null);

  useEffect(() => {
    if (data.status === "succeeded" && !paidOnce.current) {
      paidOnce.current = true;
      track("order_paid", { route: "/checkout/pay/[paymentId]" });
    }
  }, [data.status]);

  async function restart(method: Method) {
    if (!data.groupId) return;
    setSwitching(true);
    try {
      const { data: next } = await browserApi().POST("/v1/store/order-groups/{groupId}/payments", {
        params: { path: { groupId: data.groupId }, header: { "Idempotency-Key": newKey() } },
        body: { method },
      });
      router.replace(`/checkout/pay/${next!.id}`);
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      setSwitching(false);
    }
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-muted text-sm">{t("reference", { code: data.referenceCode })}</p>
        <p className="text-3xl font-bold tabular-nums">{format.thb(data.cashAmount)}</p>
        {data.whtAmount !== "0.00" ? (
          <p className="text-muted text-xs">
            {t("withheld", { total: format.thb(data.amount), wht: format.thb(data.whtAmount) })}
          </p>
        ) : null}
      </div>
      <StatusChip map={PAYMENT_STATUS} value={data.status} size="md" />
    </div>
  );

  if (data.status === "succeeded") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Callout tone="success" live title={t("paidTitle")}>
          {t("paidBody", { date: format.dateTime(data.paidAt) })}
        </Callout>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/account/orders">{t("toOrders")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/account/instalments">{t("toInstalments")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const others = ONLINE_PAYMENT_METHODS.filter((method) => method !== data.method);

  return (
    <div className="flex flex-col gap-6">
      {header}
      {data.status === "failed" ? (
        <Callout tone="danger" live title={t("failedTitle")}>
          {t("failedBody")}
        </Callout>
      ) : null}
      {data.status === "expired" ? (
        <Callout tone="warning" live title={t("expiredTitle")}>
          {data.groupId ? (
            <Button size="sm" className="mt-2" loading={switching} onClick={() => void restart(data.method)}>
              {t("newQr")}
            </Button>
          ) : null}
        </Callout>
      ) : null}

      {data.qrPayload && data.status === "pending" ? (
        <section
          aria-labelledby="pay-qr"
          className="border-border flex flex-col items-center gap-3 rounded-2xl border p-6 text-center"
        >
          <h2 id="pay-qr" className="font-semibold">
            {t("qrTitle")}
          </h2>
          <QRCode
            value={data.qrPayload}
            size={240}
            label={t("qrAlt", { amount: format.thb(data.cashAmount) })}
            className="rounded-lg bg-white p-2"
          />
          {left !== null ? (
            <p className="tabular-nums" aria-live="off">
              {t("countdown", {
                minutes: Math.floor(left / 60_000),
                seconds: String(Math.floor((left % 60_000) / 1000)).padStart(2, "0"),
              })}
            </p>
          ) : null}
          <p className="text-muted flex items-center gap-2 text-sm" aria-live="polite">
            <Icon name="spinner" size={16} className="animate-spin" aria-hidden="true" />
            {t("waiting")}
          </p>
          <ol className="text-muted list-decimal ps-5 text-start text-sm">
            <li>{t("qrStep1")}</li>
            <li>{t("qrStep2")}</li>
            <li>{t("qrStep3")}</li>
          </ol>
        </section>
      ) : null}

      {data.redirectUrl && data.status === "pending" ? (
        <section aria-labelledby="pay-redirect" className="border-border rounded-2xl border p-6">
          <h2 id="pay-redirect" className="font-semibold">
            {tMethods(`${data.method}.label`)}
          </h2>
          <p className="text-muted mt-1 text-sm">{t("redirectBody")}</p>
          <Button asChild className="mt-4" iconEnd="external">
            <a href={data.redirectUrl}>{t("redirect")}</a>
          </Button>
        </section>
      ) : null}

      {data.method === "bank_transfer_slip" ? (
        <SlipSection payment={data} onChange={() => void payment.refetch()} />
      ) : null}

      {data.groupId && (!FINAL.has(data.status) || data.status === "failed") ? (
        <section aria-labelledby="pay-other">
          <h2 id="pay-other" className="text-sm font-medium">
            {t("otherMethods")}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((method) => (
              <Button
                key={method}
                size="sm"
                variant="secondary"
                loading={switching}
                onClick={() => void restart(method)}
              >
                {tMethods(`${method}.label`)}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SlipSection({ payment, onChange }: { payment: Payment; onChange: () => void }) {
  const t = useTranslations("payment.slip");
  const format = useFormat();
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(payment.cashAmount);
  const [at, setAt] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newKey());
  const latest = payment.slips.at(-1);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !/^\d+(\.\d{1,2})?$/.test(amount) || !at) {
      setFailure(t("incomplete"));
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      const uploaded = await uploadFile("customer", file, "slip");
      const [whole, fraction = ""] = amount.split(".");
      await browserApi().POST("/v1/store/payments/{paymentId}/slips", {
        params: { path: { paymentId: payment.id }, header: { "Idempotency-Key": key.current } },
        body: {
          fileId: uploaded.id,
          declaredAmount: `${whole}.${fraction.padEnd(2, "0")}`,
          transferredAt: `${at}:00+07:00`,
        },
      });
      key.current = newKey();
      setFile(null);
      onChange();
    } catch (error) {
      if (isApiError(error)) key.current = newKey();
      setFailure(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="pay-transfer" className="border-border flex flex-col gap-4 rounded-2xl border p-6">
      <h2 id="pay-transfer" className="font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted text-sm">{t("accountElsewhere")}</p>

      {latest?.status === "manual_review" ? (
        <Callout tone="info" live title={t("reviewTitle")}>
          {latest.slaDueAt ? t("reviewBody", { date: format.dateTime(latest.slaDueAt) }) : null}
        </Callout>
      ) : null}
      {latest?.status === "manual_rejected" || latest?.status === "failed" ? (
        <Callout tone="danger" live title={t("rejectedTitle")}>
          {t("rejectedBody")}
        </Callout>
      ) : null}

      {payment.status !== "awaiting_verification" ? (
        <form noValidate onSubmit={(event) => void send(event)} className="flex flex-col gap-4">
          <FileDropzone
            accept="image/*,application/pdf"
            maxBytes={10 * 1024 * 1024}
            onFiles={(files) => setFile(files[0] ?? null)}
            labels={{
              prompt: t("dropPrompt"),
              browse: t("browse"),
              hint: file ? t("chosen", { name: file.name }) : t("fileRules"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("amount")} hint={t("amountHint")}>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
                className="tabular-nums"
              />
            </Field>
            <Field label={t("transferredAt")}>
              <Input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} />
            </Field>
          </div>
          {failure ? (
            <Callout tone="danger" live>
              {failure}
            </Callout>
          ) : null}
          <Button type="submit" loading={sending} className="self-start" iconStart="upload">
            {t("send")}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
