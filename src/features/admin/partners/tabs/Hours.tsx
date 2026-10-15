"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, useCan } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { useFactoryPart, useFactoryRefresh } from "../hooks";
import { FormDialog, FormError, Section } from "../parts";
import type { Factory } from "../resources";

type Hours = Schemas["WeeklyHoursDto"];
type Version = Schemas["FactoryHoursVersionDto"];
type Day = Schemas["CalendarDayDto"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT: Hours = {
  mon: { from: "08:00", to: "17:00" },
  tue: { from: "08:00", to: "17:00" },
  wed: { from: "08:00", to: "17:00" },
  thu: { from: "08:00", to: "17:00" },
  fri: { from: "08:00", to: "17:00" },
  sat: null,
  sun: null,
};

/** A Bangkok day `offset` days from today, `YYYY-MM-DD`. */
const bangkokDay = (offset: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + offset * 86_400_000));

/**
 * A factory's working time (D-292, D-209): its weekly hours — effective-dated, from tomorrow at the
 * earliest, replacing the platform weekend and business hours for its SLAs and promised dates —
 * and its own closures on top of the national holidays. Due dates already computed never move.
 */
export function FactoryHours({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.hours");
  const format = useFormat();
  const canManage = useCan("partners.manage");
  const refresh = useFactoryRefresh(factory.id);
  const versions = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/business-hours");
  const closures = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/closures");
  const [editing, setEditing] = useState<{ hours: Hours; from: string } | null>(null);
  const [closing, setClosing] = useState<{ day: string; nameTh: string; nameEn: string } | null>(null);
  const [reopening, setReopening] = useState<Day | null>(null);
  const inForce = (versions.data ?? []).find((v) => v.inForce) ?? null;
  const dayName = (d: (typeof DAYS)[number]) => t(`days.${d}`);
  const windowOf = (hours: Hours, d: (typeof DAYS)[number]) =>
    hours[d] ? t("window", { from: hours[d]!.from, to: hours[d]!.to }) : t("closed");

  const columns: DataTableColumn<Version>[] = [
    {
      id: "from",
      header: t("effectiveFrom"),
      cell: (row) => (
        <span className="flex items-center gap-2">
          {format.date(`${row.effectiveFrom}T00:00:00+07:00`)}
          {row.inForce ? (
            <Badge size="sm" tone="success">
              {t("inForce")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    ...DAYS.map((d): DataTableColumn<Version> => ({
      id: d,
      header: dayName(d),
      cell: (row) => <span className={row.hours[d] ? "tabular-nums" : "text-muted"}>{windowOf(row.hours, d)}</span>,
    })),
  ];
  const closureColumns: DataTableColumn<Day>[] = [
    { id: "day", header: t("day"), cell: (row) => format.date(`${row.day}T00:00:00+07:00`) },
    { id: "name", header: t("name"), cell: (row) => row.nameTh },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Day) =>
              row.day > bangkokDay(0) ? (
                <Button size="sm" variant="ghost" onClick={() => setReopening(row)}>
                  {t("reopen")}
                </Button>
              ) : null,
          } satisfies DataTableColumn<Day>,
        ]
      : []),
  ];
  const valid = (hours: Hours) =>
    DAYS.every(
      (d) => !hours[d] || (TIME.test(hours[d]!.from) && TIME.test(hours[d]!.to) && hours[d]!.from < hours[d]!.to),
    );

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("title")}
        description={inForce ? t("intro") : t("platformDefault")}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="edit"
              onClick={() => setEditing({ hours: inForce?.hours ?? DEFAULT, from: bangkokDay(1) })}
            >
              {t("set")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={versions.data ?? []}
          getRowId={(row) => row.id}
          loading={versions.isPending}
          density="compact"
          empty={<p className="text-muted p-3 text-sm">{t("none")}</p>}
        />
      </Section>

      <Section
        title={t("closures")}
        description={t("closuresIntro")}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="plus"
              onClick={() => setClosing({ day: bangkokDay(1), nameTh: "", nameEn: "" })}
            >
              {t("close")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("closures")}
          columns={closureColumns}
          rows={closures.data ?? []}
          getRowId={(row) => row.day}
          loading={closures.isPending}
          density="compact"
          empty={<p className="text-muted p-3 text-sm">{t("noClosures")}</p>}
        />
      </Section>

      {editing ? (
        <FormDialog
          size="lg"
          title={t("setTitle", { code: factory.code })}
          description={t("setIntro")}
          submitLabel={t("save")}
          onClose={() => setEditing(null)}
          onSubmit={async () => {
            if (!valid(editing.hours)) throw new FormError(t("invalid"));
            if (editing.from < bangkokDay(1)) throw new FormError(t("fromTomorrow"));
            await adminBrowserApis().contract.PUT("/v1/admin/factories/{factoryId}/business-hours", {
              params: { path: { factoryId: factory.id } },
              body: { effectiveFrom: editing.from, hours: editing.hours },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("effectiveFrom")} hint={t("fromHint")} className="w-48">
            <Input
              type="date"
              min={bangkokDay(1)}
              value={editing.from}
              onChange={(e) => setEditing({ ...editing, from: e.target.value })}
            />
          </Field>
          <ul className="flex flex-col gap-2">
            {DAYS.map((d) => {
              const day = editing.hours[d];
              const set = (next: Hours[typeof d]) => setEditing({ ...editing, hours: { ...editing.hours, [d]: next } });
              return (
                <li key={d} className="flex flex-wrap items-center gap-3">
                  <span className="w-24">
                    <Checkbox
                      label={dayName(d)}
                      checked={Boolean(day)}
                      onCheckedChange={(on) => set(on ? { from: "08:00", to: "17:00" } : null)}
                    />
                  </span>
                  {day ? (
                    <>
                      <Input
                        type="time"
                        aria-label={t("fromTime", { day: dayName(d) })}
                        className="w-32"
                        value={day.from}
                        onChange={(e) => set({ ...day, from: e.target.value })}
                      />
                      <Input
                        type="time"
                        aria-label={t("toTime", { day: dayName(d) })}
                        className="w-32"
                        value={day.to}
                        onChange={(e) => set({ ...day, to: e.target.value })}
                      />
                    </>
                  ) : (
                    <span className="text-muted text-sm">{t("closed")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </FormDialog>
      ) : null}

      {closing ? (
        <FormDialog
          title={t("closeTitle", { code: factory.code })}
          description={t("closeIntro")}
          submitLabel={t("close")}
          onClose={() => setClosing(null)}
          onSubmit={async () => {
            if (closing.day < bangkokDay(1)) throw new FormError(t("fromTomorrow"));
            if (closing.nameTh.trim().length < 2) throw new FormError(t("nameRequired"));
            await adminBrowserApis().contract.PUT("/v1/admin/factories/{factoryId}/closures/{day}", {
              params: { path: { factoryId: factory.id, day: closing.day } },
              body: { nameTh: closing.nameTh.trim(), nameEn: closing.nameEn.trim() || null },
            });
            toast.success(t("closedSaved"));
            refresh();
          }}
        >
          <Field label={t("day")} required className="w-48">
            <Input
              type="date"
              min={bangkokDay(1)}
              value={closing.day}
              onChange={(e) => setClosing({ ...closing, day: e.target.value })}
            />
          </Field>
          <Field label={t("nameTh")} hint={t("nameHint")} required>
            <Input value={closing.nameTh} onChange={(e) => setClosing({ ...closing, nameTh: e.target.value })} />
          </Field>
          <Field label={t("nameEn")}>
            <Input value={closing.nameEn} onChange={(e) => setClosing({ ...closing, nameEn: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}

      {reopening ? (
        <ConfirmAction
          open
          onOpenChange={(open) => !open && setReopening(null)}
          title={t("reopenTitle", { day: format.date(`${reopening.day}T00:00:00+07:00`) })}
          description={t("reopenBody")}
          confirmLabel={t("reopen")}
          onConfirm={async () => {
            try {
              await adminBrowserApis().contract.DELETE("/v1/admin/factories/{factoryId}/closures/{day}", {
                params: { path: { factoryId: factory.id, day: reopening.day } },
              });
              toast.success(t("reopened"));
              refresh();
              setReopening(null);
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
