"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { Select } from "@/features/partner/select";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { useErpCall } from "./call";
import { plainNumber } from "./format";

type Invoice = Schemas["ErpSupplierInvoiceSummaryDto"];
type Method = Schemas["ErpCreateSupplierPaymentDto"]["method"];
const METHODS: Method[] = ["transfer", "cash", "cheque", "other"];
const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;

/**
 * Pays one supplier (D-338): its open invoices to tick, each with what is still open filled in (change it to
 * pay part), how it was paid and a reference. The API refuses more than is open and numbers it `PV`.
 */
export function PaymentForm({
  suppliers,
  supplierId,
  invoices,
  preselect,
}: {
  suppliers: Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">[];
  supplierId: string | null;
  invoices: Invoice[];
  preselect?: string;
}) {
  const t = useTranslations("partnerFactory.payables.pay");
  const tCommon = useTranslations("partnerErp.common");
  const tSections = useTranslations("partnerErp.common.sections");
  const format = useFormat();
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const payable = invoices.filter((inv) => ["matched", "approved", "partially_paid"].includes(inv.status));
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      payable.filter((inv) => !preselect || inv.id === preselect).map((inv) => [inv.id, inv.outstanding]),
    ),
  );
  const [method, setMethod] = useState<Method>("transfer");
  const [paidOn, setPaidOn] = useState(bangkokToday());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [key] = useState(() => newIdempotencyKey());

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const allocations = Object.entries(picked).map(([supplierInvoiceId, amount]) => ({
      supplierInvoiceId,
      amount: plainNumber(amount),
    }));
    if (!allocations.length || allocations.some((a) => !AMOUNT.test(a.amount) || /^0*(\.0*)?$/.test(a.amount))) {
      setError(t("pickRequired"));
      return;
    }
    setError(undefined);
    const saved = await call(
      async () =>
        (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/supplier-payments", {
            params: { path: { factoryId }, header: { "Idempotency-Key": key } },
            body: {
              supplierId: supplierId!,
              method,
              paidOn,
              reference: reference.trim() || null,
              note: note.trim() || null,
              allocations,
            },
          })
        ).data,
      t("paid"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/payables/payments/${saved.id}`);
      router.refresh();
    }
  }

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? "";
  const pickedNos = payable.filter((inv) => inv.id in picked).map((inv) => inv.docNo);

  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <FormColumns
        aside={
          <FormSummary
            title={tSections("summary")}
            action={
              <Button
                type="submit"
                size="xl"
                loading={busy}
                iconStart="coins"
                disabled={!supplierId || !payable.length}
              >
                {t("submit")}
              </Button>
            }
          >
            <SummaryRows
              rows={[
                { key: "supplier", label: t("supplier"), value: supplierName },
                { key: "invoices", label: t("invoices"), value: pickedNos.join(", ") },
                { key: "method", label: t("method"), value: t(`methods.${method}`) },
                { key: "date", label: t("paidOn"), value: paidOn ? format.date(paidOn) : "" },
              ]}
            />
          </FormSummary>
        }
      >
        <FormSection card step={1} title={t("supplier")}>
          <Field label={t("supplier")} labelHidden>
            <Select
              value={supplierId}
              placeholder={tCommon("selectSupplier")}
              onValueChange={(id) => router.replace(`/payables/payments/new?supplier=${id}`)}
              options={suppliers.map((s) => ({ value: s.id, label: s.name, description: s.code }))}
            />
          </Field>
        </FormSection>
        <FormSection card step={2} title={t("invoices")}>
          {!supplierId ? (
            <p className="text-muted text-sm">{tCommon("selectSupplier")}</p>
          ) : payable.length ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{t("invoices")}</legend>
              {payable.map((inv) => {
                const on = inv.id in picked;
                return (
                  <div
                    key={inv.id}
                    className="border-border grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-center"
                  >
                    <Checkbox
                      label={
                        <span className="flex flex-col">
                          <span className="font-medium">
                            {inv.docNo} · {inv.invoiceNo}
                          </span>
                          <span className={inv.overdue ? "text-danger text-sm" : "text-muted text-sm"}>
                            {t("due", { date: format.date(inv.dueDate), open: format.thb(inv.outstanding) })}
                          </span>
                        </span>
                      }
                      checked={on}
                      onCheckedChange={(checked) => {
                        const next = { ...picked };
                        if (checked === true) next[inv.id] = inv.outstanding;
                        else delete next[inv.id];
                        setPicked(next);
                      }}
                    />
                    {on ? (
                      <Field label={t("amount")} labelHidden>
                        <NumberInput
                          step="any"
                          min={0}
                          unit="฿"
                          value={picked[inv.id]}
                          onChange={(event) => setPicked({ ...picked, [inv.id]: event.target.value })}
                        />
                      </Field>
                    ) : null}
                  </div>
                );
              })}
              {error ? (
                <p role="alert" className="text-danger text-sm">
                  {error}
                </p>
              ) : null}
            </fieldset>
          ) : (
            <p className="text-muted text-sm">{t("nothingOpen")}</p>
          )}
        </FormSection>
        <FormSection card step={3} title={tSections("payment")}>
          <SegmentedControl
            label={t("method")}
            size="md"
            value={method}
            onValueChange={setMethod}
            options={METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) }))}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("paidOn")}>
              <Input
                type="date"
                max={bangkokToday()}
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value || bangkokToday())}
              />
            </Field>
            <Field label={t("reference")}>
              <Input
                value={reference}
                placeholder={t("referencePlaceholder")}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
          </div>
          <Field label={t("note")}>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormSection>
      </FormColumns>
    </form>
  );
}
