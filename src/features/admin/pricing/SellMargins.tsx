"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { SETTING_VERSION_STATUS } from "@/domain/status";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  effectiveInstant,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  today,
  useCan,
  useProductTypes,
} from "../console";
import { useDifficultyLevels, usePrintTypes, useRefreshPricing } from "./lookups";
import { checkMarginLines, emptyMarginLine, toApiLines, toEditable, type EditableMarginLine } from "./margins";
import { MarginLinesEditor } from "./MarginLinesEditor";

type Table = Schemas["SellMarginTableDto"];
type Version = Schemas["SellMarginVersionDto"];
type Kind = Schemas["SellMarginKind"];

export const MARGIN_KINDS = [
  "margin",
  "target_margin",
  "fix_cost",
  "design_fee",
  "structure_design_fee",
] as const satisfies readonly Kind[];

function useMarginTables() {
  return useQuery({
    queryKey: queryKeys.list("admin", "sell_margin_table"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/sell-margin-tables")).data!,
  });
}

/** A line's value as read: "25 %" or "฿150.00", with its minimum. */
function useLineValue() {
  const format = useFormat();
  const t = useTranslations("pricing.lines");
  return (line: { valuePct: string | null; valueAmount: string | null; minAmount: string | null }) => {
    const value = line.valuePct !== null ? format.percent(line.valuePct) : format.thb(line.valueAmount ?? "0");
    return line.minAmount ? `${value} · ${t("atLeast", { amount: format.thb(line.minAmount) })}` : value;
  };
}

/**
 * getpack's sell-margin tables (D-063): per product type, print type (or every print type) and
 * kind — margin tiers, target margins, fixed costs and design fees — each a dated series of
 * versions. A draft becomes the price only when Superadmin or C-Level approves it.
 */
export function SellMarginsList() {
  const t = useTranslations("pricing.margins");
  const tKinds = useTranslations("pricing.kinds");
  const format = useFormat();
  const tables = useMarginTables();
  const types = useProductTypes();
  const printTypes = usePrintTypes();
  const canManage = useCan("sell_margins.manage");
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<Kind | "all">("all");

  const rows = (tables.data ?? []).filter((row) => kind === "all" || row.kind === kind);
  const columns: DataTableColumn<Table>[] = [
    {
      id: "table",
      header: t("columns.table"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/pricing/margins/${row.id}`} className="text-primary font-medium hover:underline">
            {row.description}
          </Link>
          <span className="text-muted text-xs">
            {types.labelOf(row.productTypeCode)} ·{" "}
            {row.printTypeId ? printTypes.labelOf(row.printTypeId) : t("everyPrintType")}
          </span>
        </div>
      ),
    },
    { id: "kind", header: t("columns.kind"), cell: (row) => <Badge size="sm">{tKinds(row.kind)}</Badge> },
    {
      id: "current",
      header: t("columns.current"),
      cell: (row) =>
        row.current ? (
          <span className="text-sm">
            {t("versionSummary", {
              no: row.current.versionNo,
              lines: row.current.lines.length,
              date: format.date(row.current.effectiveFrom),
            })}
          </span>
        ) : (
          <Badge size="sm" tone="warning" icon="warning">
            {t("noVersion")}
          </Badge>
        ),
    },
  ];

  if (tables.isError) return <QueryError error={tables.error} onRetry={() => void tables.refetch()} />;
  return (
    <Section
      title={t("listTitle")}
      description={t("listBody")}
      actions={
        canManage ? (
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            {t("create")}
          </Button>
        ) : null
      }
    >
      <div className="mb-3">
        <SegmentedControl
          label={t("filterKind")}
          value={kind}
          onValueChange={(value) => setKind(value as Kind | "all")}
          options={[
            { value: "all", label: t("allKinds") },
            ...MARGIN_KINDS.map((value) => ({ value, label: tKinds(value) })),
          ]}
        />
      </div>
      <DataTable
        caption={t("listTitle")}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={tables.isPending}
        empty={<EmptyState icon="percent" title={t("empty")} />}
      />
      {creating ? <CreateTableDialog onClose={() => setCreating(false)} /> : null}
    </Section>
  );
}

function CreateTableDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("pricing.createTable");
  const tKinds = useTranslations("pricing.kinds");
  const router = useRouter();
  const refresh = useRefreshPricing();
  const types = useProductTypes();
  const printTypes = usePrintTypes();
  const [form, setForm] = useState({ productTypeId: "", printTypeId: "", kind: "margin" as Kind, description: "" });
  return (
    <FormDialog
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!form.productTypeId) throw new FormError(t("needType"));
        if (form.description.trim().length < 3) throw new FormError(t("needDescription"));
        const { data } = await adminBrowserApis().contract.POST("/v1/admin/sell-margin-tables", {
          body: {
            productTypeId: form.productTypeId,
            printTypeId: form.printTypeId || null,
            kind: form.kind,
            description: form.description.trim(),
          },
        });
        refresh();
        toast.success(t("done"));
        router.push(`/pricing/margins/${data!.id}`);
      }}
    >
      <Field label={t("productType")} required>
        <SearchableSelect
          value={form.productTypeId || undefined}
          placeholder={t("choose")}
          onValueChange={(productTypeId) => setForm({ ...form, productTypeId, printTypeId: "" })}
          options={types.types.map((type) => ({ value: type.id, label: types.labelOf(type.code) }))}
        />
      </Field>
      <Field label={t("printType")} hint={t("printTypeHint")}>
        <SearchableSelect
          value={form.printTypeId || "all"}
          onValueChange={(value) => setForm({ ...form, printTypeId: value === "all" ? "" : value })}
          options={[{ value: "all", label: t("everyPrintType") }, ...printTypes.optionsFor(form.productTypeId)]}
        />
      </Field>
      <Field label={t("kind")} required>
        <SearchableSelect
          value={form.kind}
          onValueChange={(kind) => setForm({ ...form, kind: kind as Kind })}
          options={MARGIN_KINDS.map((value) => ({ value, label: tKinds(value) }))}
        />
      </Field>
      <Field label={t("description")} hint={t("descriptionHint")} required>
        <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </Field>
    </FormDialog>
  );
}

/**
 * One sell-margin table: the version in force and every version with its lines; a new version is
 * drafted from the one in force (copy-on-write) and approved by Superadmin or C-Level. Approval
 * never applies backwards — a date that passed becomes the moment of approval.
 */
export function SellMarginDetail({ tableId }: { tableId: string }) {
  const t = useTranslations("pricing.margin");
  const tKinds = useTranslations("pricing.kinds");
  const tLines = useTranslations("pricing.lines");
  const format = useFormat();
  const lineValue = useLineValue();
  const tables = useMarginTables();
  const types = useProductTypes();
  const printTypes = usePrintTypes();
  const levels = useDifficultyLevels();
  const refresh = useRefreshPricing();
  const canManage = useCan("sell_margins.manage");
  const [drafting, setDrafting] = useState(false);
  const [approving, setApproving] = useState<Version | null>(null);
  const [shownNo, setShownNo] = useState<number | null>(null);
  const versions = useQuery({
    queryKey: queryKeys.related("admin", "sell_margin_table", tableId, "versions"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/sell-margin-tables/{tableId}/versions", {
          params: { path: { tableId } },
        })
      ).data!,
  });
  const table = tables.data?.find((row) => row.id === tableId);

  if (tables.isError) return <QueryError error={tables.error} onRetry={() => void tables.refetch()} />;
  if (versions.isError) return <QueryError error={versions.error} onRetry={() => void versions.refetch()} />;
  if (!tables.data || !versions.data) return null;
  if (!table) return <Callout tone="warning" title={t("notFound")} />;

  const list = versions.data;
  const shown = list.find((version) => version.versionNo === shownNo) ?? table.current ?? list[0] ?? null;
  const draft = list.find((version) => version.status === "draft") ?? null;

  const columns: DataTableColumn<Version>[] = [
    {
      id: "no",
      header: t("columns.version"),
      cell: (row) => (
        <button type="button" className="text-primary hover:underline" onClick={() => setShownNo(row.versionNo)}>
          {t("versionNo", { no: row.versionNo })}
          {table.current?.id === row.id ? (
            <Badge size="sm" tone="success" className="ms-2">
              {t("inForce")}
            </Badge>
          ) : null}
        </button>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={SETTING_VERSION_STATUS} value={row.status} />,
    },
    { id: "from", header: t("columns.from"), cell: (row) => format.dateTime(row.effectiveFrom) },
    { id: "lines", header: t("columns.lines"), numeric: true, cell: (row) => format.number(row.lines.length) },
    { id: "reason", header: t("columns.reason"), cell: (row) => <span className="text-sm">{row.reason}</span> },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        row.status === "draft" && canManage ? (
          <Button size="sm" onClick={() => setApproving(row)}>
            {t("approve")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("tables"), href: "/pricing/margins" }, { label: table.description }]}
          />
        }
        title={table.description}
        meta={
          <>
            <Badge>{tKinds(table.kind)}</Badge>
            <span className="text-muted text-sm">
              {types.labelOf(table.productTypeCode)} ·{" "}
              {table.printTypeId ? printTypes.labelOf(table.printTypeId) : t("everyPrintType")}
            </span>
          </>
        }
        actions={
          canManage ? (
            <Button
              iconStart="edit"
              disabled={Boolean(draft)}
              title={draft ? t("draftWaiting") : undefined}
              onClick={() => setDrafting(true)}
            >
              {t("draft")}
            </Button>
          ) : null
        }
      />
      {draft ? (
        <Callout tone="warning" title={t("draftTitle", { no: draft.versionNo })}>
          {t("draftBody", { date: format.dateTime(draft.effectiveFrom) })}
        </Callout>
      ) : null}
      {!table.current ? <Callout tone="info" title={t("noneInForce")} /> : null}

      {shown ? (
        <Section
          title={t("linesTitle", { no: shown.versionNo })}
          description={
            shown.fallbackPct || shown.fallbackAmount
              ? t("fallback", {
                  value:
                    shown.fallbackPct !== null
                      ? format.percent(shown.fallbackPct)
                      : format.thb(shown.fallbackAmount ?? "0"),
                })
              : t("noFallback")
          }
        >
          <div className="border-border overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("linesTitle", { no: shown.versionNo })}</caption>
              <thead className="bg-surface-subtle text-muted text-xs">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t("run")}</th>
                  <th className="px-3 py-2 text-start font-medium">{t("buyPrice")}</th>
                  <th className="px-3 py-2 text-start font-medium">{tLines("colourCount")}</th>
                  <th className="px-3 py-2 text-start font-medium">{tLines("level")}</th>
                  <th className="px-3 py-2 text-end font-medium">{tLines("value")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.lines.map((line, index) => (
                  <tr key={index} className="border-border border-t">
                    <td className="px-3 py-2 tabular-nums">
                      {t("range", {
                        from: line.qtyMin === null ? t("open") : format.number(line.qtyMin),
                        to: line.qtyMax === null ? t("open") : format.number(line.qtyMax),
                      })}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {t("priceRange", {
                        from: line.priceMin === null ? t("open") : format.thb(line.priceMin),
                        to: line.priceMax === null ? t("open") : format.thb(line.priceMax),
                      })}
                    </td>
                    <td className="px-3 py-2">{line.colourCount ?? t("any")}</td>
                    <td className="px-3 py-2">
                      {line.difficultyLevelId ? levels.labelOf(line.difficultyLevelId) : t("any")}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{lineValue(line)}</td>
                  </tr>
                ))}
                {shown.lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-muted px-3 py-6 text-center">
                      {tLines("noLines")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section title={t("versionsTitle")}>
        <DataTable
          caption={t("versionsTitle")}
          columns={columns}
          rows={list}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="history" title={t("noVersions")} />}
        />
      </Section>

      {drafting ? (
        <DraftVersionDialog
          tableId={tableId}
          from={table.current ?? list[0] ?? null}
          levels={levels.options}
          onClose={() => setDrafting(false)}
          onDone={() => {
            setDrafting(false);
            setShownNo(null);
            void versions.refetch();
            refresh();
          }}
        />
      ) : null}
      <ConfirmAction
        open={Boolean(approving)}
        onOpenChange={(open) => (open ? undefined : setApproving(null))}
        title={t("approveTitle", { no: approving?.versionNo ?? 0 })}
        description={t("approveBody", {
          table: table.description,
          lines: approving?.lines.length ?? 0,
          date: approving ? format.dateTime(approving.effectiveFrom) : "",
        })}
        confirmLabel={t("approve")}
        onConfirm={async () => {
          try {
            await adminBrowserApis().contract.POST(
              "/v1/admin/sell-margin-tables/versions/{versionId}/actions/approve",
              {
                params: { path: { versionId: approving!.id } },
              },
            );
            toast.success(t("approved"));
            setShownNo(null);
            void versions.refetch();
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}

function DraftVersionDialog({
  tableId,
  from,
  levels,
  onClose,
  onDone,
}: {
  tableId: string;
  from: Version | null;
  levels: readonly { value: string; label: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("pricing.draft");
  const [lines, setLines] = useState<EditableMarginLine[]>(() =>
    from && from.lines.length ? from.lines.map(toEditable) : [emptyMarginLine()],
  );
  const [fallbackKind, setFallbackKind] = useState<"none" | "pct" | "amount">(
    from?.fallbackPct ? "pct" : from?.fallbackAmount ? "amount" : "none",
  );
  const [fallback, setFallback] = useState(from?.fallbackPct ?? from?.fallbackAmount ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const problems = useMemo(() => checkMarginLines(lines), [lines]);
  return (
    <FormDialog
      size="xl"
      title={t("title")}
      description={from ? t("bodyFrom", { no: from.versionNo }) : t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        setTried(true);
        if (lines.length === 0) throw new FormError(t("needLines"));
        if (problems.size) throw new FormError(t("fixLines"));
        if (fallbackKind === "pct" && !/^\d{1,2}(\.\d{1,4})?$/.test(fallback.trim()))
          throw new FormError(t("badFallback"));
        if (fallbackKind === "amount" && !/^\d{1,12}(\.\d{1,6})?$/.test(fallback.trim())) {
          throw new FormError(t("badFallback"));
        }
        if (effectiveFrom < today()) throw new FormError(t("backDated"));
        if (reason.trim().length < 3) throw new FormError(t("needReason"));
        await adminBrowserApis().contract.POST("/v1/admin/sell-margin-tables/{tableId}/versions", {
          params: { path: { tableId } },
          body: {
            effectiveFrom: effectiveInstant(effectiveFrom),
            fallbackPct: fallbackKind === "pct" ? fallback.trim() : null,
            fallbackAmount: fallbackKind === "amount" ? fallback.trim() : null,
            lines: toApiLines(lines),
            reason: reason.trim(),
          },
        });
        toast.success(t("done"));
        onDone();
      }}
    >
      <MarginLinesEditor lines={lines} onChange={setLines} problems={tried ? problems : new Map()} levels={levels} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("fallbackKind")} hint={t("fallbackHint")}>
          <SearchableSelect
            value={fallbackKind}
            onValueChange={(value) => setFallbackKind(value as "none" | "pct" | "amount")}
            options={(["none", "pct", "amount"] as const).map((value) => ({
              value,
              label: t(`fallbackKinds.${value}`),
            }))}
          />
        </Field>
        {fallbackKind !== "none" ? (
          <Field label={t("fallback")}>
            <Input inputMode="decimal" value={fallback} onChange={(event) => setFallback(event.target.value)} />
          </Field>
        ) : null}
        <Field label={t("effectiveFrom")} hint={t("effectiveHint")} required>
          <Input
            type="date"
            min={today()}
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}
