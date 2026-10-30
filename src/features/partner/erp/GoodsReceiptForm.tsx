"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { Select } from "@/features/partner/select";
import { useFormat } from "@/features/shared/format/useFormat";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { type ChargeRow, chargeBody, ChargesEditor, chargeValid } from "./ChargesEditor";
import { formatQty, isZero, plainNumber, PRICE_PATTERN, QTY_PATTERN, trimZeros } from "./format";
import { type Line, type LineErrors, LinesEditor, newLine, type PickItem } from "./LinesEditor";

type Po = Schemas["ErpPurchaseOrderDto"];
const NONE = "none";

/**
 * Goods into stock (D-321, D-325): against an open purchase order — its open lines filled in with what is
 * still due, changed to what actually arrived (a zero leaves a line out) — or without one (cash purchase),
 * item by item with a price. The API costs the stock and refuses more than the order allows.
 */
export function GoodsReceiptForm({
  openOrders,
  order,
  items,
  suppliers,
  warehouses,
  locale,
}: {
  openOrders: Pick<Schemas["ErpPurchaseOrderSummaryDto"], "id" | "poNo" | "supplier" | "expectedOn">[];
  order: Po | null;
  items: PickItem[];
  suppliers: Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">[];
  warehouses: Pick<Schemas["ErpWarehouseDto"], "id" | "code" | "name" | "isDefault">[];
  locale: string;
}) {
  const t = useTranslations("partnerErp.move");
  const tCommon = useTranslations("partnerErp.common");
  const tRecv = useTranslations("partnerOps.receiving");
  const tSections = useTranslations("partnerErp.common.sections");
  const format = useFormat();
  const { factoryId } = useFactory();
  const router = useRouter();
  const main = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const [warehouseId, setWarehouseId] = useState(main?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [receivedOn, setReceivedOn] = useState(bangkokToday());
  const [deliveryNoteNo, setDeliveryNoteNo] = useState("");
  const [note, setNote] = useState("");
  const [poQty, setPoQty] = useState<Record<string, string>>(() =>
    Object.fromEntries((order?.lines ?? []).map((line) => [line.id, trimZeros(line.remainingQty)])),
  );
  const [poLots, setPoLots] = useState<Record<string, string>>({});
  // D-349: refused at inspection — recorded with a reason, never stocked nor received.
  const [poRejected, setPoRejected] = useState<Record<string, string>>({});
  const [poReasons, setPoReasons] = useState<Record<string, string>>({});
  // D-350: freight, duty, … into the cost of what is accepted.
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [chargeErrors, setChargeErrors] = useState<Record<number, string>>({});
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [errors, setErrors] = useState<LineErrors>({});
  const [poErrors, setPoErrors] = useState<Record<string, string>>({});
  const [supplierError, setSupplierError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => newIdempotencyKey());
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const byId = new Map(items.map((item) => [item.id, item]));

  const choose = (id: string) => router.replace(id === NONE ? "/stock/receive?po=none" : `/stock/receive?po=${id}`);

  function check(): boolean {
    if (order) {
      const next: Record<string, string> = {};
      let any = false;
      for (const line of order.lines) {
        const value = plainNumber(poQty[line.id] ?? "") || "0";
        const rejected = plainNumber(poRejected[line.id] ?? "") || "0";
        if (!QTY_PATTERN.test(value)) next[line.id] = t("qtyInvalid");
        if (!QTY_PATTERN.test(rejected)) next[`${line.id}:rejected`] = t("qtyInvalid");
        else if (!isZero(rejected) && !poReasons[line.id]?.trim())
          next[`${line.id}:reason`] = tRecv("rejectReasonRequired");
        if (QTY_PATTERN.test(value) && !isZero(value)) {
          any = true;
          if (byId.get(line.item.id)?.trackLots && !poLots[line.id]?.trim())
            next[`${line.id}:lot`] = tCommon("lotHint");
        } else if (QTY_PATTERN.test(rejected) && !isZero(rejected)) any = true;
      }
      setPoErrors(next);
      const badCharges = chargeErrorsOf();
      if (!any && !Object.keys(next).length) toast.error(t("linesRequired"));
      return any && !Object.keys(next).length && !badCharges;
    }
    const next: LineErrors = {};
    lines.forEach((line, index) => {
      const error: LineErrors[number] = {};
      if (!line.itemId) error.itemId = t("itemRequired");
      const quantity = plainNumber(line.quantity);
      if (!QTY_PATTERN.test(quantity) || isZero(quantity)) error.quantity = t("qtyRequired");
      if (!line.price || !PRICE_PATTERN.test(plainNumber(line.price))) error.price = t("priceRequired");
      if (byId.get(line.itemId)?.trackLots && !line.lotNo?.trim()) error.lotNo = tCommon("lotHint");
      if (Object.keys(error).length) next[index] = error;
    });
    setErrors(next);
    setSupplierError(supplierId ? undefined : tCommon("selectSupplier"));
    const badCharges = chargeErrorsOf();
    return !Object.keys(next).length && Boolean(supplierId) && !badCharges;
  }

  /** Marks charges without a valid amount; true when any is wrong. */
  function chargeErrorsOf(): boolean {
    const bad = Object.fromEntries(charges.filter((c) => !chargeValid(c)).map((c) => [c.key, tRecv("chargeInvalid")]));
    setChargeErrors(bad);
    return Object.keys(bad).length > 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!check()) return;
    setBusy(true);
    const body: Schemas["ErpCreateGoodsReceiptDto"] = {
      warehouseId,
      receivedOn,
      deliveryNoteNo: deliveryNoteNo.trim() || null,
      note: note.trim() || null,
      ...(order
        ? {
            purchaseOrderId: order.id,
            lines: order.lines
              .filter((line) => {
                const value = plainNumber(poQty[line.id] ?? "");
                const rejected = plainNumber(poRejected[line.id] ?? "");
                return (value && !isZero(value)) || (rejected && !isZero(rejected));
              })
              .map((line) => {
                const rejected = plainNumber(poRejected[line.id] ?? "");
                return {
                  purchaseOrderLineId: line.id,
                  quantity: plainNumber(poQty[line.id] ?? "") || "0",
                  ...(poLots[line.id]?.trim() ? { lotNo: poLots[line.id]!.trim() } : {}),
                  ...(rejected && !isZero(rejected)
                    ? { rejectedQuantity: rejected, rejectReason: poReasons[line.id]!.trim() }
                    : {}),
                };
              }),
          }
        : {
            supplierId,
            lines: lines.map((line) => ({
              itemId: line.itemId,
              quantity: plainNumber(line.quantity),
              ...(line.unit ? { unit: line.unit as Po["lines"][number]["unit"] } : {}),
              unitPrice: plainNumber(line.price ?? ""),
              ...(line.lotNo?.trim() ? { lotNo: line.lotNo.trim() } : {}),
            })),
          }),
      ...(charges.length ? { charges: charges.map(chargeBody) } : {}),
    };
    try {
      const { data } = await browserApi().POST("/v1/partner/factories/{factoryId}/erp/goods-receipts", {
        params: { path: { factoryId }, header: { "Idempotency-Key": key } },
        body,
      });
      toast.success(t("received", { no: data?.grNo ?? "" }));
      router.push(data ? `/purchasing/receipts/${data.id}` : "/stock");
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.status < 500) setKey(newIdempotencyKey());
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FormColumns
        aside={
          <FormSummary
            title={tSections("summary")}
            action={
              <Button type="submit" size="xl" loading={busy} iconStart="package-check">
                {t("receiveSubmit")}
              </Button>
            }
          >
            <SummaryRows
              rows={[
                { key: "po", label: t("purchaseOrder"), value: order ? (order.poNo ?? "") : t("noPurchaseOrder") },
                {
                  key: "supplier",
                  label: t("supplier"),
                  value: order ? order.supplier.name : (suppliers.find((s) => s.id === supplierId)?.name ?? ""),
                },
                {
                  key: "warehouse",
                  label: tCommon("warehouse"),
                  value: warehouses.find((w) => w.id === warehouseId)?.name ?? "",
                },
                { key: "date", label: t("receivedOn"), value: receivedOn ? format.date(receivedOn) : "" },
              ]}
            />
          </FormSummary>
        }
      >
        <FormSection card step={1} title={tSections("delivery")}>
          <Field label={t("purchaseOrder")}>
            <Select
              value={order?.id ?? NONE}
              onValueChange={choose}
              options={[
                { value: NONE, label: t("noPurchaseOrder") },
                ...openOrders.map((po) => ({
                  value: po.id,
                  label: `${po.poNo ?? ""} · ${po.supplier.name}`,
                  description: po.expectedOn ?? undefined,
                })),
              ]}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            {order ? (
              <Field label={t("supplier")}>
                <Input value={order.supplier.name} readOnly />
              </Field>
            ) : (
              <Field label={t("supplier")} required requiredLabel={tCommon("required")} error={supplierError}>
                <Select
                  value={supplierId || null}
                  placeholder={tCommon("selectSupplier")}
                  onValueChange={setSupplierId}
                  options={suppliers.map((s) => ({ value: s.id, label: s.name, description: s.code }))}
                />
              </Field>
            )}
            <Field label={tCommon("warehouse")}>
              <Select
                value={warehouseId}
                onValueChange={setWarehouseId}
                options={warehouses.map((w) => ({ value: w.id, label: w.name, description: w.code }))}
              />
            </Field>
            <Field label={t("receivedOn")}>
              <Input
                type="date"
                max={bangkokToday()}
                value={receivedOn}
                onChange={(event) => setReceivedOn(event.target.value || bangkokToday())}
              />
            </Field>
          </div>
          <Field label={t("deliveryNote")}>
            <Input
              value={deliveryNoteNo}
              placeholder={t("deliveryNotePlaceholder")}
              onChange={(event) => setDeliveryNoteNo(event.target.value)}
            />
          </Field>
        </FormSection>
        <FormSection card step={2} title={tSections("lines")}>
          {order ? (
            <ol className="flex flex-col gap-3">
              {order.lines.map((line) => {
                const tracks = byId.get(line.item.id)?.trackLots;
                return (
                  <li
                    key={line.id}
                    className="border-border bg-surface grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{line.item.name}</p>
                      <p className="text-muted text-sm">
                        {line.item.sku} ·{" "}
                        {t("remaining", {
                          qty: tCommon("inUnit", { qty: formatQty(line.remainingQty, locale), unit: unit(line.unit) }),
                        })}
                      </p>
                    </div>
                    <Field label={tCommon("quantity")} error={poErrors[line.id]}>
                      <NumberInput
                        min={0}
                        step="any"
                        unit={unit(line.unit)}
                        value={poQty[line.id] ?? ""}
                        placeholder={tCommon("qtyPlaceholder")}
                        onChange={(event) => setPoQty({ ...poQty, [line.id]: event.target.value })}
                      />
                    </Field>
                    {tracks ? (
                      <Field label={tCommon("lotNo")} error={poErrors[`${line.id}:lot`]}>
                        <Input
                          value={poLots[line.id] ?? ""}
                          placeholder={tCommon("lotPlaceholder")}
                          onChange={(event) => setPoLots({ ...poLots, [line.id]: event.target.value })}
                        />
                      </Field>
                    ) : null}
                    <Field
                      label={tRecv("rejected")}
                      hint={tRecv("rejectedHint")}
                      error={poErrors[`${line.id}:rejected`]}
                    >
                      <NumberInput
                        min={0}
                        step="any"
                        unit={unit(line.unit)}
                        value={poRejected[line.id] ?? ""}
                        onChange={(event) => setPoRejected({ ...poRejected, [line.id]: event.target.value })}
                      />
                    </Field>
                    {poRejected[line.id] && !isZero(plainNumber(poRejected[line.id]!)) ? (
                      <Field label={tRecv("rejectReason")} error={poErrors[`${line.id}:reason`]}>
                        <Input
                          value={poReasons[line.id] ?? ""}
                          placeholder={tRecv("rejectReasonPlaceholder")}
                          onChange={(event) => setPoReasons({ ...poReasons, [line.id]: event.target.value })}
                        />
                      </Field>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <LinesEditor
              items={items}
              lines={lines}
              onChange={setLines}
              errors={errors}
              locale={locale}
              withUnit
              withPrice={t("price")}
              showOnHand={false}
            />
          )}
        </FormSection>
        <FormSection card step={3} title={tSections("references")}>
          <ChargesEditor rows={charges} onChange={setCharges} partners={suppliers} errors={chargeErrors} />
          <Field label={tCommon("notePlaceholder")} labelHidden>
            <Textarea
              rows={2}
              value={note}
              placeholder={tCommon("notePlaceholder")}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </FormSection>
      </FormColumns>
    </form>
  );
}
