"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { useCan, useProductTypes } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { bangkokDay, useFactoryPart, useFactoryRefresh } from "../hooks";
import { CapabilityItemsDialog, EditCapabilityDialog, EditMachineDialog } from "../CapabilityDialogs";
import { FormDialog, Section } from "../parts";
import type { Factory } from "../resources";

type Capability = Schemas["CapabilityDto"];
type Week = Schemas["CapacityWeekDto"];
type Zone = Schemas["DeliveryZoneDto"];
type Machine = Schemas["MachineDto"];

/**
 * What the factory can make and how much (D-101): capability per product type with its order and
 * sheet limits, the machines behind it, the weekly capacity with what is booked, and the delivery
 * zones it serves with their extra lead days.
 */
export function Operations({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.operations");
  const format = useFormat();
  const canManage = useCan("partners.manage");
  const refresh = useFactoryRefresh(factory.id);
  const productTypes = useProductTypes();
  const capabilities = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/capabilities");
  const machines = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/machines");
  const zones = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/delivery-zones");
  const [typeId, setTypeId] = useState<string | null>(null);
  const chosen = typeId ?? capabilities.data?.[0]?.productTypeId ?? null;
  const weeks = useFactoryPart(
    factory.id,
    "/v1/admin/factories/{factoryId}/capacity",
    chosen ? { productTypeId: chosen, weeks: 8 } : undefined,
    { enabled: Boolean(chosen) },
  );
  const [open, setOpen] = useState<"capability" | "machine" | "capacity" | "override" | null>(null);
  const [draftZones, setDraftZones] = useState<Zone[] | null>(null);
  const [editing, setEditing] = useState<
    { kind: "capability" | "items"; capability: Capability } | { kind: "machine"; machine: Machine } | null
  >(null);
  const [capability, setCapability] = useState({
    productTypeId: "",
    minOrderQty: "",
    maxOrderQty: "",
    maxSheetWidthMm: "",
    maxSheetLengthMm: "",
  });
  const [machine, setMachine] = useState({ name: "", maxWidthMm: "", maxLengthMm: "", details: "" });
  const [capacity, setCapacity] = useState({
    weeklyCapacity: "",
    capacityUnit: "sheets" as Schemas["CapacityUnit"],
    effectiveFrom: "",
    reason: "",
  });
  const [override, setOverride] = useState({ weekStart: "", capacity: "", reason: "" });

  const num = (value: string) => (value.trim() === "" ? null : Number(value));
  // Named from the catalogue when this role may read it (`catalog.read`), else by the type's code.
  const typeName = (id: string) => {
    const code =
      productTypes.types.find((type) => type.id === id)?.code ??
      capabilities.data?.find((item) => item.productTypeId === id)?.productTypeCode ??
      id;
    return productTypes.options.find((option) => option.value === code)?.label ?? code;
  };

  const capabilityColumns: DataTableColumn<Capability>[] = [
    {
      id: "type",
      header: t("productType"),
      cell: (row) => <span className="font-medium">{typeName(row.productTypeId)}</span>,
    },
    {
      id: "qty",
      header: t("orderQty"),
      cell: (row) =>
        t("range", {
          min: row.minOrderQty === null ? "–" : format.number(row.minOrderQty),
          max: row.maxOrderQty === null ? "–" : format.number(row.maxOrderQty),
        }),
    },
    {
      id: "sheet",
      header: t("maxSheet"),
      cell: (row) =>
        row.maxSheetWidthMm && row.maxSheetLengthMm
          ? t("sheet", { width: row.maxSheetWidthMm, length: row.maxSheetLengthMm })
          : "–",
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <Badge size="sm" tone={row.status === "active" ? "success" : "neutral"}>
          {t(`capabilityStatus.${row.status}`)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: "items", capability: row })}>
            {t("itemsButton")}
          </Button>
          {canManage ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "capability", capability: row })}>
              {t("edit")}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const weekColumns: DataTableColumn<Week>[] = [
    { id: "weekStart", header: t("week"), cell: (row) => format.date(row.weekStart) },
    { id: "capacity", header: t("capacity"), numeric: true, cell: (row) => format.number(Number(row.capacity)) },
    { id: "booked", header: t("booked"), numeric: true, cell: (row) => format.number(Number(row.booked)) },
    {
      id: "free",
      header: t("free"),
      numeric: true,
      cell: (row) => (
        <span className={Number(row.free) <= 0 ? "text-danger font-medium" : undefined}>
          {format.number(Number(row.free))}
        </span>
      ),
    },
    {
      id: "source",
      header: t("source"),
      cell: (row) =>
        row.source === "override" ? (
          <Badge size="sm" tone="warning">
            {t("override")}
          </Badge>
        ) : (
          t("fromVersion")
        ),
    },
  ];

  const shownZones = draftZones ?? zones.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("capabilities")}
        actions={
          canManage ? (
            <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setOpen("capability")}>
              {t("addCapability")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("capabilities")}
          columns={capabilityColumns}
          rows={capabilities.data ?? []}
          getRowId={(row) => row.id}
          loading={capabilities.isPending}
          density="compact"
        />
      </Section>

      <Section
        title={t("machines")}
        actions={
          canManage ? (
            <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setOpen("machine")}>
              {t("addMachine")}
            </Button>
          ) : null
        }
      >
        <ul className="divide-border divide-y text-sm">
          {(machines.data ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium">{item.name}</span>
              {item.maxWidthMm && item.maxLengthMm ? (
                <span className="text-muted">{t("sheet", { width: item.maxWidthMm, length: item.maxLengthMm })}</span>
              ) : null}
              {item.details ? <span className="text-muted">· {item.details}</span> : null}
              {item.status === "inactive" ? (
                <Badge size="sm" tone="neutral">
                  {t("capabilityStatus.inactive")}
                </Badge>
              ) : null}
              {canManage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => setEditing({ kind: "machine", machine: item })}
                >
                  {t("edit")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={t("capacityTitle")}
        actions={
          canManage && chosen ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen("override")}>
                {t("overrideWeek")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setOpen("capacity")}>
                {t("newCapacity")}
              </Button>
            </div>
          ) : null
        }
      >
        {(capabilities.data ?? []).length > 1 ? (
          <div className="mb-3 max-w-xs">
            <Field label={t("productType")}>
              <Select
                value={chosen ?? undefined}
                onValueChange={setTypeId}
                options={(capabilities.data ?? []).map((item) => ({
                  value: item.productTypeId,
                  label: typeName(item.productTypeId),
                }))}
              />
            </Field>
          </div>
        ) : null}
        <DataTable
          caption={t("capacityTitle")}
          columns={weekColumns}
          rows={weeks.data ?? []}
          getRowId={(row) => row.weekStart}
          loading={weeks.isPending && Boolean(chosen)}
          density="compact"
          empty={<p className="text-muted p-3 text-sm">{t("noCapacity")}</p>}
        />
      </Section>

      <Section
        title={t("zones")}
        description={t("zonesNote")}
        actions={
          canManage && draftZones ? (
            <Button
              size="sm"
              iconStart="save"
              onClick={async () => {
                try {
                  await adminBrowserApis().contract.PUT("/v1/admin/factories/{factoryId}/delivery-zones", {
                    params: { path: { factoryId: factory.id } },
                    body: {
                      zones: draftZones.map(({ zoneId, serves, extraLeadDays }) => ({ zoneId, serves, extraLeadDays })),
                    },
                  });
                  toast.success(t("zonesSaved"));
                  setDraftZones(null);
                  refresh();
                } catch {
                  toast.error(t("zonesFailed"));
                }
              }}
            >
              {t("saveZones")}
            </Button>
          ) : null
        }
      >
        <ul className="divide-border divide-y">
          {shownZones.map((zone) => (
            <li key={zone.zoneId} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <Switch
                label={t("serves", { zone: zone.zoneCode })}
                checked={zone.serves}
                disabled={!canManage}
                onCheckedChange={(serves) =>
                  setDraftZones(shownZones.map((item) => (item.zoneId === zone.zoneId ? { ...item, serves } : item)))
                }
              />
              <div className="w-40">
                <Field label={t("extraDays", { zone: zone.zoneCode })} labelHidden>
                  <NumberInput
                    unit={t("days")}
                    min={0}
                    disabled={!canManage || !zone.serves}
                    value={String(zone.extraLeadDays)}
                    onChange={(event) =>
                      setDraftZones(
                        shownZones.map((item) =>
                          item.zoneId === zone.zoneId
                            ? { ...item, extraLeadDays: Number(event.target.value) || 0 }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {editing?.kind === "capability" ? (
        <EditCapabilityDialog
          factoryId={factory.id}
          capability={editing.capability}
          typeName={typeName(editing.capability.productTypeId)}
          onClose={() => setEditing(null)}
          onDone={() => {
            toast.success(t("saved"));
            refresh();
          }}
        />
      ) : null}
      {editing?.kind === "items" ? (
        <CapabilityItemsDialog
          factoryId={factory.id}
          capability={editing.capability}
          typeName={typeName(editing.capability.productTypeId)}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onDone={() => {
            toast.success(t("saved"));
            refresh();
          }}
        />
      ) : null}
      {editing?.kind === "machine" ? (
        <EditMachineDialog
          factoryId={factory.id}
          machine={editing.machine}
          onClose={() => setEditing(null)}
          onDone={() => {
            toast.success(t("saved"));
            refresh();
          }}
        />
      ) : null}

      {open === "capability" ? (
        <FormDialog
          title={t("addCapability")}
          submitLabel={t("save")}
          onClose={() => setOpen(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/capabilities", {
              params: { path: { factoryId: factory.id } },
              body: {
                productTypeId: capability.productTypeId,
                minOrderQty: num(capability.minOrderQty),
                maxOrderQty: num(capability.maxOrderQty),
                maxSheetWidthMm: num(capability.maxSheetWidthMm),
                maxSheetLengthMm: num(capability.maxSheetLengthMm),
                status: "active",
              },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("productType")} required>
            <Select
              value={capability.productTypeId || undefined}
              onValueChange={(productTypeId) => setCapability({ ...capability, productTypeId })}
              placeholder={t("choose")}
              options={productTypes.options.map((option) => ({
                value: productTypes.types.find((type) => type.code === option.value)?.id ?? option.value,
                label: option.label,
              }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("minQty")}>
              <NumberInput
                value={capability.minOrderQty}
                onChange={(event) => setCapability({ ...capability, minOrderQty: event.target.value })}
              />
            </Field>
            <Field label={t("maxQty")}>
              <NumberInput
                value={capability.maxOrderQty}
                onChange={(event) => setCapability({ ...capability, maxOrderQty: event.target.value })}
              />
            </Field>
            <Field label={t("sheetWidth")}>
              <NumberInput
                unit={t("mm")}
                value={capability.maxSheetWidthMm}
                onChange={(event) => setCapability({ ...capability, maxSheetWidthMm: event.target.value })}
              />
            </Field>
            <Field label={t("sheetLength")}>
              <NumberInput
                unit={t("mm")}
                value={capability.maxSheetLengthMm}
                onChange={(event) => setCapability({ ...capability, maxSheetLengthMm: event.target.value })}
              />
            </Field>
          </div>
        </FormDialog>
      ) : null}

      {open === "machine" ? (
        <FormDialog
          title={t("addMachine")}
          submitLabel={t("save")}
          onClose={() => setOpen(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/machines", {
              params: { path: { factoryId: factory.id } },
              body: {
                name: machine.name,
                maxWidthMm: num(machine.maxWidthMm),
                maxLengthMm: num(machine.maxLengthMm),
                details: machine.details.trim() || null,
                printTypeId: null,
                status: "active",
              },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("machineName")} required>
            <Input value={machine.name} onChange={(event) => setMachine({ ...machine, name: event.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("sheetWidth")}>
              <NumberInput
                unit={t("mm")}
                value={machine.maxWidthMm}
                onChange={(event) => setMachine({ ...machine, maxWidthMm: event.target.value })}
              />
            </Field>
            <Field label={t("sheetLength")}>
              <NumberInput
                unit={t("mm")}
                value={machine.maxLengthMm}
                onChange={(event) => setMachine({ ...machine, maxLengthMm: event.target.value })}
              />
            </Field>
          </div>
          <Field label={t("details")}>
            <Textarea
              rows={2}
              value={machine.details}
              onChange={(event) => setMachine({ ...machine, details: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}

      {open === "capacity" && chosen ? (
        <FormDialog
          title={t("newCapacity")}
          description={t("capacityBody", { type: typeName(chosen), code: factory.code })}
          submitLabel={t("save")}
          onClose={() => setOpen(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/capacity-versions", {
              params: { path: { factoryId: factory.id } },
              body: {
                productTypeId: chosen,
                weeklyCapacity: Number(capacity.weeklyCapacity),
                capacityUnit: capacity.capacityUnit,
                ...(capacity.effectiveFrom ? { effectiveFrom: bangkokDay(capacity.effectiveFrom) } : {}),
                reason: capacity.reason,
              },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("weeklyCapacity")} required>
              <NumberInput
                value={capacity.weeklyCapacity}
                onChange={(event) => setCapacity({ ...capacity, weeklyCapacity: event.target.value })}
              />
            </Field>
            <Field label={t("unit")}>
              <Select
                value={capacity.capacityUnit}
                onValueChange={(value) => setCapacity({ ...capacity, capacityUnit: value as Schemas["CapacityUnit"] })}
                options={(["sheets", "pieces", "sqm", "jobs"] as const).map((value) => ({
                  value,
                  label: t(`units.${value}`),
                }))}
              />
            </Field>
          </div>
          <Field label={t("effectiveFrom")} hint={t("effectiveHint")}>
            <Input
              type="date"
              value={capacity.effectiveFrom}
              onChange={(event) => setCapacity({ ...capacity, effectiveFrom: event.target.value })}
            />
          </Field>
          <Field label={t("reason")} required>
            <Textarea
              rows={2}
              value={capacity.reason}
              onChange={(event) => setCapacity({ ...capacity, reason: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}

      {open === "override" && chosen ? (
        <FormDialog
          title={t("overrideWeek")}
          description={t("overrideBody", { type: typeName(chosen) })}
          submitLabel={t("save")}
          onClose={() => setOpen(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.PUT("/v1/admin/factories/{factoryId}/capacity-overrides", {
              params: { path: { factoryId: factory.id } },
              body: {
                productTypeId: chosen,
                weekStart: override.weekStart,
                capacity: Number(override.capacity),
                reason: override.reason,
              },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("week")} required>
            <Select
              value={override.weekStart || undefined}
              onValueChange={(weekStart) => setOverride({ ...override, weekStart })}
              placeholder={t("choose")}
              options={(weeks.data ?? []).map((row) => ({ value: row.weekStart, label: format.date(row.weekStart) }))}
            />
          </Field>
          <Field label={t("capacity")} required>
            <NumberInput
              value={override.capacity}
              onChange={(event) => setOverride({ ...override, capacity: event.target.value })}
            />
          </Field>
          <Field label={t("reason")} required>
            <Textarea
              rows={2}
              value={override.reason}
              onChange={(event) => setOverride({ ...override, reason: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
