"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TotalsEstimate } from "@/features/partner/erp/TotalsEstimate";

import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { isZero, plainNumber, PRICE_PATTERN, QTY_PATTERN, trimZeros } from "@/features/partner/erp/format";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { erpPost, erpSave } from "./api";
import { type Fulfilment, newSalesLine, type SalesLine, type SalesLineErrors, SalesLinesEditor, type Unit } from "./SalesLinesEditor";
import type { SalesPickers } from "./types";

type VatMode = Schemas["ErpVatMode"];
const VAT_MODES: VatMode[] = ["exclusive", "inclusive", "none"];
export type SalesDocKind = "quotation" | "salesOrder" | "invoice";

/** What a saved document gives back to start from when editing. */
export interface SalesDocInitial {
  id: string;
  customerId: string;
  salespersonId?: string | null;
  date?: string;
  validUntil?: string;
  deliveryDate?: string | null;
  paymentTermDays?: number;
  leadTimeDays?: number | null;
  vatMode?: VatMode;
  customerPoNo?: string | null;
  warehouseId?: string;
  shipToAddress?: string | null;
  terms?: string | null;
  note?: string | null;
  lines: {
    item: { id: string } | null;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountPct: string;
    fulfilment?: Fulfilment;
  }[];
}

const BASE: Record<SalesDocKind, { path: string; param: string; href: string }> = {
  quotation: { path: "/quotations", param: "quotationId", href: "/quotations" },
  salesOrder: { path: "/sales-orders", param: "salesOrderId", href: "/sales-orders" },
  invoice: { path: "/sales-invoices", param: "invoiceId", href: "/invoices" },
};

/**
 * A draft quotation (D-360), sales order (D-361) or invoice (D-363) of the factory's own: the customer, dates,
 * how prices treat VAT, and the lines. Saved as a draft; totals come back from the API. Editing a draft goes
 * under `If-Match`.
 */
