"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { toast } from "@/ui/components/Toast";

import {
  confirmRequote,
  differenceDirection,
  previewRequote,
  requoteFailureOf,
  type RequoteFailure,
  type RequotePreview,
} from "./requote";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

type Phase =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "preview"; preview: RequotePreview; stale: boolean }
  | { kind: "confirming"; preview: RequotePreview }
  | { kind: "done"; preview: RequotePreview }
  | { kind: "failed"; failure: RequoteFailure; message: string | null };

export interface RequoteButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  groupId: string;
  /** Where the customer pays once the new price is written (the order's payment section). */
  payHref: string;
  /** Called when the customer starts the re-quote (analytics). */
  onOpen?: () => void;
  /** Start at once — the order page opened from the overdue reminder's link (`?requote=1`, D-453). */
  autoOpen?: boolean;
}

/**
 * "ตรวจราคาใหม่และชำระ" (D-436): an unpaid group past its deadline is never cancelled; the customer
 * prices it again at today's price (`requoteGroup`, nothing changes yet), reads the difference, and
 * only then writes it (`confirmRequote`, with the preview's total and an `Idempotency-Key`). Payment
 * is the existing flow, from the page it lands on. Every amount and date is the API's.
 */
export function RequoteButton({ groupId, payHref, onOpen, autoOpen = false, ...button }: RequoteButtonProps) {
  const t = useTranslations("myOrders.requote");
  const format = useFormat();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  // One key per preview: a retry of the same confirmation replays, a new preview mints a new one.
  const [key, setKey] = useState(newKey);

  const load = useCallback(
    async (stale: boolean) => {
      setPhase({ kind: "loading" });
      try {
        const preview = await previewRequote(browserApi(), groupId);
        setKey(newKey());
        setPhase({ kind: "preview", preview, stale });
      } catch (error) {
        setPhase({
          kind: "failed",
          failure: requoteFailureOf(error),
          message: isApiError(error) ? error.detail : null,
        });
      }
    },
    [groupId],
  );

  // The reminder's link: open the preview once, on arrival.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoStarted.current) return;
    autoStarted.current = true;
    void load(false);
  }, [autoOpen, load]);

  async function confirm(preview: RequotePreview) {
    setPhase({ kind: "confirming", preview });
    try {
      await confirmRequote(browserApi(), groupId, preview, key);
      setPhase({ kind: "done", preview });
      toast.success(t("done"));
    } catch (error) {
      const failure = requoteFailureOf(error);
      // The price moved since the preview: show the new one, never write the old one.
      if (failure === "changed") await load(true);
      else setPhase({ kind: "failed", failure, message: isApiError(error) ? error.detail : null });
    }
  }

  const close = () => {
    const wasDone = phase.kind === "done";
    setPhase({ kind: "closed" });
    if (wasDone) router.refresh();
  };

  return (
    <>
      <Button
        {...button}
        iconStart="refresh"
        onClick={() => {
          onOpen?.();
          void load(false);
        }}
      >
        {t("action")}
      </Button>
      <Dialog
        open={phase.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t("title")}
        description={t("intro")}
        closeLabel={t("close")}
      >
        {phase.kind === "loading" ? (
          <p role="status" className="text-muted text-sm">
            {t("loading")}
          </p>
        ) : null}

        {phase.kind === "failed" ? (
          <div className="flex flex-col gap-3">
            {phase.failure === "unavailable" ? (
              // No flow of our own: the team re-quotes (D-436).
              <Callout tone="info" title={t("unavailable.title")}>
                {t("unavailable.body")}
              </Callout>
            ) : phase.failure === "not_due" ? (
              <Callout tone="info">{t("notDue")}</Callout>
            ) : (
              <Callout tone="danger" live>
                {phase.message ?? t("failed")}
              </Callout>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {phase.failure === "unavailable" ? (
                <Button asChild>
                  <Link href="/help/contact">{t("contact")}</Link>
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => void load(false)}>
                  {t("retry")}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {phase.kind === "preview" || phase.kind === "confirming" || phase.kind === "done" ? (
          <Preview
            preview={phase.preview}
            stale={phase.kind === "preview" && phase.stale}
            done={phase.kind === "done"}
            confirming={phase.kind === "confirming"}
            onConfirm={() => void confirm(phase.preview)}
            onPay={() => {
              setPhase({ kind: "closed" });
              router.push(payHref);
              router.refresh();
            }}
            format={format}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function Preview({
  preview,
  stale,
  done,
  confirming,
  onConfirm,
  onPay,
  format,
}: {
  preview: RequotePreview;
  stale: boolean;
  done: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onPay: () => void;
  format: ReturnType<typeof useFormat>;
}) {
  const t = useTranslations("myOrders.requote");
  const direction = differenceDirection(preview.differenceAmount);
  return (
    <div className="flex flex-col gap-4">
      {stale ? (
        <Callout tone="warning" live>
          {t("changed")}
        </Callout>
      ) : null}
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("previousTotal")}</dt>
        <dd className="text-end tabular-nums">{format.thb(preview.previousGrossAmount)}</dd>
        <dt className="font-semibold">{t("newTotal")}</dt>
        <dd className="text-end font-semibold tabular-nums">{format.thb(preview.newGrossAmount)}</dd>
        <dt className="text-muted">{t(`difference.${direction}`)}</dt>
        <dd className="text-end tabular-nums">{direction === "same" ? "—" : format.thb(preview.differenceAmount)}</dd>
      </dl>
      <ul className="flex flex-col gap-2">
        {preview.orders.map((row) => (
          <li key={row.orderId} className="border-border rounded-lg border p-3 text-sm">
            <p className="font-medium tabular-nums">{row.orderCode}</p>
            <p className="text-muted">
              {t("orderLine", {
                previous: format.thb(row.previousGrossAmount),
                next: format.thb(row.newGrossAmount),
              })}
            </p>
            <p className="text-muted">
              {t(`orderDifference.${differenceDirection(row.differenceAmount)}`, {
                amount: format.thb(row.differenceAmount),
              })}
            </p>
            {row.promisedShipDate && row.estimatedDeliveryDate ? (
              <p className="text-muted">
                {t("orderDates", {
                  ship: format.date(row.promisedShipDate),
                  arrive: format.date(row.estimatedDeliveryDate),
                })}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-muted text-xs">
        {t("validity", { valid: format.date(preview.priceValidUntil), due: format.dateTime(preview.paymentDueAt) })}
      </p>
      {done ? (
        <>
          <Callout tone="success" live>
            {t("doneBody", { amount: format.thb(preview.newCashAmount), due: format.dateTime(preview.paymentDueAt) })}
          </Callout>
          <div className="flex justify-end">
            <Button iconStart="credit-card" onClick={onPay}>
              {t("goPay")}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex justify-end">
          <Button loading={confirming} onClick={onConfirm}>
            {t("confirm", { amount: format.thb(preview.newGrossAmount) })}
          </Button>
        </div>
      )}
    </div>
  );
}
