"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { RFQ_STATUS } from "@/domain/status";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

type Basket = Schemas["RfqBasketDto"];
type Choice = {
  itemId: string;
  rfqQuoteId: string;
  quantity: number;
  label: string;
  unitPrice: string;
  grossAmount: string;
};

/**
 * A sent basket (U5.4 §1, D-301): each item is its own RFQ, quoted like a single one. The customer
 * picks one quantity of each item's sent quotation and adds them to the cart together, at the quoted
 * prices, locked until each quotation's validity. Accepting is irreversible, so the dialog lists
 * every item, quantity and amount as the API gave them (no sums are made here).
 */
export function BasketQuotes({ basket }: { basket: Basket }) {
  const t = useTranslations("quoteRequests.basket");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const chosen = Object.values(choices);

  async function accept() {
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/rfq-baskets/{basketId}/actions/accept-items", {
        params: { path: { basketId: basket.id }, header: { "Idempotency-Key": key.current } },
        body: { items: chosen.map(({ itemId, rfqQuoteId, quantity }) => ({ itemId, rfqQuoteId, quantity })) },
      });
      toast.success(t("accepted", { count: chosen.length }), {
        action: { label: t("viewCart"), onClick: () => router.push("/cart") },
      });
      setChoices({});
      setConfirming(false);
      router.refresh();
    } catch (error) {
      key.current = newIdempotencyKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {basket.items.map((item, index) => {
          const rfq = item.rfq;
          const name = pick(locale, item.productType.nameTh, item.productType.nameEn);
          const sent = (rfq?.quotations ?? [])
            .filter((q) => q.status === "sent")
            .sort((a, b) => b.versionNo - a.versionNo)[0];
          const accepted = rfq?.acceptedQuoteId ?? null;
          return (
            <li key={item.id} className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {index + 1}. {name}
                  {rfq ? (
                    <Link
                      href={`/account/rfqs/${rfq.id}`}
                      className="text-primary ms-2 text-sm tabular-nums hover:underline"
                    >
                      {rfq.rfqCode}
                    </Link>
                  ) : null}
                </p>
                {rfq ? <StatusChip map={RFQ_STATUS} value={rfq.status} /> : null}
              </div>
              {accepted ? (
                <p className="text-success text-sm">{t("itemAccepted")}</p>
              ) : sent ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-muted mb-1 text-sm">
                    {sent.validUntil ? t("validUntil", { date: format.date(sent.validUntil) }) : t("chooseQuantity")}
                  </legend>
                  {sent.lines.map((line) => {
                    const id = `${item.id}-${line.quantity}`;
                    const checked = choices[item.id]?.quantity === line.quantity;
                    return (
                      <label
                        key={id}
                        htmlFor={id}
                        className="border-border has-[:checked]:border-primary has-[:checked]:bg-primary-subtle flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            id={id}
                            type="radio"
                            name={`quote-${item.id}`}
                            checked={checked}
                            onChange={() =>
                              setChoices((current) => ({
                                ...current,
                                [item.id]: {
                                  itemId: item.id,
                                  rfqQuoteId: sent.id,
                                  quantity: line.quantity,
                                  label: name,
                                  unitPrice: line.unitPrice,
                                  grossAmount: line.grossAmount,
                                },
                              }))
                            }
                          />
                          {t("line", { quantity: format.number(line.quantity), unit: format.thb(line.unitPrice) })}
                        </span>
                        <span className="tabular-nums">
                          {format.thb(line.grossAmount)} · {t("leadTime", { days: line.leadTimeDays })}
                        </span>
                      </label>
                    );
                  })}
                  {checked(choices, item.id) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="self-start"
                      onClick={() =>
                        setChoices((current) => {
                          const next = { ...current };
                          delete next[item.id];
                          return next;
                        })
                      }
                    >
                      {t("clearChoice")}
                    </Button>
                  ) : null}
                </fieldset>
              ) : (
                <p className="text-muted text-sm">{t("waitingQuote")}</p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="bg-surface border-border sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3 md:static md:border-0">
        <Button disabled={chosen.length === 0} onClick={() => setConfirming(true)} iconStart="cart">
          {t("acceptChosen", { count: chosen.length })}
        </Button>
        {basket.conversationId ? (
          <Button asChild variant="secondary" iconStart="chat">
            <Link href={`/account/messages/${basket.conversationId}`}>{t("conversation")}</Link>
          </Button>
        ) : null}
      </div>
      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle", { code: basket.basketCode ?? "" })}
        description={
          <ul className="flex flex-col gap-1">
            {chosen.map((choice) => (
              <li key={choice.itemId}>
                {t("confirmLine", {
                  name: choice.label,
                  quantity: format.number(choice.quantity),
                  amount: format.thb(choice.grossAmount),
                })}
              </li>
            ))}
          </ul>
        }
        confirmLabel={t("confirmAccept")}
        cancelLabel={t("keep")}
        loading={busy}
        onConfirm={() => void accept()}
      />
    </div>
  );
}

const checked = (choices: Record<string, Choice>, itemId: string) => itemId in choices;
