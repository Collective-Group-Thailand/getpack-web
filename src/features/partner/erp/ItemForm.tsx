"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useRefresh } from "@/features/partner/client";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { PRICE_PATTERN, plainNumber, QTY_PATTERN, trimZeros } from "./format";
import { ERP_UNIT_VALUES } from "./units";

const KINDS = ["raw_material", "consumable", "spare_part", "semi_finished", "finished_good", "packing"] as const;
const UNITS = ERP_UNIT_VALUES;
const SAME = "same";

type Item = Schemas["ErpItemDto"];
type Errors = Record<string, string>;

interface Value {
  sku: string;
  name: string;
  kind: string;
  baseUnit: string;
  purchaseUnit: string;
  purchaseFactor: string;
  reorderPoint: string;
  reorderQty: string;
  leadTimeDays: string;
  defaultSupplierId: string;
  trackLots: boolean;
  note: string;
}

const fromItem = (item: Item | undefined): Value => ({
  sku: item?.sku ?? "",
  name: item?.name ?? "",
  kind: item?.kind ?? "raw_material",
  baseUnit: item?.baseUnit ?? "sheet",
  purchaseUnit: item?.purchaseUnit ?? SAME,
  purchaseFactor: item && item.purchaseUnit ? trimZeros(item.purchaseFactor) : "",
  reorderPoint: trimZeros(item?.reorderPoint),
  reorderQty: trimZeros(item?.reorderQty),
  leadTimeDays: item?.leadTimeDays === null || item?.leadTimeDays === undefined ? "" : String(item.leadTimeDays),
  defaultSupplierId: item?.defaultSupplier?.id ?? "",
  trackLots: item?.trackLots ?? false,
  note: item?.note ?? "",
});

/**
 * An item of the factory's stock (D-320): what it is, the unit it is counted in and the unit it is bought
 * in, when to reorder and from whom. New items get a SKU; the SKU and the stock unit never change after.
 * Edits go under `If-Match` (412 → reload).
 */
