"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { isZero, plainNumber, QTY_PATTERN } from "@/features/partner/erp/format";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { erpPost } from "./api";
import { SalesActions } from "./SalesActions";

type Invoice = Schemas["ErpSalesInvoiceDto"];
type Note = Schemas["ErpSalesNoteDto"];
type Kind = Schemas["CnDirection"];
type Reason = Schemas["ErpSalesNoteReason"];
const REASONS: Record<Kind, Reason[]> = {
  credit: ["price_reduced", "goods_returned", "defective", "discount_after_sale", "overcharged", "other"],
  debit: ["price_increased", "undercharged", "extra_goods", "other"],
};
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

interface NoteLine {
  key: string;
  description: string;
  amount: string;
  itemId: string;
  returnQty: string;
}
let seq = 0;
const newLine = (patch: Partial<NoteLine> = {}): NoteLine => ({
  key: `nl-${(seq += 1)}`,
  description: "",
  amount: "",
  itemId: "",
  returnQty: "",
  ...patch,
});

/**
 * A credit or debit note against an issued invoice (D-364): why (the Revenue Code's reasons), and the lines
 * by value before VAT; goods returned may go back into stock. The API checks it against the invoice.
 */
export function NoteForm({ invoice, kind }: { invoice: Invoice; kind: Kind }) {
  const t = useTranslations("partnerSales.notes.form");
  const tReasons = useTranslations("partnerSales.notes.reasons");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const format = useFormat();
  const router = useRouter();
  const [reason, setReason] = useState<Reason>(REASONS[kind][0]!);
  const [reasonText, setReasonText] = useState("");
  const [issueDate, setIssueDate] = useState(bangkokToday());
  const [lines, setLines] = useState<NoteLine[]>([newLine()]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const returns = kind === "credit" && reason === "goods_returned";
  const items = invoice.lines
    .filter((line) => line.item)
    .map((line) => ({ value: line.item!.id, label: line.item!.name }));
  const update = (index: number, patch: Partial<NoteLine>) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<number, string> = {};
    lines.forEach((line, index) => {
      if (!line.description.trim()) next[index] = t("descriptionRequired");
      else if (!MONEY.test(plainNumber(line.amount)) || isZero(plainNumber(line.amount)))
        next[index] = t("amountInvalid");
      else if (returns && line.itemId && !QTY_PATTERN.test(plainNumber(line.returnQty)))
        next[index] = t("returnQtyInvalid");
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const created = await erpPost<{ id: string }>(
        factoryId,
        "/sales-notes",
        {},
        {
          kind,
          invoiceId: invoice.id,
          reason,
          reasonText: reasonText.trim() || null,
          issueDate,
          lines: lines.map((line) => ({
            description: line.description.trim(),
            amount: plainNumber(line.amount),
            ...(returns && line.itemId ? { itemId: line.itemId, returnQty: plainNumber(line.returnQty) } : {}),
          })),
        },
        { idempotencyKey: key },
      );
      toast.success(t("saved"));
      router.push(`/invoices/notes/${created.id}`);
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <p className="text-muted text-sm">
        {t("against", {
          no: invoice.invoiceNo ?? "",
          total: format.thb(invoice.total),
          customer: invoice.customer.name,
        })}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("reason")}>
          <Select
            value={reason}
            onValueChange={(value) => setReason(value as Reason)}
            options={REASONS[kind].map((r) => ({ value: r, label: tReasons(r) }))}
          />
        </Field>
        <Field label={t("issueDate")}>
          <Input
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value || bangkokToday())}
          />
        </Field>
      </div>
      <Field label={t("reasonText")} hint={t("reasonTextHint")}>
        <Textarea rows={2} value={reasonText} onChange={(event) => setReasonText(event.target.value)} />
      </Field>
      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <li key={line.key} className="border-border bg-surface rounded-xl border p-3 md:p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted text-sm font-medium">{t("line", { n: index + 1 })}</span>
              {lines.length > 1 ? (
                <IconButton
                  name="trash"
                  size="sm"
                  label={t("remove", { n: index + 1 })}
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                />
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <Field label={t("description")} error={errors[index]}>
                <Input
                  value={line.description}
                  placeholder={t("descriptionPlaceholder")}
                  onChange={(event) => update(index, { description: event.target.value })}
                />
              </Field>
              <Field label={t("amount")} hint={t("amountHint")}>
                <NumberInput
                  step="any"
                  min={0}
                  unit="฿"
                  value={line.amount}
                  onChange={(event) => update(index, { amount: event.target.value })}
                />
              </Field>
              {returns && items.length ? (
                <>
                  <Field label={t("returnItem")}>
                    <Select
                      value={line.itemId || null}
                      placeholder={t("returnItemPlaceholder")}
                      onValueChange={(itemId) => update(index, { itemId })}
                      options={items}
                    />
                  </Field>
                  <Field label={t("returnQty")}>
                    <NumberInput
                      step="any"
                      min={0}
                      value={line.returnQty}
                      onChange={(event) => update(index, { returnQty: event.target.value })}
                    />
                  </Field>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <Button
        variant="secondary"
        iconStart="plus"
        className="self-start"
        onClick={() => setLines([...lines, newLine()])}
      >
        {t("add")}
      </Button>
      <p className="text-muted text-sm">{t("vatNote")}</p>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t(kind === "credit" ? "saveCredit" : "saveDebit")}
      </Button>
    </form>
  );
}

/** What can be done with a credit / debit note now (D-364): issue, void, delete the draft, print. */
export function NoteActions({ note }: { note: Note }) {
  const t = useTranslations("partnerSales.notes.actions");
  const tCommon = useTranslations("partnerSales.common");
  const format = useFormat();
  const params = { noteId: note.id };
  return (
    <SalesActions
      offered={note.nextActions}
      actions={[
        {
          key: "erp_note.issue",
          kind: "post",
          primary: true,
          path: "/sales-notes/{noteId}/actions/issue",
          params,
          title: t("issueTitle"),
          description: t("issueBody", { total: format.thb(note.total), invoice: note.invoice.invoiceNo ?? "" }),
          done: (r) => t("issued", { no: (r as { noteNo?: string }).noteNo ?? "" }),
        },
        { key: "erp_note.pdf", kind: "pdf", path: "/sales-notes/{noteId}/pdf", params },
        {
          key: "erp_note.void",
          kind: "post",
          path: "/sales-notes/{noteId}/actions/void",
          params,
          body: (reason) => ({ reason }),
          title: t("voidTitle"),
          description: t("voidBody", { no: note.noteNo ?? "" }),
          phrase: note.noteNo,
          reason: { label: tCommon("reason"), placeholder: tCommon("reasonPlaceholder") },
          done: t("voided"),
        },
        {
          key: "erp_note.delete",
          kind: "delete",
          path: "/sales-notes/{noteId}",
          params,
          title: t("deleteTitle"),
          description: t("deleteBody"),
          done: t("deleted"),
          next: () => `/invoices/${note.invoice.id}`,
        },
      ]}
    />
  );
}
