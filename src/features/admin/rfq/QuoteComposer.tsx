"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage } from "../console";
import { useSettleRfq } from "./data";
import type { Rfq, RfqQuote } from "./resources";

type LineDraft = {
  quantity: string;
  unitPrice: string;
  leadTimeDays: string;
  /** The factory the line is priced from, and its buy price — sent explicitly to the API. */
  factoryId: string | null;
  buyUnitPrice: string | null;
};

const PRICE = /^\d+(\.\d{1,6})?$/;
const ZERO = /^0+(\.0+)?$/;
const WHOLE = /^[1-9]\d*$/;

/** `"54.600000"` → `"54.60"`: fewer trailing zeros to read, the same decimal text. */
const trimPrice = (value: string) => value.replace(/(\.\d{2}\d*?)0+$/, "$1");

function initialLines(rfq: Rfq, draft: RfqQuote | undefined): LineDraft[] {
  if (draft) {
    return draft.lines.map((line) => ({
      quantity: String(line.quantity),
      unitPrice: trimPrice(line.unitPrice),
      leadTimeDays: String(line.leadTimeDays),
      factoryId: line.factoryId,
      buyUnitPrice: line.buyUnitPrice,
    }));
  }
  return rfq.quantities.map((quantity) => ({
    quantity: String(quantity),
    unitPrice: "",
    leadTimeDays: "",
    factoryId: null,
    buyUnitPrice: null,
  }));
}

function lineErrors(line: LineDraft, all: LineDraft[]) {
  return {
    quantity: !WHOLE.test(line.quantity)
      ? "quantity"
      : all.filter((other) => other.quantity === line.quantity).length > 1
        ? "duplicate"
        : null,
    unitPrice: !PRICE.test(line.unitPrice) || ZERO.test(line.unitPrice) ? "price" : null,
    leadTimeDays: !WHOLE.test(line.leadTimeDays) || line.leadTimeDays.length > 3 ? "leadTime" : null,
  };
}

/**
 * Composes a draft quote version (F2 2.3): one line per quantity, priced by CS. A factory's answer
 * (published to `factory_cost.read` only) can be copied in — its lead time, and its factory and
 * buy price, which the API uses to flag the margin floor (D-012). CONTRACT-GAP admin.rfq-quotes —
 * the API publishes no suggested sell price, so CS always types the price. The browser checks only
 * the shape of what is typed; the API prices the amounts, and those figures are what show.
 *
 * A new draft is `admin.rfqs.draftQuotation` (with an Idempotency-Key for this composer); editing
 * one is `admin.rfqs.replaceDraftQuotation`, sent under `If-Match` with the RFQ's ETag as it was
 * when the editor opened — so an edit made meanwhile by someone else is refused (412), not lost.
 * Either way the validity is set by the API when the version is sent (D-051).
 */
