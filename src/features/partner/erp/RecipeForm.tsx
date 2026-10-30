"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { Select } from "@/features/partner/select";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field, FormSection } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";

import { useErpCall } from "./call";
import { isZero, plainNumber, QTY_PATTERN, trimZeros } from "./format";

type Recipe = Schemas["ErpRecipeDto"];
type Item = Pick<Schemas["ErpItemDto"], "id" | "sku" | "name" | "kind" | "baseUnit">;
type Machine = Schemas["PersonRefDto"];

interface Material {
  key: string;
  itemId: string;
  quantity: string;
  scrap: string;
}
interface Operation {
  key: string;
  name: string;
  machineId: string;
  setup: string;
  rate: string;
}

let seq = 0;
const k = () => `r-${(seq += 1)}`;
const PER_BATCH = /^\d{1,8}(\.\d{1,6})?$/;
const NO_MACHINE = "none";

/**
 * How a product is made (D-339): the materials one batch takes, with the scrap to allow for, and the steps
 * in order on the factory's machines with setup minutes and pieces per hour — the planned minutes of an order
 * are worked out by the API from them.
 */
export function RecipeForm({
  recipe,
  etag,
  items,
  machines,
  initialItemId,
}: {
  recipe?: Recipe;
  etag?: string | null;
  items: Item[];
  machines: Machine[];
  initialItemId?: string;
}) {
  const t = useTranslations("partnerFactory.recipes.form");
  const tCommon = useTranslations("partnerErp.common");
  const tSections = useTranslations("partnerErp.common.sections");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const [itemId, setItemId] = useState(recipe?.item.id ?? initialItemId ?? "");
  const [name, setName] = useState(recipe?.name ?? "");
  const [batch, setBatch] = useState(trimZeros(recipe?.batchQty) || "1");
  const [note, setNote] = useState(recipe?.note ?? "");
  const [materials, setMaterials] = useState<Material[]>(() =>
    recipe?.materials.length
      ? recipe.materials.map((m) => ({
          key: k(),
          itemId: m.item.id,
          quantity: trimZeros(m.quantity),
          scrap: trimZeros(m.scrapPct),
        }))
      : [{ key: k(), itemId: "", quantity: "", scrap: "" }],
  );
  const [operations, setOperations] = useState<Operation[]>(() =>
    (recipe?.operations ?? []).map((o) => ({
      key: k(),
      name: o.name,
      machineId: o.machine?.id ?? "",
      setup: String(o.setupMinutes),
      rate: trimZeros(o.runRatePerHour),
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const product = items.find((i) => i.id === itemId);
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const byId = new Map(items.map((i) => [i.id, i]));
  const options = (exclude?: string) =>
    items.filter((i) => i.id !== exclude).map((i) => ({ value: i.id, label: i.name, description: i.sku }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!itemId) next.item = t("productRequired");
    if (!name.trim()) next.name = t("nameRequired");
    if (!QTY_PATTERN.test(plainNumber(batch)) || isZero(plainNumber(batch))) next.batch = tCommon("qtyPlaceholder");
    const used = materials.filter((m) => m.itemId || m.quantity);
    used.forEach((m, i) => {
      if (!m.itemId) next[`m${i}`] = tCommon("selectItem");
      else if (!PER_BATCH.test(plainNumber(m.quantity)) || isZero(plainNumber(m.quantity)))
        next[`m${i}`] = tCommon("qtyPlaceholder");
    });
    operations.forEach((o, i) => {
      if (!o.name.trim()) next[`o${i}`] = t("stepRequired");
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    const body: Schemas["ErpSaveRecipeDto"] = {
      itemId,
      name: name.trim(),
      batchQty: plainNumber(batch),
      note: note.trim() || null,
      materials: used.map((m) => ({
        itemId: m.itemId,
        quantity: plainNumber(m.quantity),
        ...(m.scrap ? { scrapPct: plainNumber(m.scrap) } : {}),
      })),
      operations: operations.map((o) => ({
        name: o.name.trim(),
        machineId: o.machineId || null,
        setupMinutes: o.setup ? Number.parseInt(o.setup, 10) : 0,
        runRatePerHour: o.rate ? plainNumber(o.rate) : null,
      })),
    };
    const saved = await call(
      async () =>
        recipe
          ? (
              await browserApi().PUT("/v1/partner/factories/{factoryId}/erp/recipes/{recipeId}", {
                params: { path: { factoryId, recipeId: recipe.id }, header: { "If-Match": etag ?? "" } },
                body,
              })
            ).data
          : (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/recipes", {
                params: { path: { factoryId } },
                body,
              })
            ).data,
      t("saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/planning/recipes/${saved.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <FormColumns
        aside={
          <FormSummary
            title={tSections("summary")}
            action={
              <Button type="submit" size="xl" loading={busy} iconStart="save">
                {t("save")}
              </Button>
            }
          >
            <SummaryRows
              rows={[
                { key: "product", label: t("product"), value: product?.name ?? "" },
                {
                  key: "batch",
                  label: t("batch"),
                  value: batch && product ? tCommon("inUnit", { qty: batch, unit: unit(product.baseUnit) }) : batch,
                },
                {
                  key: "materials",
                  label: t("materials"),
                  value: String(materials.filter((m) => m.itemId).length),
                },
                {
                  key: "operations",
                  label: t("operations"),
                  value: String(operations.filter((o) => o.name.trim()).length),
                },
              ]}
            />
          </FormSummary>
        }
      >
        <FormSection card step={1} title={tSections("item")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("product")} required requiredLabel={tCommon("required")} error={errors.item}>
              <Select
                value={itemId || null}
                placeholder={tCommon("selectItem")}
                onValueChange={setItemId}
                options={options()}
              />
            </Field>
            <Field label={t("name")} required requiredLabel={tCommon("required")} error={errors.name}>
              <Input
                value={name}
                placeholder={t("namePlaceholder")}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label={t("batch")} hint={t("batchHint")} error={errors.batch}>
              <NumberInput
                step="any"
                min={0}
                unit={product ? unit(product.baseUnit) : undefined}
                value={batch}
                onChange={(event) => setBatch(event.target.value)}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection card step={2} title={t("materials")} description={t("materialsHint")}>
          <ol className="flex flex-col gap-3">
            {materials.map((m, i) => {
              const item = byId.get(m.itemId);
              const set = (patch: Partial<Material>) =>
                setMaterials(materials.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <li
                  key={m.key}
                  className="border-border bg-surface-subtle grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
                >
                  <Field label={tCommon("item")} error={errors[`m${i}`]}>
                    <Select
                      value={m.itemId || null}
                      placeholder={tCommon("selectItem")}
                      onValueChange={(itemId) => set({ itemId })}
                      options={options(itemId)}
                    />
                  </Field>
                  <Field label={t("perBatch")}>
                    <NumberInput
                      step="any"
                      min={0}
                      unit={item ? unit(item.baseUnit) : undefined}
                      value={m.quantity}
                      onChange={(event) => set({ quantity: event.target.value })}
                    />
                  </Field>
                  <Field label={t("scrap")}>
                    <NumberInput
                      step="any"
                      min={0}
                      max={99}
                      unit="%"
                      value={m.scrap}

                      onChange={(event) => set({ scrap: event.target.value })}
                    />
                  </Field>
                  <IconButton
                    name="trash"
                    label={tCommon("removeLine", { n: i + 1 })}
                    onClick={() => setMaterials(materials.filter((_, j) => j !== i))}
                  />
                </li>
              );
            })}
          </ol>
          <Button
            variant="secondary"
            iconStart="plus"
            className="self-start"
            onClick={() => setMaterials([...materials, { key: k(), itemId: "", quantity: "", scrap: "" }])}
          >
            {t("addMaterial")}
          </Button>
        </FormSection>

        <FormSection card step={3} title={t("operations")} description={t("operationsHint")}>
          <ol className="flex flex-col gap-3">
            {operations.map((o, i) => {
              const set = (patch: Partial<Operation>) =>
                setOperations(operations.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <li
                  key={o.key}
                  className="border-border bg-surface-subtle grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
                >
                  <Field label={t("step", { n: i + 1 })} error={errors[`o${i}`]}>
                    <Input
                      value={o.name}
                      placeholder={t("stepPlaceholder")}
                      onChange={(event) => set({ name: event.target.value })}
                    />
                  </Field>
                  <Field label={t("machine")}>
                    <Select
                      value={o.machineId || NO_MACHINE}
                      onValueChange={(machineId) => set({ machineId: machineId === NO_MACHINE ? "" : machineId })}
                      options={[
                        { value: NO_MACHINE, label: t("noMachine") },
                        ...machines.map((m) => ({ value: m.id, label: m.name })),
                      ]}
                    />
                  </Field>
                  <Field label={t("setup")}>
                    <NumberInput
                      step={1}
                      min={0}
                      unit={t("minutes")}
                      value={o.setup}
                      onChange={(event) => set({ setup: event.target.value })}
                    />
                  </Field>
                  <Field label={t("rate")}>
                    <NumberInput
                      step="any"
                      min={0}
                      unit={t("perHour")}
                      value={o.rate}
                      onChange={(event) => set({ rate: event.target.value })}
                    />
                  </Field>
                  <IconButton
                    name="trash"
                    label={tCommon("removeLine", { n: i + 1 })}
                    onClick={() => setOperations(operations.filter((_, j) => j !== i))}
                  />
                </li>
              );
            })}
          </ol>
          <Button
            variant="secondary"
            iconStart="plus"
            className="self-start"
            onClick={() => setOperations([...operations, { key: k(), name: "", machineId: "", setup: "", rate: "" }])}
          >
            {t("addStep")}
          </Button>
        </FormSection>

        <FormSection card step={4} title={t("note")}>
          <Field label={t("note")} labelHidden>
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormSection>
      </FormColumns>
    </form>
  );
}
