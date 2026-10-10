"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { erpPost } from "./api";
import { SalesActions } from "./SalesActions";

type Invoice = Schemas["ErpSalesInvoiceDto"];
type Form = Schemas["ErpInvoiceForm"];
type Method = Schemas["ErpPaymentMethod"];
const METHODS: Method[] = ["transfer", "cash", "cheque", "other"];

/**
 * An invoice from what was delivered (D-363): the delivery notes not yet invoiced — and, with a sales order, its
 * service lines — become the lines of a draft invoice. Whether it is a plain invoice or an invoice / receipt
 * (cash sale) is chosen here.
 */
export function InvoiceFromDeliveries({
  customer,
  salesOrderId,
  deliveries,
  preselected,
}: {
  customer: { id: string; name: string };
  salesOrderId?: string;
  deliveries: { id: string; doNo: string; deliverOn: string; salesOrder: string }[];
  preselected?: string;
}) {
  const t = useTranslations("partnerSales.invoices.fromDeliveries");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const format = useFormat();
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(preselected ? [preselected] : deliveries.map((d) => d.id)),
  );
  const [issueDate, setIssueDate] = useState(bangkokToday());
  const [form, setForm] = useState<Form>("invoice");
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);

  async function save() {
    if (!chosen.size && !salesOrderId) {
      toast.error(t("nothingChosen"));
      return;
    }
    setBusy(true);
    try {
      const created = await erpPost<{ id: string }>(
        factoryId,
        "/sales-invoices",
        {},
        {
          customerId: customer.id,
          form,
          issueDate,
          ...(chosen.size ? { deliveryNoteIds: [...chosen] } : {}),
          ...(salesOrderId ? { salesOrderId } : {}),
        },
        { idempotencyKey: key },
      );
      toast.success(t("saved"));
      router.push(`/invoices/${created.id}`);
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("deliveries")}</legend>
        {deliveries.length ? (
          deliveries.map((d) => (
            <Checkbox
              key={d.id}
              checked={chosen.has(d.id)}
              onCheckedChange={(on) => {
                const next = new Set(chosen);
                if (on) next.add(d.id);
                else next.delete(d.id);
                setChosen(next);
              }}
              label={`${d.doNo} · ${format.date(d.deliverOn)}`}
              description={d.salesOrder}
            />
          ))
        ) : (
          <p className="text-muted text-sm">{t("noDeliveries")}</p>
        )}
        {salesOrderId ? <p className="text-muted text-sm">{t("servicesToo")}</p> : null}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("issueDate")} hint={t("issueDateHint")}>
          <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value || bangkokToday())} />
        </Field>
      </div>
      <SegmentedControl
        label={t("form")}
        size="md"
        value={form}
        onValueChange={setForm}
        options={[
          { value: "invoice", label: t("forms.invoice") },
          { value: "invoice_receipt", label: t("forms.invoice_receipt") },
        ]}
      />
      <p className="text-muted text-sm">{t(`formHints.${form}`)}</p>
      <Button size="xl" loading={busy} iconStart="receipt" className="self-start" onClick={() => void save()}>
        {t("save", { customer: customer.name })}
      </Button>
    </div>
  );
}

/**
 * What can be done with an invoice now (D-363 – D-365): edit and issue the draft — numbered in date order, a
 * cash sale with its receipt — receive payment, credit or debit it, void it, print it.
 */
export function InvoiceActions({ invoice, etag }: { invoice: Invoice; etag: string | null }) {
  const t = useTranslations("partnerSales.invoices.actions");
  const tCommon = useTranslations("partnerSales.common");
  const tMethods = useTranslations("partnerSales.methods");
  const { factoryId } = useFactory();
  const format = useFormat();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(invoice.issueDate);
  const [method, setMethod] = useState<Method>("transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  const params = { invoiceId: invoice.id };
  const no = invoice.invoiceNo ?? tCommon("draftNo");

  async function issue() {
    setBusy(true);
    try {
      const result = await erpPost<{ invoiceNo: string }>(
        factoryId,
        "/sales-invoices/{invoiceId}/actions/issue",
        params,
        {
          issueDate,
          ...(invoice.form === "invoice_receipt" ? { receipt: { method, reference: reference.trim() || null } } : {}),
        },
        { idempotencyKey: key, etag },
      );
      toast.success(t("issued", { no: result.invoiceNo }));
      setOpen(false);
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SalesActions
        offered={invoice.nextActions}
        etag={etag}
        actions={[
          {
            key: "erp_iv.issue",
            kind: "dialog",
            primary: true,
            open: () => {
              setKey(newIdempotencyKey());
              setOpen(true);
            },
          },
          {
            key: "erp_iv.receive",
            kind: "link",
            primary: true,
            href: `/receivables/receipts/new?customer=${invoice.customer.id}&invoice=${invoice.id}`,
          },
          { key: "erp_iv.edit", kind: "link", href: `/invoices/${invoice.id}/edit` },
          { key: "erp_iv.pdf", kind: "pdf", path: "/sales-invoices/{invoiceId}/pdf", params },
          { key: "erp_iv.credit", kind: "link", href: `/invoices/notes/new?invoice=${invoice.id}&kind=credit` },
          { key: "erp_iv.debit", kind: "link", href: `/invoices/notes/new?invoice=${invoice.id}&kind=debit` },
          {
            key: "erp_iv.void",
            kind: "post",
            path: "/sales-invoices/{invoiceId}/actions/void",
            params,
            body: (reason) => ({ reason }),
            title: t("voidTitle"),
            description: t("voidBody", { no }),
            phrase: invoice.invoiceNo,
            reason: { label: tCommon("reason"), placeholder: t("voidPlaceholder") },
            done: t("voided"),
          },
          {
            key: "erp_iv.delete",
            kind: "delete",
            path: "/sales-invoices/{invoiceId}",
            params,
            title: t("deleteTitle"),
            description: t("deleteBody"),
            done: t("deleted"),
            next: () => "/invoices?view=draft",
          },
        ]}
      />
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("issueTitle")}
          description={t("issueBody", {
            customer: invoice.customer.name,
            total: format.thb(invoice.total),
          })}
          closeLabel={tCommon("close")}
          footer={
            <Button iconStart="receipt" loading={busy} onClick={() => void issue()}>
              {t("issueConfirm")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("issueDate")} hint={t("issueDateHint")}>
              <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
            </Field>
            {invoice.form === "invoice_receipt" ? (
              <>
                <Field label={t("method")}>
                  <Select
                    value={method}
                    onValueChange={(value) => setMethod(value as Method)}
                    options={METHODS.map((m) => ({ value: m, label: tMethods(m) }))}
                  />
                </Field>
                <Field label={t("reference")}>
                  <Input value={reference} onChange={(event) => setReference(event.target.value)} />
                </Field>
              </>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
