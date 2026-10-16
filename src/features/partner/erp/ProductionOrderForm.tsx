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
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { useErpCall } from "./call";
import { isZero, plainNumber, QTY_PATTERN } from "./format";

type Item = Pick<Schemas["ErpItemDto"], "id" | "sku" | "name" | "kind" | "baseUnit">;
type Recipe = Pick<Schemas["ErpRecipeDto"], "id" | "name" | "item" | "status">;
type Warehouse = Pick<Schemas["ErpWarehouseDto"], "id" | "code" | "name" | "isDefault">;
type Source = "stock" | "sales_order";

/**
 * A production order of the factory's own (D-340): what to make, how many, for stock or a customer's order,
 * by when — materials and steps come from the product's recipe, scaled by the API. getpack jobs need none of
 * this: they become orders when the factory accepts them.
 */
export function ProductionOrderForm({
  items,
  recipes,
  warehouses,
  initialItemId,
}: {
  items: Item[];
  recipes: Recipe[];
  warehouses: Warehouse[];
  initialItemId?: string;
}) {
  const t = useTranslations("partnerFactory.orders.form");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const [source, setSource] = useState<Source>("stock");
  const [itemId, setItemId] = useState(initialItemId ?? "");
  const [quantity, setQuantity] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [startOn, setStartOn] = useState("");
  const [priority, setPriority] = useState("0");
  const [warehouseId, setWarehouseId] = useState((warehouses.find((w) => w.isDefault) ?? warehouses[0])?.id ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const product = items.find((i) => i.id === itemId);
  const own = recipes.filter((r) => r.item.id === itemId && r.status === "active");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!itemId) next.item = t("productRequired");
    if (!QTY_PATTERN.test(plainNumber(quantity)) || isZero(plainNumber(quantity)))
      next.quantity = tCommon("qtyPlaceholder");
    setErrors(next);
    if (Object.keys(next).length) return;
    const saved = await call(
      async () =>
        (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/production-orders", {
            params: { path: { factoryId } },
            body: {
              source,
              itemId,
              quantity: plainNumber(quantity),
              ...(recipeId ? { recipeId } : {}),
              title: title.trim() || null,
              dueOn: dueOn || null,
              plannedStartOn: startOn || null,
              priority: Number.parseInt(priority, 10) || 0,
              ...(warehouseId ? { warehouseId } : {}),
              note: note.trim() || null,
            },
          })
        ).data,
      t("saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/planning/orders/${saved.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <SegmentedControl
        label={t("source")}
        size="md"
        value={source}
        onValueChange={setSource}
        options={(["stock", "sales_order"] as const).map((s) => ({ value: s, label: t(`sources.${s}`) }))}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("product")} required requiredLabel={tCommon("required")} error={errors.item}>
          <Select
            value={itemId || null}
            placeholder={tCommon("selectItem")}
            onValueChange={(id) => {
              setItemId(id);
              setRecipeId("");
            }}
            options={items.map((i) => ({ value: i.id, label: i.name, description: i.sku }))}
          />
        </Field>
        <Field label={t("quantity")} required requiredLabel={tCommon("required")} error={errors.quantity}>
          <NumberInput
            step="any"
            min={0}
            unit={product ? tCommon(`units.${product.baseUnit}` as never) : undefined}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <Field label={t("recipe")} hint={own.length ? t("recipeHint") : itemId ? t("noRecipe") : undefined}>
          <Select
            value={recipeId || "auto"}
            onValueChange={(id) => setRecipeId(id === "auto" ? "" : id)}
            options={[{ value: "auto", label: t("recipeAuto") }, ...own.map((r) => ({ value: r.id, label: r.name }))]}
          />
        </Field>
        <Field label={t("title")} hint={t("titleHint")}>
          <Input value={title} placeholder={product?.name ?? ""} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label={t("startOn")}>
          <Input
            type="date"
            min={bangkokToday()}
            value={startOn}
            onChange={(event) => setStartOn(event.target.value)}
          />
        </Field>
        <Field label={t("dueOn")}>
          <Input
            type="date"
            min={startOn || bangkokToday()}
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
          />
        </Field>
        <Field label={t("priority")} hint={t("priorityHint")}>
          <Select
            value={priority}
            onValueChange={setPriority}
            options={["0", "3", "5", "9"].map((p) => ({ value: p, label: t(`priorities.${p}`) }))}
          />
        </Field>
        <Field label={tCommon("warehouse")}>
          <Select
            value={warehouseId}
            onValueChange={setWarehouseId}
            options={warehouses.map((w) => ({ value: w.id, label: w.name, description: w.code }))}
          />
        </Field>
      </div>
      <Field label={t("note")}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