export function SalesDocForm({
  kind,
  pickers,
  locale,
  initial,
  etag,
  preset = {},
  headerOnly = false,
}: {
  kind: SalesDocKind;
  pickers: SalesPickers;
  locale: string;
  initial?: SalesDocInitial;
  etag?: string | null;
  preset?: { customerId?: string; opportunityId?: string };
  /** An invoice made from delivery notes: its lines come from them; only the header is edited here. */
  headerOnly?: boolean;
}) {
  const t = useTranslations("partnerSales.form");
  const tCommon = useTranslations("partnerSales.common");
  const tVat = useTranslations("partnerErp.common.vatModes");
  const { factoryId } = useFactory();
  const router = useRouter();
  const [refresh] = useRefresh();
  const customers = new Map(pickers.customers.map((c) => [c.id, c]));
  const [customerId, setCustomerId] = useState(initial?.customerId ?? preset.customerId ?? "");
  const firstCustomer = customers.get(customerId);
  const [salespersonId, setSalespersonId] = useState(initial?.salespersonId ?? firstCustomer?.salespersonId ?? "");
  const [date, setDate] = useState(initial?.date ?? bangkokToday());
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? "");
  const [terms, setTerms] = useState(String(initial?.paymentTermDays ?? firstCustomer?.paymentTermDays ?? 30));
  const [leadTime, setLeadTime] = useState(initial?.leadTimeDays == null ? "" : String(initial.leadTimeDays));
  const [vatMode, setVatMode] = useState<VatMode>(initial?.vatMode ?? "exclusive");
  const [customerPoNo, setCustomerPoNo] = useState(initial?.customerPoNo ?? "");
  const [warehouseId, setWarehouseId] = useState(
    initial?.warehouseId ?? pickers.warehouses.find((w) => w.isDefault)?.id ?? pickers.warehouses[0]?.id ?? "",
  );
  const [shipTo, setShipTo] = useState(initial?.shipToAddress ?? "");
  const [conditions, setConditions] = useState(initial?.terms ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<SalesLine[]>(() =>
    initial?.lines.length
      ? initial.lines.map((line) =>
          newSalesLine({
            itemId: line.item?.id ?? "",
            description: line.item ? "" : line.description,
            quantity: trimZeros(line.quantity),
            unit: line.unit as Unit,
            price: trimZeros(line.unitPrice),
            discountPct: isZero(line.discountPct) ? "" : trimZeros(line.discountPct),
            ...(line.fulfilment ? { fulfilment: line.fulfilment } : {}),
          }),
        )
      : [newSalesLine(kind === "salesOrder" ? { fulfilment: "service" } : {})],
  );
  const [errors, setErrors] = useState<SalesLineErrors>({});
  const [customerError, setCustomerError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.get(id);
    if (!c) return;
    setTerms(String(c.paymentTermDays));
    if (c.salespersonId && !salespersonId) setSalespersonId(c.salespersonId);
    if (kind === "salesOrder" && !shipTo && c.address) setShipTo(c.address);
  }

  function check(): boolean {
    const next: SalesLineErrors = {};
    if (!headerOnly) lines.forEach((line, index) => {
      const error: SalesLineErrors[number] = {};
      if (!line.itemId && !line.description.trim()) error.item = t("lineNeedsItem");
      const q = plainNumber(line.quantity);
      if (!QTY_PATTERN.test(q) || isZero(q)) error.quantity = t("quantityInvalid");
      if (!PRICE_PATTERN.test(plainNumber(line.price))) error.price = t("priceInvalid");
      if (Object.keys(error).length) next[index] = error;
    });
    setErrors(next);
    setCustomerError(customerId ? undefined : t("customerRequired"));
    return Boolean(customerId) && !Object.keys(next).length;
  }

  function body() {
    const days = Number.parseInt(terms, 10);
    const linesOut = lines.map((line) => ({
      ...(line.itemId ? { itemId: line.itemId } : { unit: line.unit }),
      ...(line.description.trim() ? { description: line.description.trim() } : {}),
      quantity: plainNumber(line.quantity),
      unitPrice: plainNumber(line.price),
      ...(line.discountPct ? { discountPct: plainNumber(line.discountPct) } : {}),
      ...(kind === "salesOrder" ? { fulfilment: line.fulfilment ?? (line.itemId ? "stock" : "service") } : {}),
    }));
    const common = {
      vatMode,
      ...(Number.isFinite(days) ? { paymentTermDays: days } : {}),
      note: note.trim() || null,
    };
    if (kind === "quotation")
      return {
        customerId,
        salespersonId: salespersonId || null,
        ...(preset.opportunityId ? { opportunityId: preset.opportunityId } : {}),
        quoteDate: date,
        ...(validUntil ? { validUntil } : {}),
        leadTimeDays: leadTime ? Number.parseInt(leadTime, 10) : null,
        terms: conditions.trim() || null,
        lines: linesOut,
        ...common,
      };
    if (kind === "salesOrder")
      return {
        customerId,
        salespersonId: salespersonId || null,
        orderDate: date,
        deliveryDate: deliveryDate || null,
        customerPoNo: customerPoNo.trim() || null,
        ...(warehouseId ? { warehouseId } : {}),
        shipToAddress: shipTo.trim() || null,
        lines: linesOut,
        ...common,
      };
    return initial
      ? { issueDate: date, customerPoNo: customerPoNo.trim() || null, ...(headerOnly ? {} : { lines: linesOut }), ...common }
      : { customerId, issueDate: date, customerPoNo: customerPoNo.trim() || null, lines: linesOut, ...common };
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!check()) return;
    setBusy(true);
    const base = BASE[kind];
    try {
      if (initial) {
        await erpSave(
          kind === "invoice" ? "PATCH" : "PUT",
          factoryId,
          `${base.path}/{${base.param}}`,
          { [base.param]: initial.id },
          body(),
          etag,
        );
        toast.success(t("saved"));
        router.push(`${base.href}/${initial.id}`);
        router.refresh();
      } else {
        const created = await erpPost<{ id: string }>(factoryId, base.path, {}, body());
        toast.success(t("saved"));
        router.push(`${base.href}/${created.id}`);
      }
    } catch (error) {
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? tCommon("stale") : problemMessage(error, tCommon("failed")));
      if (stale) refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!pickers.customers.length) return <p className="text-muted">{t("noCustomers")}</p>;
  const dateLabel = kind === "quotation" ? t("quoteDate") : kind === "salesOrder" ? t("orderDate") : t("issueDate");

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("customer")} required requiredLabel={tCommon("required")} error={customerError}>
          {initial && kind === "invoice" ? (
            <Input value={customers.get(customerId)?.name ?? ""} readOnly disabled />
          ) : (
            <Select
              value={customerId || null}
              placeholder={t("customerPlaceholder")}
              onValueChange={pickCustomer}
              options={pickers.customers.map((c) => ({ value: c.id, label: c.name, description: c.code }))}
            />
          )}
        </Field>
        {kind !== "invoice" ? (
          <Field label={t("salesperson")}>
            <Select
              value={salespersonId || null}
              placeholder={t("salespersonPlaceholder")}
              onValueChange={setSalespersonId}
              options={pickers.people.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={dateLabel}>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value || bangkokToday())} />
        </Field>
        {kind === "quotation" ? (
          <Field label={t("validUntil")} hint={t("validUntilHint")}>
            <Input type="date" min={date} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </Field>
        ) : null}
        {kind === "salesOrder" ? (
          <Field label={t("deliveryDate")}>
            <Input
              type="date"
              min={date}
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
            />
          </Field>
        ) : null}
        <Field label={t("paymentTerms")}>
          <NumberInput min={0} max={365} unit={t("days")} value={terms} onChange={(event) => setTerms(event.target.value)} />
        </Field>
        {kind === "quotation" ? (
          <Field label={t("leadTime")}>
            <NumberInput
              min={0}
              max={365}
              unit={t("days")}
              value={leadTime}
              placeholder={t("leadTimePlaceholder")}
              onChange={(event) => setLeadTime(event.target.value)}
            />
          </Field>
        ) : (
          <Field label={t("customerPoNo")}>
            <Input
              value={customerPoNo}
              placeholder={t("customerPoNoPlaceholder")}
              onChange={(event) => setCustomerPoNo(event.target.value)}
            />
          </Field>
        )}
        {kind === "salesOrder" && pickers.warehouses.length > 1 ? (
          <Field label={t("warehouse")}>
            <Select
              value={warehouseId || null}
              onValueChange={setWarehouseId}
              options={pickers.warehouses.map((w) => ({ value: w.id, label: w.name, description: w.code }))}
            />
          </Field>
        ) : null}
      </div>
      <SegmentedControl
        label={t("vatMode")}
        size="md"
        value={vatMode}
        onValueChange={setVatMode}
        options={VAT_MODES.map((mode) => ({ value: mode, label: tVat(mode) }))}
      />
      {headerOnly ? (
        <p className="text-muted text-sm">{t("linesFromDeliveries")}</p>
      ) : (
        <SalesLinesEditor
          items={pickers.items}
          lines={lines}
          onChange={setLines}
          errors={errors}
          locale={locale}
          withFulfilment={kind === "salesOrder"}
        />
      )}
      <TotalsEstimate lines={lines} vatMode={vatMode} fallback={t("moneyNote")} />
      {kind === "salesOrder" ? (
        <Field label={t("shipTo")}>
          <Textarea rows={2} value={shipTo} onChange={(event) => setShipTo(event.target.value)} />
        </Field>
      ) : null}
      {kind === "quotation" ? (
        <Field label={t("terms")} hint={t("termsHint")}>
          <Textarea
            rows={3}
            value={conditions}
            placeholder={t("termsPlaceholder")}
            onChange={(event) => setConditions(event.target.value)}
          />
        </Field>
      ) : null}
      <Field label={t("note")}>
        <Textarea rows={2} value={note} placeholder={t("notePlaceholder")} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
