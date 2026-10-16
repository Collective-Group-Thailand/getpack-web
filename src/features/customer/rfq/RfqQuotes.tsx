"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { RFQ_QUOTE_STATUS } from "@/domain/status";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { toast } from "@/ui/components/Toast";

import { editCart } from "../cart/cart-client";

type Rfq = Schemas["RfqDto"];
type Line = Schemas["RfqQuoteLineDto"];
type Saved = Schemas["SavedQuoteDto"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * The quotes CS sent, newest first, and accepting one quantity of the current one — which makes
 * the saved quotation (`source = rfq`, `acceptedQuoteId`) the cart takes — offered while the RFQ
 * carries `rfq.accept` (its own `nextActions`) and only on the quote that was sent. Accepting is
 * irreversible, so the dialog restates the RFQ, the quantity and the amount, and the request
 * carries one idempotency key per intent.
 */
export function RfqQuotes({ rfq, accepted }: { rfq: Rfq; accepted: Saved | null }) {
  const t = useTranslations("quoteRequests.detail");
  const format = useFormat();
  const router = useRouter();
  const [choice, setChoice] = useState<{ quoteId: string; line: Line } | null>(null);
  const [busy, setBusy] = useState<"accept" | "cart" | null>(null);
  const key = useRef(newKey());
  const acceptable = rfq.nextActions.some((action) => action.key === "rfq.accept" && !action.disabledReason);
  const quotations = [...rfq.quotations]
    .filter((quotation) => quotation.status !== "draft")
    .sort((a, b) => b.versionNo - a.versionNo);

  async function accept() {
    if (!choice) return;
    setBusy("accept");
    try {
      await browserApi().POST("/v1/store/rfqs/{rfqId}/actions/accept", {
        params: { path: { rfqId: rfq.id }, header: { "Idempotency-Key": key.current } },
        body: { rfqQuoteId: choice.quoteId, quantities: [choice.line.quantity] },
      });
      toast.success(t("accepted", { code: rfq.rfqCode }));
      setChoice(null);
      router.refresh();
    } catch (error) {
      key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("acceptFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function addToCart(saved: Saved, option: Saved["options"][number]) {
    setBusy("cart");
    try {
      // The cart takes one option of the saved quotation the acceptance made (`store.cart.addItem`).
      await editCart((ifMatch) =>
        browserApi().POST("/v1/store/cart/items", {
          params: { header: { "If-Match": ifMatch } },
          body: { quoteId: saved.id, quoteOptionId: option.id, designOption: "own_file" },
        }),
      );
      track("cart_item_added", {
        route: "/account/rfqs/[rfqId]",
        productType: rfq.productTypeCode,
        quantity: option.quantity,
        quoteMode: "rfq",
      });
      router.push("/cart");
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("cartFailed"));
      setBusy(null);
    }
  }

  if (quotations.length === 0) {
    return <p className="text-muted text-sm">{t("noQuotesYet")}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {accepted && accepted.status === "converted" ? (
        // The accepted quotation became an order: the next step is that order, not the cart again.
        <Callout tone="success" title={t("orderedTitle", { code: accepted.quoteCode ?? rfq.rfqCode })}>
          <p>{t("orderedBody")}</p>
          <Button asChild size="sm" variant="secondary" className="mt-2" iconStart="package">
            <Link href="/account/orders">{t("toOrders")}</Link>
          </Button>
        </Callout>
      ) : accepted ? (
        <Callout
          tone="success"
          title={accepted.quoteCode ? t("acceptedTitle", { code: accepted.quoteCode }) : t("acceptedTitleNoCode")}
        >
          <ul className="flex flex-col items-start gap-2">
            {accepted.options.map((option) => (
              <li key={option.id} className="flex flex-wrap items-center gap-2">
                <span>{t("acceptedBody", { quantity: format.number(option.quantity) })}</span>
                <Button
                  size="sm"
                  iconStart="cart"
                  loading={busy === "cart"}
                  onClick={() => void addToCart(accepted, option)}
                >
                  {t("addToCart")}
                  {accepted.options.length > 1 ? (
                    <span className="sr-only"> {t("acceptLine", { quantity: format.number(option.quantity) })}</span>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {quotations.map((quote) => {
        const current = acceptable && quote.status === "sent";
        return (
          <article key={quote.id} className="bg-surface border-border rounded-xl border">
            <header className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="font-semibold">{t("quoteVersion", { version: quote.versionNo })}</h3>
              <div className="flex items-center gap-2 text-sm">
                <StatusChip map={RFQ_QUOTE_STATUS} value={quote.status} />
                {quote.validUntil ? (
                  <span className="text-muted">{t("validUntil", { date: format.date(quote.validUntil) })}</span>
                ) : null}
              </div>
            </header>
            {quote.note ? <p className="px-4 pt-3 text-sm">{quote.note}</p> : null}
            <div className="overflow-x-auto px-4 py-3">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("linesCaption", { version: quote.versionNo })}</caption>
                <thead className="text-muted text-xs">
                  <tr>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("quantity")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {t("perPiece")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {t("total")}
                    </th>
                    <th scope="col" className="hidden py-2 text-end font-medium sm:table-cell">
                      {t("leadTime")}
                    </th>
                    {current ? (
                      <th scope="col" className="py-2">
                        <span className="sr-only">{t("choose")}</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line) => (
                    <tr key={line.quantity} className="border-border border-t">
                      <th scope="row" className="py-2 text-start font-medium tabular-nums">
                        {format.number(line.quantity)}
                      </th>
                      <td className="py-2 text-end tabular-nums">{format.thb(line.unitPrice)}</td>
                      <td className="py-2 text-end tabular-nums">
                        {format.thb(line.grossAmount)}
                        <span className="text-muted block text-xs">{t("vatIncluded")}</span>
                      </td>
                      <td className="text-muted hidden py-2 text-end sm:table-cell">
                        {t("days", { days: line.leadTimeDays })}
                      </td>
                      {current ? (
                        <td className="py-2 ps-3 text-end">
                          <Button size="sm" onClick={() => setChoice({ quoteId: quote.id, line })}>
                            {t("accept")}
                            <span className="sr-only">
                              {" "}
                              {t("acceptLine", { quantity: format.number(line.quantity) })}
                            </span>
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}

      <AlertDialog
        open={choice !== null}
        onOpenChange={(open) => !open && setChoice(null)}
        title={t("confirmTitle")}
        description={
          choice
            ? t("confirmBody", {
                code: rfq.rfqCode,
                quantity: format.number(choice.line.quantity),
                amount: format.thb(choice.line.grossAmount),
              })
            : ""
        }
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        loading={busy === "accept"}
        onConfirm={() => void accept()}
      />
    </div>
  );
}
