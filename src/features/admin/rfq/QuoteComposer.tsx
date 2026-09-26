"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { problemMessage } from "../console";
import type { Rfq, RfqQuote } from "./resources";

type LineDraft = { quantity: string; unitPrice: string; leadTimeDays: string; consultationId: string | null };

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
      consultationId: line.consultationId,
    }));
  }
  return rfq.quantities.map((quantity) => ({
    quantity: String(quantity),
    unitPrice: "",
    leadTimeDays: "",
    consultationId: null,
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
 * Composes a draft quote version (F2 2.3): one line per quantity, priced by CS — typically from
 * a factory's answer, whose suggested sell price the API derived — with a validity that starts
 * from the D-051 default. The browser checks only the shape of what is typed; saving sends it to
 * the API, which prices the amounts and flags the margin floor, and those figures are what show.
 */
export function QuoteComposer({ rfq, draft, onClose }: { rfq: Rfq; draft: RfqQuote | undefined; onClose: () => void }) {
  const t = useTranslations("rfq.composer");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<LineDraft[]>(() => initialLines(rfq, draft));
  const [validUntil, setValidUntil] = useState(draft?.validUntil ?? rfq.quoteDefaults.validUntil);
  const [customerNote, setCustomerNote] = useState(draft?.customerNote ?? "");
  const [touched, setTouched] = useState(false);
  const answered = rfq.consultations.filter((item) => item.status === "responded" && item.response);

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "rfq", rfq.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "rfq") });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        validUntil,
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
        lines: lines.map((line) => ({
          quantity: Number(line.quantity),
          unitPrice: line.unitPrice,
          leadTimeDays: Number(line.leadTimeDays),
          ...(line.consultationId ? { consultationId: line.consultationId } : {}),
        })),
      };
      return draft
        ? browserRequests().call("PUT /v1/admin/rfqs/{rfqId}/quotes/{quoteId}", {
            path: { rfqId: rfq.id, quoteId: draft.id },
            body,
          })
        : browserRequests().call("POST /v1/admin/rfqs/{rfqId}/quotes", { path: { rfqId: rfq.id }, body });
    },
    onSuccess: () => {
      toast.success(t("saved"));
      settle();
    },
    onError: (error) => toast.error(problemMessage(error, t("saveFailed"))),
  });

  const discard = useMutation({
    mutationFn: () =>
      browserRequests().call("DELETE /v1/admin/rfqs/{rfqId}/quotes/{quoteId}", {
        path: { rfqId: rfq.id, quoteId: draft!.id },
      }),
    onSuccess: () => {
      toast.success(t("discarded"));
      settle();
      onClose();
    },
    onError: (error) => toast.error(problemMessage(error, t("discardFailed"))),
  });

  const errors = lines.map((line) => lineErrors(line, lines));
  const invalid = errors.some((error) => error.quantity || error.unitPrice || error.leadTimeDays) || !validUntil;
  const saved = draft ? JSON.stringify(initialLines(rfq, draft)) === JSON.stringify(lines) : false;

  const update = (index: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line, at) => (at === index ? { ...line, ...patch } : line)));

  /** Copies a factory's answer into the lines — its suggested sell price and lead time, as text. */
  const fillFrom = (consultationId: string) => {
    const source = answered.find((item) => item.id === consultationId);
    if (!source?.response) return;
    const { tiers, leadTimeDays } = source.response;
    setLines((current) =>
      current.map((line) => {
        const tier = tiers.find((candidate) => String(candidate.quantity) === line.quantity);
        return tier
          ? {
              ...line,
              unitPrice: trimPrice(tier.suggestedUnitPrice),
              leadTimeDays: String(leadTimeDays),
              consultationId,
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
                label: t("fillOption", { factory: item.factory.name, days: item.response!.leadTimeDays }),
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
          {lines.map((line, index) => {
            const suggestion = answered
              .find((item) => item.id === line.consultationId)
              ?.response?.tiers.find((tier) => String(tier.quantity) === line.quantity)?.suggestedUnitPrice;
            return (
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
                  hint={suggestion ? t("suggested", { price: format.thb(trimPrice(suggestion)) }) : t("unitPriceHint")}
                  error={touched ? message(errors[index]!.unitPrice) : undefined}
                  required
                >
                  <Input
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(event) => update(index, { unitPrice: event.target.value.trim() })}
                  />
                </Field>
                <Field
                  label={t("leadTime")}
                  error={touched ? message(errors[index]!.leadTimeDays) : undefined}
                  required
                >
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
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconStart="plus"
            disabled={lines.length >= 12}
            onClick={() =>
              setLines((current) => [
                ...current,
                { quantity: "", unitPrice: "", leadTimeDays: "", consultationId: null },
              ])
            }
          >
            {t("addLine")}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("validUntil")} hint={t("validUntilHint")} required>
            <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </Field>
        </div>
        <Field label={t("customerNote")} hint={t("customerNoteHint")}>
          <Textarea rows={3} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} />
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
          <Button type="submit" iconStart="save" loading={save.isPending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