export function ItemForm({
  item,
  etag,
  suppliers,
}: {
  item?: Item;
  etag?: string | null;
  suppliers: Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">[];
}) {
  const t = useTranslations("partnerErp.item");
  const tCommon = useTranslations("partnerErp.common");
  const tSections = useTranslations("partnerErp.common.sections");
  const { factoryId } = useFactory();
  const router = useRouter();
  const [refresh] = useRefresh();
  const [value, setValue] = useState<Value>(() => fromItem(item));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Value>) => setValue((current) => ({ ...current, ...patch }));
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const buysOther = value.purchaseUnit !== SAME && value.purchaseUnit !== value.baseUnit;

  function check(): Errors {
    const next: Errors = {};
    if (!item && !/^[A-Za-z0-9-_./]{1,40}$/.test(value.sku.trim())) next.sku = t("skuRequired");
    if (!value.name.trim()) next.name = t("nameRequired");
    if (buysOther && !PRICE_PATTERN.test(plainNumber(value.purchaseFactor))) next.purchaseFactor = t("factorRequired");
    for (const key of ["reorderPoint", "reorderQty"] as const)
      if (value[key] && !QTY_PATTERN.test(plainNumber(value[key]))) next[key] = tCommon("qtyPlaceholder");
    return next;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next = check();
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const common = {
      name: value.name.trim(),
      kind: value.kind as Item["kind"],
      purchaseUnit: buysOther ? (value.purchaseUnit as Item["baseUnit"]) : null,
      ...(buysOther ? { purchaseFactor: plainNumber(value.purchaseFactor) } : {}),
      reorderPoint: value.reorderPoint ? plainNumber(value.reorderPoint) : null,
      reorderQty: value.reorderQty ? plainNumber(value.reorderQty) : null,
      leadTimeDays: value.leadTimeDays ? Number.parseInt(value.leadTimeDays, 10) : null,
      defaultSupplierId: value.defaultSupplierId || null,
      trackLots: value.trackLots,
      note: value.note.trim() || null,
    };
    try {
      if (item) {
        await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/items/{itemId}", {
          params: { path: { factoryId, itemId: item.id }, header: { "If-Match": etag ?? "" } },
          body: common,
        });
        toast.success(tCommon("saved"));
        refresh();
      } else {
        const { data } = await browserApi().POST("/v1/partner/factories/{factoryId}/erp/items", {
          params: { path: { factoryId } },
          body: { ...common, sku: value.sku.trim(), baseUnit: value.baseUnit as Item["baseUnit"] },
        });
        toast.success(t("created", { sku: data?.sku ?? value.sku }));
        router.push(data ? `/stock/items/${data.id}` : "/stock");
      }
    } catch (error) {
      if (isApiError(error)) setErrors(Object.fromEntries(error.errors.map((e) => [e.path, e.message])));
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? tCommon("stale") : problemMessage(error, tCommon("failed")));
      if (stale) refresh();
    } finally {
      setBusy(false);
    }
  }

  const supplierOptions = [
    { value: "", label: t("noSupplier") },
    ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name, description: supplier.code })),
  ];

  const details = (
    <>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field
          label={t("sku")}
          hint={item ? undefined : t("skuHint")}
          required={!item}
          requiredLabel={tCommon("required")}
          error={errors.sku}
        >
          <Input
            value={value.sku}
            disabled={Boolean(item)}
            autoCapitalize="characters"
            placeholder={t("skuPlaceholder")}
            onChange={(event) => set({ sku: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field label={t("name")} required requiredLabel={tCommon("required")} error={errors.name}>
          <Input
            value={value.name}
            placeholder={t("namePlaceholder")}
            onChange={(event) => set({ name: event.target.value })}
          />
        </Field>
      </div>
      <Field label={t("kind")}>
        <Select
          value={value.kind}
          onValueChange={(kind) => set({ kind })}
          options={KINDS.map((kind) => ({ value: kind, label: tCommon(`itemKinds.${kind}` as never) }))}
        />
      </Field>
    </>
  );
  const units = (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("baseUnit")} hint={item ? undefined : t("baseUnitHint")}>
          <Select
            value={value.baseUnit}
            disabled={Boolean(item)}
            onValueChange={(baseUnit) => set({ baseUnit })}
            options={UNITS.map((code) => ({ value: code, label: unit(code) }))}
          />
        </Field>
        <Field label={t("purchaseUnit")} hint={t("purchaseUnitHint")}>
          <Select
            value={value.purchaseUnit}
            onValueChange={(purchaseUnit) => set({ purchaseUnit })}
            options={[
              { value: SAME, label: t("samePurchaseUnit") },
              ...UNITS.filter((code) => code !== value.baseUnit).map((code) => ({ value: code, label: unit(code) })),
            ]}
          />
        </Field>
      </div>
      {buysOther ? (
        <Field
          label={t("purchaseFactor", { purchase: unit(value.purchaseUnit), base: unit(value.baseUnit) })}
          required
          requiredLabel={tCommon("required")}
          error={errors.purchaseFactor}
        >
          <NumberInput
            min={0}
            step="any"
            unit={unit(value.baseUnit)}
            value={value.purchaseFactor}
            placeholder={t("purchaseFactorPlaceholder")}
            onChange={(event) => set({ purchaseFactor: event.target.value })}
          />
        </Field>
      ) : null}
    </>
  );
  const buying = (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t("reorderPoint")} hint={t("inBase", { unit: unit(value.baseUnit) })} error={errors.reorderPoint}>
          <NumberInput
            min={0}
            step="any"
            unit={unit(value.baseUnit)}
            value={value.reorderPoint}
            placeholder={t("reorderPointPlaceholder")}
            onChange={(event) => set({ reorderPoint: event.target.value })}
          />
        </Field>
        <Field label={t("reorderQty")} hint={t("inBase", { unit: unit(value.baseUnit) })} error={errors.reorderQty}>
          <NumberInput
            min={0}
            step="any"
            unit={unit(value.baseUnit)}
            value={value.reorderQty}
            placeholder={t("reorderQtyPlaceholder")}
            onChange={(event) => set({ reorderQty: event.target.value })}
          />
        </Field>
        <Field label={t("leadTime")}>
          <NumberInput
            min={0}
            max={365}
            step={1}
            value={value.leadTimeDays}
            placeholder={t("leadTimePlaceholder")}
            onChange={(event) => set({ leadTimeDays: event.target.value })}
          />
        </Field>
      </div>
      <Field label={t("supplier")} hint={t("supplierHint")}>
        <Select
          value={value.defaultSupplierId}
          onValueChange={(defaultSupplierId) => set({ defaultSupplierId })}
          options={supplierOptions}
        />
      </Field>
      <Checkbox
        label={t("trackLots")}
        description={t("trackLotsHint")}
        checked={value.trackLots}
        onCheckedChange={(checked) => set({ trackLots: checked === true })}
      />
      <Field label={t("note")}>
        <Textarea
          value={value.note}
          placeholder={tCommon("notePlaceholder")}
          onChange={(event) => set({ note: event.target.value })}
        />
      </Field>
    </>
  );
  const submit = (
    <Button type="submit" size="xl" loading={busy} iconStart="save">
      {item ? tCommon("save") : t("create")}
    </Button>
  );

  // Editing an item happens inside its page (a disclosure): the fields in one column. A new item gets the
  // numbered sections and the summary panel with the one save.
  if (item)
    return (
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
        {details}
        {units}
        {buying}
        <div className="flex">{submit}</div>
      </form>
    );
  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <FormColumns
        aside={
          <FormSummary title={tSections("summary")} action={submit}>
            <SummaryRows
              rows={[
                { key: "sku", label: t("sku"), value: value.sku.trim() },
                { key: "name", label: t("name"), value: value.name.trim() },
                { key: "kind", label: t("kind"), value: tCommon(`itemKinds.${value.kind}` as never) },
                { key: "unit", label: t("baseUnit"), value: unit(value.baseUnit) },
              ]}
            />
          </FormSummary>
        }
      >
        <FormSection card step={1} title={tSections("item")}>
          {details}
        </FormSection>
        <FormSection card step={2} title={tSections("units")}>
          {units}
        </FormSection>
        <FormSection card step={3} title={tSections("buying")}>
          {buying}
        </FormSection>
      </FormColumns>
    </form>
  );
}

/** Archives or restores an item (archived items stay on old documents). */
export function ItemStatusButton({ item, etag }: { item: Item; etag: string | null }) {
  const t = useTranslations("partnerErp.item");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  const archived = item.status === "archived";
  async function flip() {
    setBusy(true);
    try {
      await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/items/{itemId}", {
        params: { path: { factoryId, itemId: item.id }, header: { "If-Match": etag ?? "" } },
        body: { status: archived ? "active" : "archived" },
      });
      toast.success(tCommon("saved"));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      variant={archived ? "secondary" : "destructive"}
      iconStart={archived ? "undo" : "archive"}
      loading={busy}
      onClick={() => void flip()}
    >
      {archived ? t("restore") : t("archive")}
    </Button>
  );
}
