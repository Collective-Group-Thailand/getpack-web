"use client";

import { useTranslations } from "next-intl";

import { Select } from "@/features/partner/select";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";

import { formatQty } from "./format";

export type PickItem = Pick<
  Schemas["ErpItemDto"],
  "id" | "sku" | "name" | "baseUnit" | "purchaseUnit" | "purchaseFactor" | "trackLots" | "lastPurchasePrice"
> & { stock: Pick<Schemas["ErpItemDto"]["stock"], "onHand"> };

export interface Line {
  key: string;
  itemId: string;
  quantity: string;
  /** A unit other than the item's base (a purchase order line). */
  unit?: string;
  price?: string;
  discountPct?: string;
  lotNo?: string;
  description?: string;
}

export type LineErrors = Record<number, Partial<Record<"itemId" | "quantity" | "price" | "lotNo" | "unit", string>>>;

let seq = 0;
export const newLine = (patch: Partial<Line> = {}): Line => ({
  key: `line-${(seq += 1)}`,
  itemId: "",
  quantity: "",
  ...patch,
});

/**
 * The lines of a stock or purchasing document, one card per line on a phone and a row on a desk: an item
 * picked by name or code (the list searches), its quantity in the stated unit, and — where the document
 * needs them — a price, a discount, a lot number. Money is never added up here: the API totals the
 * document after it is saved.
 */
export function LinesEditor({
  items,
  lines,
  onChange,
  errors = {},
  locale,
  quantityLabel,
  quantityPlaceholder,
  signed = false,
  withUnit = false,
  withPrice,
  withDiscount = false,
  withDescription = false,
  showOnHand = true,
}: {
  items: PickItem[];
  lines: Line[];
  onChange: (lines: Line[]) => void;
  errors?: LineErrors;
  locale: string;
  quantityLabel?: string;
  quantityPlaceholder?: string;
  /** An adjustment: + and − quantities. */
  signed?: boolean;
  /** Choose between the purchase unit and the base unit (purchase orders, receipts without a PO). */
  withUnit?: boolean;
  /** A price per unit, with its label. */
  withPrice?: string;
  withDiscount?: boolean;
  withDescription?: boolean;
  showOnHand?: boolean;
}) {
  const t = useTranslations("partnerErp.common");
  const tPo = useTranslations("partnerErp.purchasing.form");
  const tMove = useTranslations("partnerErp.move");
  const byId = new Map(items.map((item) => [item.id, item]));
  const unit = (code: string) => t(`units.${code}` as never);
  const update = (index: number, patch: Partial<Line>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const remove = (index: number) => onChange(lines.filter((_, i) => i !== index));
  const options = items.map((item) => ({ value: item.id, label: item.name, description: item.sku }));

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const item = byId.get(line.itemId);
          const lineUnit = line.unit ?? item?.purchaseUnit ?? item?.baseUnit;
          const error = errors[index] ?? {};
          return (
            <li key={line.key} className="border-border bg-surface rounded-xl border p-3 md:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-muted text-sm font-medium">{t("line", { n: index + 1 })}</span>
                {lines.length > 1 ? (
                  <IconButton
                    name="trash"
                    size="sm"
                    label={t("removeLine", { n: index + 1 })}
                    onClick={() => remove(index)}
                  />
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,2.4fr)_repeat(auto-fit,minmax(9rem,1fr))]">
                <Field label={t("item")} error={error.itemId}>
                  <Select
                    value={line.itemId || null}
                    placeholder={t("selectItem")}
                    onValueChange={(itemId) => {
                      const next = byId.get(itemId);
                      update(index, {
                        itemId,
                        ...(withUnit ? { unit: next?.purchaseUnit ?? next?.baseUnit } : {}),
                        ...(withPrice && next?.lastPurchasePrice && !line.price
                          ? { price: next.lastPurchasePrice.replace(/0+$/, "").replace(/\.$/, "") }
                          : {}),
                      });
                    }}
                    options={options}
                  />
                </Field>
                <Field
                  label={quantityLabel ?? t("quantity")}
                  hint={
                    showOnHand && item
                      ? tMove("onHandNow", {
                          qty: t("inUnit", { qty: formatQty(item.stock.onHand, locale), unit: unit(item.baseUnit) }),
                        })
                      : undefined
                  }
                  error={error.quantity}
                >
                  <NumberInput
                    step="any"
                    min={signed ? undefined : 0}
                    unit={withUnit ? undefined : item ? unit(item.baseUnit) : undefined}
                    value={line.quantity}
                    placeholder={quantityPlaceholder ?? t("qtyPlaceholder")}
                    onChange={(event) => update(index, { quantity: event.target.value })}
                  />
                </Field>
                {withUnit && item ? (
                  <Field label={t("unit")} error={error.unit}>
                    <Select
                      value={lineUnit ?? item.baseUnit}
                      onValueChange={(next) => update(index, { unit: next })}
                      options={[...new Set([item.purchaseUnit, item.baseUnit].filter(Boolean) as string[])].map(
                        (code) => ({
                          value: code,
                          label: unit(code),
                        }),
                      )}
                    />
                  </Field>
                ) : null}
                {withPrice ? (
                  <Field label={withPrice} error={error.price}>
                    <NumberInput
                      step="any"
                      min={0}
                      unit="฿"
                      value={line.price ?? ""}
                      placeholder={t("pricePlaceholder")}
                      onChange={(event) => update(index, { price: event.target.value })}
                    />
                  </Field>
                ) : null}
                {withDiscount ? (
                  <Field label={tPo("discount")}>
                    <NumberInput
                      step="any"
                      min={0}
                      max={100}
                      unit="%"
                      value={line.discountPct ?? ""}
                      placeholder={tPo("discountPlaceholder")}
                      onChange={(event) => update(index, { discountPct: event.target.value })}
                    />
                  </Field>
                ) : null}
                {item?.trackLots ? (
                  <Field label={t("lotNo")} hint={t("lotHint")} error={error.lotNo}>
                    <Input
                      value={line.lotNo ?? ""}
                      placeholder={t("lotPlaceholder")}
                      onChange={(event) => update(index, { lotNo: event.target.value })}
                    />
                  </Field>
                ) : null}
              </div>
              {withDescription ? (
                <div className="mt-3">
                  <Field label={tPo("description")}>
                    <Input
                      value={line.description ?? ""}
                      placeholder={tPo("descriptionPlaceholder")}
                      onChange={(event) => update(index, { description: event.target.value })}
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Button
        variant="secondary"
        iconStart="plus"
        className="self-start"
        onClick={() => onChange([...lines, newLine()])}
      >
        {t("addLine")}
      </Button>
    </div>
  );
}
