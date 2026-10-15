"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, FormDialog, FormError, problemMessage, QueryError, useCan } from "../console";

type Day = Schemas["CalendarDayDto"];
type Kind = Schemas["NationalDayKind"];
type Observance = Schemas["HolidayObservance"];
type Draft = { day: string; kind: Kind; observance: Observance; nameTh: string; nameEn: string; isNew: boolean };

const KINDS = ["holiday", "extra_working_day"] as const satisfies readonly Kind[];
const OBSERVANCES = ["all", "government_only", "financial_institutions"] as const satisfies readonly Observance[];
const thisYear = () =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));

/**
 * The national business calendar every factory shares (D-161): holidays and who observes them —
 * only a day off for `all` stops lead times and SLAs — and extra working days. Keyed in once a
 * year, by hand here or a whole year from Excel (D-170). Due dates already computed do not move.
 */
export function CalendarDesk() {
  const t = useTranslations("shipping.calendar");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("business_calendar.manage");
  const canImport = useCan("catalog.import");
  const [year, setYear] = useState(thisYear);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Day | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "calendar_day", { year }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/business-calendar/holidays", { params: { query: { year } } }))
        .data!,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "calendar_day") });
  const weekday = (day: string) =>
    new Intl.DateTimeFormat(format.locale === "en" ? "en-GB" : "th-TH", { weekday: "long", timeZone: "UTC" }).format(
      new Date(`${day}T00:00:00Z`),
    );

  const columns: DataTableColumn<Day>[] = [
    {
      id: "day",
      header: t("day"),
      cell: (row) => (
        <div>
          <p className="font-medium tabular-nums">{format.date(`${row.day}T00:00:00+07:00`)}</p>
          <p className="text-muted text-xs">{weekday(row.day)}</p>
        </div>
      ),
    },
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <div>
          <p>{row.nameTh}</p>
          {row.nameEn ? <p className="text-muted text-xs">{row.nameEn}</p> : null}
        </div>
      ),
    },
    {
      id: "kind",
      header: t("kind"),
      cell: (row) => (
        <Badge
          size="sm"
          tone={row.kind === "extra_working_day" ? "info" : row.kind === "closure" ? "warning" : "neutral"}
        >
          {t(`kinds.${row.kind}`)}
        </Badge>
      ),
    },
    {
      id: "observance",
      header: t("observance"),
      cell: (row) => (
        <span className={row.observance === "all" ? "font-medium" : "text-muted"}>
          {t(`observances.${row.observance}`)}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Day) =>
              row.kind === "closure" ? null : (
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraft({
                        day: row.day,
                        kind: row.kind as Kind,
                        observance: row.observance,
                        nameTh: row.nameTh,
                        nameEn: row.nameEn ?? "",
                        isNew: false,
                      })
                    }
                  >
                    {t("edit")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(row)}>
                    {t("remove")}
                  </Button>
                </span>
              ),
          } satisfies DataTableColumn<Day>,
        ]
      : []),
  ];

  const days = query.data ?? [];
  const offDays = days.filter((d) => d.kind !== "extra_working_day" && d.observance === "all").length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label={t("year")}
          value={String(year)}
          onValueChange={(value) => setYear(Number(value))}
          options={[thisYear() - 1, thisYear(), thisYear() + 1].map((y) => ({
            value: String(y),
            label: String(y + (format.locale === "en" ? 0 : 543)),
          }))}
        />
        <p className="text-muted text-sm">{t("summary", { days: days.length, off: offDays })}</p>
        <span className="ms-auto flex gap-2">
          {canImport ? (
            <Button variant="ghost" iconStart="upload" asChild>
              <Link href="/catalogue/import?kind=national_holidays">{t("importYear")}</Link>
            </Button>
          ) : null}
          {canManage ? (
            <Button
              iconStart="plus"
              onClick={() =>
                setDraft({
                  day: `${year}-01-01`,
                  kind: "holiday",
                  observance: "all",
                  nameTh: "",
                  nameEn: "",
                  isNew: true,
                })
              }
            >
              {t("add")}
            </Button>
          ) : null}
        </span>
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title", { year })}
          columns={columns}
          rows={days}
          getRowId={(row) => row.day}
          loading={query.isPending}
          empty={<EmptyState icon="calendar" title={t("empty", { year })} description={t("emptyHint")} />}
        />
      )}

      {draft ? (
        <FormDialog
          title={draft.isNew ? t("addTitle") : t("editTitle", { day: format.date(`${draft.day}T00:00:00+07:00`) })}
          description={t("formIntro")}
          submitLabel={t("save")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.day) || draft.nameTh.trim().length < 2)
              throw new FormError(t("incomplete"));
            await adminBrowserApis().contract.PUT("/v1/admin/business-calendar/holidays/{day}", {
              params: { path: { day: draft.day } },
              body: {
                kind: draft.kind,
                observance: draft.observance,
                nameTh: draft.nameTh.trim(),
                nameEn: draft.nameEn.trim() || null,
              },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("day")} required>
            <Input
              type="date"
              disabled={!draft.isNew}
              value={draft.day}
              onChange={(e) => setDraft({ ...draft, day: e.target.value })}
            />
          </Field>
          <Field label={t("kind")}>
            <NativeSelect
              value={draft.kind}
              onValueChange={(kind) => setDraft({ ...draft, kind })}
              options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
            />
          </Field>
          <Field label={t("observance")} hint={t("observanceHint")}>
            <NativeSelect
              value={draft.observance}
              onValueChange={(observance) => setDraft({ ...draft, observance })}
              options={OBSERVANCES.map((o) => ({ value: o, label: t(`observances.${o}`) }))}
            />
          </Field>
          <Field label={t("nameTh")} required>
            <Input value={draft.nameTh} onChange={(e) => setDraft({ ...draft, nameTh: e.target.value })} />
          </Field>
          <Field label={t("nameEn")}>
            <Input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}

      {removing ? (
        <ConfirmAction
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t("removeTitle", { name: removing.nameTh })}
          description={t("removeBody")}
          confirmLabel={t("remove")}
          tone="destructive"
          onConfirm={async () => {
            try {
              await adminBrowserApis().contract.DELETE("/v1/admin/business-calendar/holidays/{day}", {
                params: { path: { day: removing.day } },
              });
              toast.success(t("removed"));
              refresh();
              setRemoving(null);
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
