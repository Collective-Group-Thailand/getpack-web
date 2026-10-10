"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { Select } from "@/features/partner/select";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { useErpCall } from "./call";
import { formatQty, isZero, plainNumber, PRICE_PATTERN, QTY_PATTERN, trimZeros } from "./format";

type Po = Schemas["ErpPurchaseOrderDto"];
type VatMode = Po["vatMode"];
const VAT_MODES: VatMode[] = ["exclusive", "inclusive", "none"];
const WHT = ["0", "1", "2", "3", "5"] as const;
const NONE = "none";

interface Line {
  key: string;
  poLineId?: string;
  label: string;
  hint?: string;
  description: string;
  quantity: string;
  price: string;
}

let seq = 0;
const lineKey = () => `inv-${(seq += 1)}`;

/**
 * A supplier's invoice (D-337): against a purchase order — its lines filled in with what was received and
 * the order's price, changed to what the invoice says — or free lines (freight, services). The API matches
 * it 3-way and works out VAT, withholding tax and the due date; nothing is added up here.
 */
export function InvoiceForm({
  orders,
  order,
  suppliers,
  locale,
}: {
  orders: Pick<Schemas["ErpPurchaseOrderSummaryDto"], "id" | "poNo" | "supplier" | "status">[];
  order: Po | null;
  suppliers: Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">[];
  locale: string;
}) {
  const t = useTranslations("partnerFactory.payables.form");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const [supplierId, setSupplierId] = useState(order?.supplier.id ?? "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [taxInvoiceNo, setTaxInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(bangkokToday());
  const [dueDate, setDueDate] = useState("");
  const [vatMode, setVatMode] = useState<VatMode>(order?.vatMode ?? "exclusive");
  const [vatRate, setVatRate] = useState(trimZeros(order?.vatRatePct) || "7");
  const [wht, setWht] = useState<string>("0");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(() =>
    order
      ? order.lines
          .filter((line) => !isZero(line.receivedQty))
          .map((line) => ({
            key: lineKey(),
            poLineId: line.id,
            label: line.item.name,
            hint: t("received", {
              qty: tCommon("inUnit", {
                qty: formatQty(line.receivedQty, locale),
                unit: tCommon(`units.${line.unit}` as never),
              }),
            }),
            description: "",
            quantity: trimZeros(line.receivedQty),
            price: trimZeros(line.unitPrice),
          }))
      : [{ key: lineKey(), label: "", description: "", quantity: "1", price: "" }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (index: number, patch: Partial<Line>) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const choose = (id: string) =>
    router.replace(id === NONE ? "/payables/invoices/new" : `/payables/invoices/new?po=${id}`);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!supplierId) next.supplier = tCommon("selectSupplier");
    if (!invoiceNo.trim()) next.invoiceNo = t("invoiceNoRequired");
    const used = lines.filter((line) => line.quantity && !isZero(plainNumber(line.quantity)));
    if (!used.length) next.lines = t("linesRequired");
    lines.forEach((line, i) => {
      if (!line.quantity || isZero(plainNumber(line.quantity))) return;
      if (!QTY_PATTERN.test(plainNumber(line.quantity))) next[`q${i}`] = tCommon("qtyPlaceholder");
      if (!PRICE_PATTERN.test(plainNumber(line.price))) next[`p${i}`] = tCommon("pricePlaceholder");
      if (!line.poLineId && !line.description.trim()) next[`d${i}`] = t("descriptionRequired");
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    const saved = await call(
      async () =>
        (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/supplier-invoices", {
            params: { path: { factoryId } },
            body: {
              supplierId,
              ...(order ? { purchaseOrderId: order.id } : {}),
              invoiceNo: invoiceNo.trim(),
              taxInvoiceNo: taxInvoiceNo.trim() || null,
              invoiceDate,
              ...(dueDate ? { dueDate } : {}),
              vatMode,
              vatRatePct: plainNumber(vatRate) || "0",
              whtRatePct: wht,
              note: note.trim() || null,
              lines: used.map((line) => ({
                ...(line.poLineId ? { purchaseOrderLineId: line.poLineId } : {}),
                ...(line.description.trim() ? { description: line.description.trim() } : {}),
                quantity: plainNumber(line.quantity),
                unitPrice: plainNumber(line.price),
              })),
            },
          })
        ).data,
      t("saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/payables/invoices/${saved.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <Field label={t("purchaseOrder")} hint={t("purchaseOrderHint")}>
        <Select
          value={order?.id ?? NONE}
          onValueChange={choose}
          options={[
            { value: NONE, label: t("noPurchaseOrder") },
            ...orders.map((po) => ({ value: po.id, label: `${po.poNo ?? ""} · ${po.supplier.name}` })),
          ]}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        {order ? (
          <Field label={t("supplier")}>
            <Input value={order.supplier.name} readOnly />
          </Field>
        ) : (
          <Field label={t("supplier")} required requiredLabel={tCommon("required")} error={errors.supplier}>
            <Select
              value={supplierId || null}
              placeholder={tCommon("selectSupplier")}
              onValueChange={setSupplierId}
              options={suppliers.map((s) => ({ value: s.id, label: s.name, description: s.code }))}
            />
          </Field>
        )}
        <Field label={t("invoiceNo")} required requiredLabel={tCommon("required")} error={errors.invoiceNo}>
          <Input
            value={invoiceNo}
            placeholder={t("invoiceNoPlaceholder")}
            onChange={(event) => setInvoiceNo(event.target.value)}
          />
        </Field>
        <Field label={t("taxInvoiceNo")} hint={t("taxInvoiceNoHint")}>
          <Input value={taxInvoiceNo} onChange={(event) => setTaxInvoiceNo(event.target.value)} />
        </Field>
        <Field label={t("invoiceDate")}>
          <Input
            type="date"
            max={bangkokToday()}
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value || bangkokToday())}
          />
        </Field>
        <Field label={t("dueDate")} hint={t("dueDateHint")}>
          <Input type="date" min={invoiceDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <SegmentedControl
          label={t("vatMode")}
          size="md"
          value={vatMode}
          onValueChange={setVatMode}
          options={VAT_MODES.map((mode) => ({ value: mode, label: tCommon(`vatModes.${mode}`) }))}
        />
        {vatMode !== "none" ? (
          <div className="max-w-48">
            <Field label={t("vatRate")}>
              <NumberInput
                min={0}
                max={99}
                step="any"
                unit="%"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </div>
      <SegmentedControl
        label={t("wht")}
        size="md"
        value={wht}
        onValueChange={setWht}
        options={WHT.map((rate) => ({ value: rate, label: rate === "0" ? t("noWht") : `${rate}%` }))}
      />
      <div className="flex flex-col gap-3">
        <h3 className="font-semibold">{t("lines")}</h3>
        {errors.lines ? <p className="text-danger text-sm">{errors.lines}</p> : null}
        <ol className="flex flex-col gap-3">
          {lines.map((line, index) => (
            <li key={line.key} className="border-border bg-surface rounded-xl border p-3 md:p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {line.label ? <p className="font-medium">{line.label}</p> : null}
                  {line.hint ? <p className="text-muted text-sm">{line.hint}</p> : null}
                </div>
                {!line.poLineId && lines.length > 1 ? (
                  <IconButton
                    name="trash"
                    size="sm"
                    label={tCommon("removeLine", { n: index + 1 })}
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  />
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field label={t("description")} error={errors[`d${index}`]}>
                  <Input
                    value={line.description}
                    placeholder={line.poLineId ? line.label : t("descriptionPlaceholder")}
                    onChange={(event) => update(index, { description: event.target.value })}
                  />
                </Field>
                <Field label={tCommon("quantity")} error={errors[`q${index}`]}>
                  <NumberInput
                    step="any"
                    min={0}
                    value={line.quantity}
                    onChange={(event) => update(index, { quantity: event.target.value })}
                  />
                </Field>
                <Field label={t("unitPrice")} error={errors[`p${index}`]}>
                  <NumberInput
                    step="any"
                    min={0}
                    unit="฿"
                    value={line.price}
                    onChange={(event) => update(index, { price: event.target.value })}
                  />
                </Field>
              </div>
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          iconStart="plus"
          className="self-start"
          onClick={() => setLines([...lines, { key: lineKey(), label: "", description: "", quantity: "1", price: "" }])}
        >
          {t("addLine")}
        </Button>
      </div>
      <Field label={t("note")}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <p className="text-muted text-sm">{t("matchNote")}</p>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
