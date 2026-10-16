"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { Select } from "@/features/partner/select";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";

import { useErpCall } from "./call";
import { isZero, plainNumber, QTY_PATTERN } from "./format";

type Mo = Schemas["ErpProductionOrderDto"];
type Item = Pick<Schemas["ErpItemDto"], "id" | "sku" | "name" | "baseUnit">;
type Machine = { id: string; name: string };

type MaterialRow = { key: string; itemId: string; requiredQty: string; note: string };
type OperationRow = { key: string; name: string; machineId: string; plannedMinutes: string };
let seq = 0;
const key = () => `row-${++seq}`;
const NONE = "-";

/**
 * Change a production order (D-340): its title, dates, priority and note at any time while it is open; while it is
 * still planned also the quantity, the materials and the steps (a getpack job's steps follow the job and stay).
 */
export function MoEditForm({ order, etag, items, machines }: { order: Mo; etag: string | null; items: Item[]; machines: Machine[] }) {
  const t = useTranslations("partnerFactory.orders.edit");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { call, busy } = useErpCall();
  const planned = order.status === "planned";
  const getpack = order.source === "getpack_job";
  const [title, setTitle] = useState(order.title);
  const [quantity, setQuantity] = useState(String(Number(order.quantity)));
  const [dueOn, setDueOn] = useState(order.dueOn ?? "");
  const [startOn, setStartOn] = useState(order.plannedStartOn ?? "");
  const [priority, setPriority] = useState(String(order.priority));
  const [note, setNote] = useState(order.note ?? "");
  const [materials, setMaterials] = useState<MaterialRow[]>(() =>
    order.materials.map((m) => ({ key: key(), itemId: m.item.id, requiredQty: String(Number(m.requiredQty)), note: m.note ?? "" })),
  );
  const [operations, setOperations] = useState<OperationRow[]>(() =>
    order.operations.map((o) => ({ key: key(), name: o.name, machineId: o.machine?.id ?? "", plannedMinutes: String(o.plannedMinutes) })),
  );
  const [error, setError] = useState<string>();
  const itemOptions = items.map((i) => ({ value: i.id, label: i.name, description: i.sku }));
  const machineOptions = [{ value: NONE, label: t("anyMachine") }, ...machines.map((m) => ({ value: m.id, label: m.name }))];
  const setMaterial = (i: number, patch: Partial<MaterialRow>) => setMaterials(materials.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setOperation = (i: number, patch: Partial<OperationRow>) => setOperations(operations.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError(t("titleRequired"));
    if (planned && (!QTY_PATTERN.test(plainNumber(quantity)) || isZero(plainNumber(quantity)))) return setError(tCommon("qtyPlaceholder"));
    if (planned && materials.some((m) => !m.itemId || !QTY_PATTERN.test(plainNumber(m.requiredQty)) || isZero(plainNumber(m.requiredQty))))
      return setError(t("materialInvalid"));
    if (planned && !getpack && operations.some((o) => !o.name.trim() || !/^\d{1,6}$/.test(o.plannedMinutes))) return setError(t("operationInvalid"));
    setError(undefined);
    const saved = await call(
      async () =>
        (
          await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}", {
            params: { path: { factoryId, moId: order.id }, header: { "If-Match": etag ?? "" } },
            body: {
              title: title.trim(),
              dueOn: dueOn || null,
              plannedStartOn: startOn || null,
              priority: Math.min(9, Math.max(0, Number.parseInt(priority, 10) || 0)),
              note: note.trim() || null,
              ...(planned
                ? {
                    quantity: plainNumber(quantity),
                    materials: materials.map((m) => ({ itemId: m.itemId, requiredQty: plainNumber(m.requiredQty), note: m.note.trim() || null })),
                    ...(getpack
                      ? {}
                      : {
                          operations: operations.map((o) => ({
                            name: o.name.trim(),
                            machineId: o.machineId || null,
                            plannedMinutes: Number.parseInt(o.plannedMinutes, 10) || 0,
                          })),
                        }),
                  }
                : {}),
            },
          })
        ).data,
      t("saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/planning/orders/${order.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      {!planned ? <p className="text-muted text-sm">{t("releasedNote")}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("title")} required requiredLabel={tCommon("required")}>
          <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {planned ? (
          <Field label={t("quantity")} required requiredLabel={tCommon("required")}>
            <NumberInput step="any" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
        ) : null}
        <Field label={t("startOn")}>
          <Input type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} />
        </Field>
        <Field label={t("dueOn")}>
          <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </Field>
        <Field label={t("priority")} hint={t("priorityHint")}>
          <NumberInput min={0} max={9} step={1} value={priority} onChange={(e) => setPriority(e.target.value)} />
        </Field>
      </div>

      {planned ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t("materials")}</legend>
          <p className="text-muted text-sm">{t("materialsHint")}</p>
          {materials.map((m, i) => (
            <div key={m.key} className="border-border grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(14rem,2fr)_10rem_minmax(8rem,1fr)_auto] md:items-end">
              <Field label={tCommon("item")} labelHidden={i > 0}>
                <Select value={m.itemId || null} placeholder={tCommon("selectItem")} onValueChange={(v) => setMaterial(i, { itemId: v })} options={itemOptions} aria-label={tCommon("item")} />
              </Field>
              <Field label={t("requiredQty")} labelHidden={i > 0}>
                <Input inputMode="decimal" className="text-end" value={m.requiredQty} onChange={(e) => setMaterial(i, { requiredQty: e.target.value })} />
              </Field>
              <Field label={t("lineNote")} labelHidden={i > 0}>
                <Input value={m.note} maxLength={300} onChange={(e) => setMaterial(i, { note: e.target.value })} />
              </Field>
              <IconButton name="trash" label={t("removeMaterial")} variant="ghost" onClick={() => setMaterials(materials.filter((_, j) => j !== i))} />
            </div>
          ))}
          <Button variant="secondary" iconStart="plus" className="self-start" onClick={() => setMaterials([...materials, { key: key(), itemId: "", requiredQty: "", note: "" }])}>
            {t("addMaterial")}
          </Button>
        </fieldset>
      ) : null}

      {planned && !getpack ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t("operations")}</legend>
          {operations.map((o, i) => (
            <div key={o.key} className="border-border grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(12rem,2fr)_minmax(12rem,2fr)_9rem_auto] md:items-end">
              <Field label={t("operationName")} labelHidden={i > 0}>
                <Input value={o.name} maxLength={100} onChange={(e) => setOperation(i, { name: e.target.value })} />
              </Field>
              <Field label={t("machine")} labelHidden={i > 0}>
                <Select value={o.machineId || NONE} onValueChange={(v) => setOperation(i, { machineId: v === NONE ? "" : v })} options={machineOptions} aria-label={t("machine")} />
              </Field>
              <Field label={t("minutes")} labelHidden={i > 0}>
                <Input inputMode="numeric" className="text-end" value={o.plannedMinutes} onChange={(e) => setOperation(i, { plannedMinutes: e.target.value })} />
              </Field>
              <IconButton name="trash" label={t("removeOperation")} variant="ghost" onClick={() => setOperations(operations.filter((_, j) => j !== i))} />
            </div>
          ))}
          <Button variant="secondary" iconStart="plus" className="self-start" onClick={() => setOperations([...operations, { key: key(), name: "", machineId: "", plannedMinutes: "0" }])}>
            {t("addOperation")}
          </Button>
        </fieldset>
      ) : planned && getpack ? (
        <p className="text-muted text-sm">{t("getpackSteps")}</p>
      ) : null}

      <Field label={t("note")}>
        <Textarea rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="xl" iconStart="save" loading={busy} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
