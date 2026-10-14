"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";


import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { isZero, plainNumber, PRICE_PATTERN, QTY_PATTERN, trimZeros } from "./format";
import { type Line, type LineErrors, LinesEditor, newLine, type PickItem } from "./LinesEditor";
import { TotalsEstimate } from "./TotalsEstimate";

type Po = Schemas["ErpPurchaseOrderDto"];
type VatMode = Po["vatMode"];
const VAT_MODES: VatMode[] = ["exclusive", "inclusive", "none"];
type Terms = ReadonlyMap<string, { unit: string; price: string | null }>;
const NO_TERMS: Terms = new Map();

/**
 * A draft purchase order (D-325): the supplier, dates, how prices treat VAT, and the lines. Totals come back
 * from the API after saving (the web never adds money up). Editing a draft goes under `If-Match`.
 */
export function PurchaseOrderForm({
  order,
  etag,
  items,
  suppliers,
  locale,
  initialSupplierId,
}: {
  order?: Po;
  etag?: string | null;
  items: PickItem[];
  suppliers: Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">[];
  locale: string;
  initialSupplierId?: string;
}) {
  const t = useTranslations("partnerErp.purchasing.form");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const [refresh] = useRefresh();
  const [supplierId, setSupplierId] = useState(order?.supplier.id ?? initialSupplierId ?? "");
  const [orderedOn, setOrderedOn] = useState(order?.orderedOn ?? bangkokToday());
  const [expectedOn, setExpectedOn] = useState(order?.expectedOn ?? "");
  const [vatMode, setVatMode] = useState<VatMode>(order?.vatMode ?? "exclusive");
  const [vatRate, setVatRate] = useState(trimZeros(order?.vatRatePct) || "7");
  const [supplierRef, setSupplierRef] = useState(order?.supplierRef ?? "");
  const [deliverTo, setDeliverTo] = useState(order?.deliverTo ?? "");
  const [note, setNote] = useState(order?.note ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    order?.lines.length
      ? order.lines.map((line) =>
          newLine({
            itemId: line.item.id,
            quantity: trimZeros(line.quantity),
            unit: line.unit,
            price: trimZeros(line.unitPrice),
            discountPct: isZero(line.discountPct) ? "" : trimZeros(line.discountPct),
            description: line.description ?? "",
          }),
        )
      : [newLine()],
  );
  const [errors, setErrors] = useState<LineErrors>({});
  const [supplierError, setSupplierError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState<{ supplierId: string; terms: Terms }>({ supplierId: "", terms: NO_TERMS });
  const terms = fetched.supplierId === supplierId ? fetched.terms : NO_TERMS;

  // D-333: what this supplier sells and at what price, so a picked item comes in its unit and latest price.
  useEffect(() => {
    if (!supplierId) return;
    let live = true;
    browserApi()
      .GET("/v1/partner/factories/{factoryId}/erp/partners/{partnerId}/items", {
        params: { path: { factoryId, partnerId: supplierId } },
      })
      .then(({ data }) => {
        if (live)
          setFetched({
            supplierId,
            terms: new Map(
              (data ?? [])
                .filter((link) => link.status === "active")
                .map((link) => [link.item.id, { unit: link.purchaseUnit, price: link.lastPrice }]),
            ),
          });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [factoryId, supplierId]);

  function check(): boolean {
    const next: LineErrors = {};
    lines.forEach((line, index) => {
      const error: LineErrors[number] = {};
      if (!line.itemId) error.itemId = tCommon("selectItem");
      const quantity = plainNumber(line.quantity);
      if (!QTY_PATTERN.test(quantity) || isZero(quantity)) error.quantity = tCommon("qtyPlaceholder");
      if (!line.price || !PRICE_PATTERN.test(plainNumber(line.price))) error.price = tCommon("pricePlaceholder");
      if (Object.keys(error).length) next[index] = error;
    });
    setErrors(next);
    setSupplierError(supplierId ? undefined : t("supplierRequired"));
    return Boolean(supplierId) && !Object.keys(next).length;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!check()) return;
    setBusy(true);
    const body: Schemas["ErpSavePurchaseOrderDto"] = {
      supplierId,
      orderedOn,
      expectedOn: expectedOn || null,
      vatMode,
      vatRatePct: plainNumber(vatRate) || "0",
      supplierRef: supplierRef.trim() || null,
      deliverTo: deliverTo.trim() || null,
      note: note.trim() || null,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: plainNumber(line.quantity),
        ...(line.unit ? { unit: line.unit as Po["lines"][number]["unit"] } : {}),
        unitPrice: plainNumber(line.price ?? ""),
        ...(line.discountPct ? { discountPct: plainNumber(line.discountPct) } : {}),
        description: line.description?.trim() || null,
      })),
    };
    try {
      if (order) {
        await browserApi().PUT("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}", {
          params: { path: { factoryId, poId: order.id }, header: { "If-Match": etag ?? "" } },
          body,
        });
        toast.success(t("saved"));
        router.push(`/purchasing/${order.id}`);
        router.refresh();
      } else {
        const { data } = await browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-orders", {
          params: { path: { factoryId } },
          body,
        });
        toast.success(t("saved"));
        router.push(data ? `/purchasing/${data.id}` : "/purchasing?view=draft");
      }
    } catch (error) {
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? tCommon("stale") : problemMessage(error, tCommon("failed")));
      if (stale) refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!suppliers.length) return <p className="text-muted">{t("noSuppliers")}</p>;

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <Field label={t("supplier")} required requiredLabel={tCommon("required")} error={supplierError}>
        <Select
          value={supplierId || null}
          placeholder={tCommon("selectSupplier")}
          onValueChange={setSupplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name, description: s.code }))}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("orderedOn")}>
          <Input
            type="date"
            value={orderedOn}
            onChange={(event) => setOrderedOn(event.target.value || bangkokToday())}
          />
        </Field>
        <Field label={t("expectedOn")}>
          <Input
            type="date"
            min={orderedOn}
            value={expectedOn}
            onChange={(event) => setExpectedOn(event.target.value)}
          />
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
      <LinesEditor
        items={items}
        lines={lines}
        onChange={setLines}
        errors={errors}
        locale={locale}
        withUnit
        withPrice={t("unitPrice")}
        withDiscount
        withDescription
        showOnHand
        terms={terms}
      />
      <TotalsEstimate lines={lines} vatMode={vatMode} vatRatePct={vatRate} fallback={tCommon("moneyNote")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("supplierRef")}>
          <Input
            value={supplierRef}
            placeholder={t("supplierRefPlaceholder")}
            onChange={(event) => setSupplierRef(event.target.value)}
          />
        </Field>
        <Field label={t("deliverTo")}>
          <Input
            value={deliverTo}
            placeholder={t("deliverToPlaceholder")}
            onChange={(event) => setDeliverTo(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("note")}>
        <Textarea
          rows={2}
          value={note}
          placeholder={tCommon("notePlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
