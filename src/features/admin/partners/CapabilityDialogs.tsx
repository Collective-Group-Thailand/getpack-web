"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SearchInput } from "@/ui/components/SearchInput";
import { Select } from "@/ui/components/Select";

import { adminBrowserApis, FormDialog, FormError } from "../console";
import { useRefs } from "../catalogue/useRefs";

type Capability = Schemas["CapabilityDto"];
type Machine = Schemas["MachineDto"];
type Kind = Schemas["OfferableOptionKind"];
type Status = Schemas["CapabilityStatus"];

/** The catalogue table each kind of item is chosen from (a coating is a finish, D-043). */
const KIND_TABLE: Record<Kind, string> = {
  material: "materials",
  finish: "finishes",
  coating: "finishes",
  ink_colour: "ink-colours",
  diecut: "diecut-types",
  assembly: "assemblies",
  print_type: "print-types",
  pattern: "patterns",
};
const KINDS = Object.keys(KIND_TABLE) as Kind[];

const num = (value: string) => (value.trim() === "" ? null : Number(value));
const text = (value: number | null) => (value === null ? "" : String(value));

/** A capability's limits and status (D-043): deactivating it stops routing the type to the factory. */
export function EditCapabilityDialog({
  factoryId,
  capability,
  typeName,
  onClose,
  onDone,
}: {
  factoryId: string;
  capability: Capability;
  typeName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("partners.operations");
  const [draft, setDraft] = useState({
    minOrderQty: text(capability.minOrderQty),
    maxOrderQty: text(capability.maxOrderQty),
    maxSheetWidthMm: text(capability.maxSheetWidthMm),
    maxSheetLengthMm: text(capability.maxSheetLengthMm),
    status: capability.status,
  });
  return (
    <FormDialog
      title={t("editCapability", { type: typeName })}
      description={t("editCapabilityIntro")}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        const min = num(draft.minOrderQty);
        const max = num(draft.maxOrderQty);
        if (min !== null && max !== null && max < min) throw new FormError(t("qtyOrder"));
        await adminBrowserApis().contract.PATCH("/v1/admin/factories/{factoryId}/capabilities/{capabilityId}", {
          params: { path: { factoryId, capabilityId: capability.id } },
          body: {
            minOrderQty: min,
            maxOrderQty: max,
            maxSheetWidthMm: num(draft.maxSheetWidthMm),
            maxSheetLengthMm: num(draft.maxSheetLengthMm),
            status: draft.status,
          },
        });
        onDone();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("minQty")}>
          <NumberInput
            min={0}
            value={draft.minOrderQty}
            onChange={(e) => setDraft({ ...draft, minOrderQty: e.target.value })}
          />
        </Field>
        <Field label={t("maxQty")}>
          <NumberInput
            min={0}
            value={draft.maxOrderQty}
            onChange={(e) => setDraft({ ...draft, maxOrderQty: e.target.value })}
          />
        </Field>
        <Field label={t("sheetWidth")}>
          <NumberInput
            unit="mm"
            min={0}
            value={draft.maxSheetWidthMm}
            onChange={(e) => setDraft({ ...draft, maxSheetWidthMm: e.target.value })}
          />
        </Field>
        <Field label={t("sheetLength")}>
          <NumberInput
            unit="mm"
            min={0}
            value={draft.maxSheetLengthMm}
            onChange={(e) => setDraft({ ...draft, maxSheetLengthMm: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("status")} hint={t("statusHint")}>
        <Select
          value={draft.status}
          onValueChange={(status) => setDraft({ ...draft, status: status as Status })}
          options={(["active", "inactive"] as const).map((value) => ({ value, label: t(`capabilityStatus.${value}`) }))}
        />
      </Field>
    </FormDialog>
  );
}

/**
 * What a factory can make for one product type (D-011, D-043): its materials, finishes and
 * coatings, ink colours, die-cuts, assemblies, print types and patterns, chosen from the
 * catalogue. The whole list is replaced on save; the API checks each item against the catalogue.
 */
export function CapabilityItemsDialog({
  factoryId,
  capability,
  typeName,
  canManage,
  onClose,
  onDone,
}: {
  factoryId: string;
  capability: Capability;
  typeName: string;
  canManage: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("partners.operations.items");
  const refs = useRefs(Object.values(KIND_TABLE));
  const [kind, setKind] = useState<Kind>("material");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Record<Kind, Set<string>> | null>(null);
  const current = useQuery({
    queryKey: queryKeys.related("admin", "factory", factoryId, `capability-items:${capability.productTypeId}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/factories/{factoryId}/capability-items/{productTypeId}", {
          params: { path: { factoryId, productTypeId: capability.productTypeId } },
        })
      ).data!,
  });
  const selection: Record<Kind, Set<string>> = chosen ??
  (Object.fromEntries(
    KINDS.map((k) => [
      k,
      new Set((current.data?.items ?? []).filter((item) => item.kind === k).map((item) => item.itemId)),
    ]),
  ) as Record<Kind, Set<string>>);
  const options = (refs.options[KIND_TABLE[kind]] ?? []).filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const toggle = (id: string, on: boolean) => {
    const next = Object.fromEntries(KINDS.map((k) => [k, new Set(selection[k])])) as Record<Kind, Set<string>>;
    if (on) next[kind].add(id);
    else next[kind].delete(id);
    setChosen(next);
  };
  const total = KINDS.reduce((sum, k) => sum + selection[k].size, 0);
  return (
    <FormDialog
      size="lg"
      title={t("title", { type: typeName })}
      description={t("intro")}
      submitLabel={canManage ? t("save", { count: total }) : t("close")}
      onClose={onClose}
      onSubmit={async () => {
        if (!canManage) return;
        if (current.isPending) throw new FormError(t("loading"));
        await adminBrowserApis().contract.PUT("/v1/admin/factories/{factoryId}/capability-items/{productTypeId}", {
          params: { path: { factoryId, productTypeId: capability.productTypeId } },
          body: { items: KINDS.flatMap((k) => [...selection[k]].map((itemId) => ({ kind: k, itemId }))) },
        });
        onDone();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("kind")} className="w-56">
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as Kind);
              setSearch("");
            }}
            options={KINDS.map((k) => ({
              value: k,
              label: t("kindCount", { kind: t(`kinds.${k}`), count: selection[k].size }),
            }))}
          />
        </Field>
        <Field label={t("search")} className="min-w-48 flex-1">
          <SearchInput value={search} onValueChange={setSearch} clearLabel={t("clear")} />
        </Field>
      </div>
      <div className="border-border max-h-80 overflow-y-auto rounded-md border p-2">
        {options.length ? (
          <div className="grid gap-1 sm:grid-cols-2">
            {options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                disabled={!canManage}
                checked={selection[kind].has(option.value)}
                onCheckedChange={(on) => toggle(option.value, on === true)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted p-2 text-sm">{t("none")}</p>
        )}
      </div>
    </FormDialog>
  );
}

/** A machine's name, sheet size, details and status (D-011). */
export function EditMachineDialog({
  factoryId,
  machine,
  onClose,
  onDone,
}: {
  factoryId: string;
  machine: Machine;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("partners.operations");
  const [draft, setDraft] = useState({
    name: machine.name,
    maxWidthMm: text(machine.maxWidthMm),
    maxLengthMm: text(machine.maxLengthMm),
    details: machine.details ?? "",
    status: machine.status,
  });
  return (
    <FormDialog
      title={t("editMachine", { name: machine.name })}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        if (draft.name.trim().length < 2) throw new FormError(t("machineName"));
        await adminBrowserApis().contract.PATCH("/v1/admin/factories/{factoryId}/machines/{machineId}", {
          params: { path: { factoryId, machineId: machine.id } },
          body: {
            name: draft.name.trim(),
            maxWidthMm: num(draft.maxWidthMm),
            maxLengthMm: num(draft.maxLengthMm),
            details: draft.details.trim() || null,
            status: draft.status,
          },
        });
        onDone();
      }}
    >
      <Field label={t("machineName")} required>
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("sheetWidth")}>
          <NumberInput
            unit="mm"
            min={0}
            value={draft.maxWidthMm}
            onChange={(e) => setDraft({ ...draft, maxWidthMm: e.target.value })}
          />
        </Field>
        <Field label={t("sheetLength")}>
          <NumberInput
            unit="mm"
            min={0}
            value={draft.maxLengthMm}
            onChange={(e) => setDraft({ ...draft, maxLengthMm: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("details")}>
        <Textarea rows={2} value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} />
      </Field>
      <Field label={t("status")}>
        <Select
          value={draft.status}
          onValueChange={(status) => setDraft({ ...draft, status: status as Status })}
          options={(["active", "inactive"] as const).map((value) => ({ value, label: t(`capabilityStatus.${value}`) }))}
        />
      </Field>
    </FormDialog>
  );
}
