"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useErpCall } from "@/features/partner/erp/call";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";

type Machine = Pick<Schemas["ErpMachineDto"], "id" | "name" | "details" | "maxWidthMm" | "maxLengthMm" | "status">;

const size = (value: string) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Add or edit a machine (D-355): the same record getpack reads in the capability profile, so a machine
 * added here is one the platform can route work to. Retiring keeps its history.
 */
export function MachineButton({ machine }: { machine?: Machine }) {
  const t = useTranslations("partnerOps.machines");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(machine?.name ?? "");
  const [details, setDetails] = useState(machine?.details ?? "");
  const [width, setWidth] = useState(machine?.maxWidthMm ? String(machine.maxWidthMm) : "");
  const [length, setLength] = useState(machine?.maxLengthMm ? String(machine.maxLengthMm) : "");
  const [active, setActive] = useState(machine ? machine.status === "active" : true);
  const [error, setError] = useState<string | undefined>();

  const save = async () => {
    if (name.trim().length < 2) {
      setError(t("nameRequired"));
      return;
    }
    const body = {
      name: name.trim(),
      details: details.trim() || null,
      maxWidthMm: size(width),
      maxLengthMm: size(length),
      status: active ? ("active" as const) : ("inactive" as const),
    };
    const ok = await call(
      () =>
        machine
          ? browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/machines/{machineId}", {
              params: { path: { factoryId, machineId: machine.id } },
              body,
            })
          : browserApi().POST("/v1/partner/factories/{factoryId}/erp/machines", {
              params: { path: { factoryId } },
              body,
            }),
      t("saved"),
    );
    if (ok) setOpen(false);
  };

  return (
    <>
      <Button
        variant={machine ? "secondary" : "primary"}
        size={machine ? "sm" : "md"}
        iconStart={machine ? "edit" : "plus"}
        onClick={() => setOpen(true)}
      >
        {machine ? t("edit") : t("add")}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={setOpen}
          title={machine ? machine.name : t("add")}
          closeLabel={tCommon("cancel")}
          footer={
            <Button iconStart="save" loading={busy} onClick={() => void save()}>
              {t("save")}
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label={t("name")} required error={error}>
              <Input
                value={name}
                maxLength={120}
                placeholder={t("namePlaceholder")}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(undefined);
                }}
              />
            </Field>
            <Field label={t("details")}>
              <Textarea rows={2} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("maxWidth")}>
                <NumberInput min={1} step={1} value={width} onChange={(event) => setWidth(event.target.value)} />
              </Field>
              <Field label={t("maxLength")}>
                <NumberInput min={1} step={1} value={length} onChange={(event) => setLength(event.target.value)} />
              </Field>
            </div>
            {machine ? (
              <Checkbox
                label={t("active")}
                checked={active}
                onCheckedChange={(checked) => setActive(checked === true)}
              />
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
