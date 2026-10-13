"use client";

import { useTranslations } from "next-intl";

import { formatQty } from "@/features/partner/erp/format";
import { Select } from "@/features/partner/select";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import type { SalesPickers } from "./types";
import { ERP_UNIT_VALUES } from "@/features/partner/erp/units";

export type Unit = Schemas["ErpUnit"];
export type Fulfilment = Schemas["ErpFulfilment"];
/** Sales lines list counts, packaging and service units first. */
const FIRST: Unit[] = ["pcs", "box", "pack", "set", "pouch", "tube", "job", "round", "trip"];
export const UNITS: Unit[] = [...FIRST, ...ERP_UNIT_VALUES.filter((unit) => !FIRST.includes(unit))];
const FULFILMENTS: Fulfilment[] = ["stock", "make", "service"];

export interface SalesLine {
  key: string;
  itemId: string;
  description: string;
  quantity: string;
  unit: Unit;
  price: string;
  discountPct: string;
  fulfilment?: Fulfilment;
}

export type SalesLineErrors = Record<number, Partial<Record<"item" | "quantity" | "price", string>>>;

let seq = 0;
export const newSalesLine = (patch: Partial<SalesLine> = {}): SalesLine => ({
  key: `sl-${(seq += 1)}`,
  itemId: "",
  description: "",
  quantity: "",
  unit: "pcs",
  price: "",
  discountPct: "",
  ...patch,
});

/**
 * The lines of a quotation, sales order or invoice: an item of the factory (its name and unit come with it) or
 * a free-text line — design work, freight — with a quantity, unit, price and discount. On a sales order each
 * line also says whether it ships from stock, is made to order or is a service (D-361). Totals come back from
 * the API.
 */
export function SalesLinesEditor({
  items,
  lines,
  onChange,
  errors = {},
  locale,
  withFulfilment = false,
}: {
  items: SalesPickers["items"];
  lines: SalesLine[];
  onChange: (lines: SalesLine[]) => void;
  errors?: SalesLineErrors;
  locale: string;
  withFulfilment?: boolean;
}) {
  const t = useTranslations("partnerSales.lines");
  const tUnits = useTranslations("partnerErp.common.units");
  const byId = new Map(items.map((item) => [item.id, item]));
  const update = (index: number, patch: Partial<SalesLine>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const options = [
    { value: "__free", label: t("freeText"), description: t("freeTextHint") },
    ...items.map((item) => ({ value: item.id, label: item.name, description: item.sku })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const item = byId.get(line.itemId);
          const error = errors[index] ?? {};
          return (
            <li key={line.key} className="border-border bg-surface rounded-xl border p-3 md:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-muted text-sm font-medium">{t("line", { n: index + 1 })}</span>
                {lines.length > 1 ? (
                  <IconButton
                    name="trash"
                    size="sm"
                    label={t("remove", { n: index + 1 })}
                    onClick={() => onChange(lines.filter((_, i) => i !== index))}
                  />
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("item")} error={error.item}>
                  <Select
                    value={line.itemId || "__free"}
                    onValueChange={(value) => {
                      const next = byId.get(value);
                      update(index, {
                        itemId: value === "__free" ? "" : value,
                        ...(next ? { unit: next.baseUnit as Unit, description: line.description || "" } : {}),
                        ...(withFulfilment ? { fulfilment: next ? (line.fulfilment ?? "stock") : "service" } : {}),
                      });
                    }}
                    options={options}
                  />
                </Field>
                <Field
                  label={item ? t("descriptionOptional") : t("description")}
                  hint={item ? t("descriptionHint", { name: item.name }) : undefined}
                  error={item ? undefined : error.item}
                >
                  <Input
                    value={line.description}
                    placeholder={item ? item.name : t("descriptionPlaceholder")}
                    onChange={(event) => update(index, { description: event.target.value })}
                  />
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Field
                  label={t("quantity")}
                  error={error.quantity}
                  hint={
                    item
                      ? t("available", {
                          qty: formatQty(item.available, locale),
                          unit: tUnits(item.baseUnit as never),
                        })
                      : undefined
                  }
                >
                  <NumberInput
                    step="any"
                    min={0}
                    value={line.quantity}
                    placeholder={t("quantityPlaceholder")}
                    onChange={(event) => update(index, { quantity: event.target.value })}
                  />
                </Field>
                <Field label={t("unit")}>
                  {item ? (
                    <Input value={tUnits(item.baseUnit as never)} readOnly disabled />
                  ) : (
                    <Select
                      value={line.unit}
                      onValueChange={(unit) => update(index, { unit: unit as Unit })}
                      options={UNITS.map((unit) => ({ value: unit, label: tUnits(unit) }))}
                    />
                  )}
                </Field>
                <Field label={t("price")} error={error.price}>
                  <NumberInput
                    step="any"
                    min={0}
                    unit="฿"
                    value={line.price}
                    placeholder={t("pricePlaceholder")}
                    onChange={(event) => update(index, { price: event.target.value })}
                  />
                </Field>
                <Field label={t("discount")}>
                  <NumberInput
                    step="any"
                    min={0}
                    max={100}
                    unit="%"
                    value={line.discountPct}
                    placeholder={t("discountPlaceholder")}
                    onChange={(event) => update(index, { discountPct: event.target.value })}
                  />
                </Field>
              </div>
              {withFulfilment ? (
                <div className="mt-3">
                  <SegmentedControl
                    label={t("fulfilment")}
                    size="md"
                    value={line.fulfilment ?? (item ? "stock" : "service")}
                    onValueChange={(fulfilment) => update(index, { fulfilment })}
                    options={FULFILMENTS.filter((f) => (item ? true : f === "service")).map((f) => ({
                      value: f,
                      label: t(`fulfilments.${f}`),
                    }))}
                  />
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
        onClick={() => onChange([...lines, newSalesLine(withFulfilment ? { fulfilment: "service" } : {})])}
      >
        {t("add")}
      </Button>
    </div>
  );
}