export function QuoteComposer({ rfq, draft, onClose }: { rfq: Rfq; draft: RfqQuote | undefined; onClose: () => void }) {
  const t = useTranslations("rfq.composer");
  const format = useFormat();
  const settle = useSettleRfq(rfq.id);
  const [lines, setLines] = useState<LineDraft[]>(() => initialLines(rfq, draft));
  const [note, setNote] = useState(draft?.note ?? "");
  const [draftKey] = useState(newIdempotencyKey);
  // The RFQ's ETag as this editor saw it (`admin.rfqs.get`); the draft PUT is matched against it.
  const etag = useQuery({
    queryKey: queryKeys.related("admin", "rfq", rfq.id, `etag:${draft?.id ?? "new"}`),
    enabled: Boolean(draft),
    queryFn: async () => {
      const { response } = await adminBrowserApis().contract.GET("/v1/admin/rfqs/{rfqId}", {
        params: { path: { rfqId: rfq.id } },
      });
      return response.headers.get("ETag") ?? "";
    },
    staleTime: Infinity,
    gcTime: 0,
  });
  const [touched, setTouched] = useState(false);
  const answered = rfq.consultations.filter(
    (item) => item.status === "responded" && item.lines !== null && item.lines.length > 0,
  );

  const save = useMutation({
    mutationFn: async () => {
      const { contract } = adminBrowserApis();
      const body = {
        ...(note.trim() ? { note: note.trim() } : {}),
        lines: lines.map((line) => ({
          quantity: Number(line.quantity),
          unitPrice: line.unitPrice,
          leadTimeDays: Number(line.leadTimeDays),
          ...(line.factoryId ? { factoryId: line.factoryId } : {}),
          ...(line.factoryId && line.buyUnitPrice ? { buyUnitPrice: line.buyUnitPrice } : {}),
        })),
      };
      if (draft) {
        return (
          await contract.PUT("/v1/admin/rfq-quotations/{rfqQuoteId}", {
            params: { path: { rfqQuoteId: draft.id }, header: { "If-Match": etag.data ?? "" } },
            body,
          })
        ).data;
      }
      return (
        await contract.POST("/v1/admin/rfqs/{rfqId}/quotations", {
          params: { path: { rfqId: rfq.id }, header: { "Idempotency-Key": draftKey } },
          body,
        })
      ).data;
    },
    onSuccess: (updated) => {
      toast.success(t("saved"));
      settle(updated);
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 412) {
        // Someone changed the RFQ since this editor opened: show theirs, keep nothing stale.
        toast.error(t("stale"));
        settle();
        return;
      }
      toast.error(problemMessage(error, t("saveFailed")));
    },
  });

  const discard = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/rfq-quotations/{rfqQuoteId}/actions/discard", {
          params: { path: { rfqQuoteId: draft!.id } },
        })
      ).data,
    onSuccess: (updated) => {
      toast.success(t("discarded"));
      settle(updated);
      onClose();
    },
    onError: (error) => toast.error(problemMessage(error, t("discardFailed"))),
  });

  const errors = lines.map((line) => lineErrors(line, lines));
  const invalid = errors.some((error) => error.quantity || error.unitPrice || error.leadTimeDays);
  const saved = draft ? JSON.stringify(initialLines(rfq, draft)) === JSON.stringify(lines) : false;

  const update = (index: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line, at) => (at === index ? { ...line, ...patch } : line)));

  /** Copies a factory's answer into the lines — its lead time, factory and buy price, as text. */
  const fillFrom = (consultationId: string) => {
    const source = answered.find((item) => item.id === consultationId);
    if (!source?.lines) return;
    const answers = source.lines;
    setLines((current) =>
      current.map((line) => {
        const answer = answers.find((candidate) => String(candidate.quantity) === line.quantity);
        return answer
          ? {
              ...line,
              leadTimeDays: String(answer.leadTimeDays),
              factoryId: source.factoryId,
              buyUnitPrice: answer.buyUnitPrice,
            }
          : line;
      }),
    );
  };

  const message = (key: string | null) => (key ? t(`errors.${key}`) : undefined);

  return (
    <Card padding="lg" aria-labelledby="rfq-composer-title">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle id="rfq-composer-title">
          {draft ? t("editTitle", { version: draft.versionNo }) : t("title")}
        </CardTitle>
        {answered.length > 0 ? (
          <div className="w-full sm:w-72">
            <Select
              aria-label={t("fillFrom")}
              placeholder={t("fillFrom")}
              onValueChange={fillFrom}
              options={answered.map((item) => ({
                value: item.id,
                label: t("fillOption", { factory: item.factoryCode }),
              }))}
            />
          </div>
        ) : null}
      </CardHeader>

      {answered.length === 0 ? <p className="text-muted mb-3 text-sm">{t("noAnswers")}</p> : null}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!invalid) save.mutate();
        }}
      >
        <div className="space-y-3">
          {lines.map((line, index) => (
            <fieldset
              key={index}
              className="border-border grid gap-3 rounded-md border p-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
            >
              <legend className="px-1 text-sm font-medium">{t("line", { no: index + 1 })}</legend>
              <Field label={t("quantity")} error={touched ? message(errors[index]!.quantity) : undefined} required>
                <NumberInput
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                />
              </Field>
              <Field
                label={t("unitPrice")}
                hint={
                  line.buyUnitPrice
                    ? t("buyPrice", { price: format.thb(trimPrice(line.buyUnitPrice)) })
                    : t("unitPriceHint")
                }
                error={touched ? message(errors[index]!.unitPrice) : undefined}
                required
              >
                <Input
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(event) => update(index, { unitPrice: event.target.value.trim() })}
                />
              </Field>
              <Field label={t("leadTime")} error={touched ? message(errors[index]!.leadTimeDays) : undefined} required>
                <NumberInput
                  inputMode="numeric"
                  unit={t("days")}
                  value={line.leadTimeDays}
                  onChange={(event) => update(index, { leadTimeDays: event.target.value })}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconStart="trash"
                  disabled={lines.length === 1}
                  onClick={() => setLines((current) => current.filter((_, at) => at !== index))}
                >
                  {t("removeLine", { no: index + 1 })}
                </Button>
              </div>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconStart="plus"
            disabled={lines.length >= 12}
            onClick={() =>
              setLines((current) => [
                ...current,
                { quantity: "", unitPrice: "", leadTimeDays: "", factoryId: null, buyUnitPrice: null },
              ])
            }
          >
            {t("addLine")}
          </Button>
        </div>

        <p className="text-muted text-sm">{t("validityAtSend")}</p>
        <Field label={t("customerNote")} hint={t("customerNoteHint")}>
          <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {draft && !saved ? <Callout tone="info" title={t("unsaved")} /> : null}

        <div className="flex flex-wrap justify-end gap-2">
          {draft ? (
            <Button type="button" variant="ghost" loading={discard.isPending} onClick={() => discard.mutate()}>
              {t("discard")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
          )}
          <Button type="submit" iconStart="save" loading={save.isPending} disabled={Boolean(draft) && etag.isPending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
