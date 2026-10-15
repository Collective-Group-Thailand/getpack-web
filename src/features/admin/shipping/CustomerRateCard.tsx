"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat, When } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  download,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  useCan,
} from "../console";
import { RateLinesEditor } from "./RateLinesEditor";
import {
  editable,
  emptyLine,
  effectiveInstant,
  problemsOf,
  STATUS_TONE,
  today,
  toInput,
  type EditableLine,
} from "./rates";
import { RatesTable } from "./RatesTable";
import { QuoteTester } from "./QuoteTester";
import { useCustomerZones } from "./zones";

type Summary = Schemas["CustomerRateVersionSummaryDto"];
type Preview = Schemas["RateImportPreviewDto"];
type Confirming = { kind: "submit" | "withdraw" | "delete"; version: Summary };

/**
 * The customer shipping rate card (D-013, D-063): what customers pay per zone (or postcode) and
 * weight / volume band, VAT-exclusive. Changes are versions — drafted (typed, copied or imported
 * from Excel), submitted for C-Level approval, applied from their date and never back-dated.
 */
export function CustomerRateCard() {
  const t = useTranslations("shipping.customer");
  const tVersion = useTranslations("shipping.version");
  const format = useFormat();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canManage = useCan("shipping_rates.manage");
  const zones = useCustomerZones();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ effectiveFrom: string; reason: string; from: string } | null>(null);
  const [editing, setEditing] = useState<EditableLine[] | null>(null);
  const [importing, setImporting] = useState<{ preview: Preview | null; busy: boolean } | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);

  const card = useQuery({
    queryKey: queryKeys.detail("admin", "customer_rate_card", "card"),
    queryFn: async () => {
      try {
        return (await adminBrowserApis().contract.GET("/v1/admin/shipping/customer-rate-card")).data!;
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
  });
  const versions = useQuery({
    queryKey: queryKeys.list("admin", "customer_rate_version", {}),
    queryFn: async () => {
      try {
        return (await adminBrowserApis().contract.GET("/v1/admin/shipping/customer-rate-card/versions")).data!;
      } catch (error) {
        if (isApiError(error) && error.status === 404) return [];
        throw error;
      }
    },
  });
  const shownId = selected ?? card.data?.open[0]?.id ?? card.data?.current?.id ?? versions.data?.[0]?.id ?? null;
  const version = useQuery({
    queryKey: queryKeys.detail("admin", "customer_rate_version", shownId ?? ""),
    enabled: Boolean(shownId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/shipping/customer-rate-card/versions/{versionId}", {
          params: { path: { versionId: shownId! } },
        })
      ).data!,
  });
  const refresh = (versionId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "customer_rate_card") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "customer_rate_version") });
    if (versionId) setSelected(versionId);
  };

  if (card.isError) return <QueryError error={card.error} onRetry={() => void card.refetch()} />;
  const shown = version.data;
  const zoneName = new Map((zones.data ?? []).map((zone) => [zone.id, locale === "en" ? zone.nameEn : zone.nameTh]));
  const statusBadge = (status: Summary["status"]) => (
    <Badge size="sm" tone={STATUS_TONE[status]}>
      {tVersion(`statuses.${status}`)}
    </Badge>
  );

  const versionColumns: DataTableColumn<Summary>[] = [
    {
      id: "no",
      header: tVersion("no"),
      cell: (row) => (
        <button
          type="button"
          className="text-primary font-medium hover:underline"
          aria-current={row.id === shownId || undefined}
          onClick={() => setSelected(row.id)}
        >
          {tVersion("label", { no: row.versionNo })}
        </button>
      ),
    },
    { id: "status", header: tVersion("status"), cell: (row) => statusBadge(row.status) },
    { id: "effective", header: tVersion("effectiveFrom"), cell: (row) => <When at={row.effectiveFrom} absoluteOnly /> },
    { id: "rates", header: tVersion("rateCount"), numeric: true, cell: (row) => format.number(row.rateCount) },
    { id: "reason", header: tVersion("reason"), cell: (row) => <span className="text-sm">{row.reason}</span> },
    {
      id: "decided",
      header: tVersion("decidedAt"),
      cell: (row) => (row.decidedAt ? <When at={row.decidedAt} /> : "—"),
    },
  ];

  const exportVersion = async (versionId: string) => {
    try {
      const { data } = await adminBrowserApis().contract.POST(
        "/v1/admin/shipping/customer-rate-card/versions/{versionId}/actions/export",
        {
          params: { path: { versionId } },
        },
      );
      download(data!.url);
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  };

  const summaryCard = (title: string, summary: Summary | null | undefined, empty: string) => (
    <div className="border-border rounded-card border p-4">
      <p className="text-muted text-xs font-medium">{title}</p>
      {summary ? (
        <>
          <p className="mt-1 font-medium">
            <button type="button" className="text-primary hover:underline" onClick={() => setSelected(summary.id)}>
              {tVersion("label", { no: summary.versionNo })}
            </button>{" "}
            {statusBadge(summary.status)}
          </p>
          <p className="text-muted text-sm">
            {tVersion("from")} <When at={summary.effectiveFrom} absoluteOnly /> ·{" "}
            {tVersion("rates", { count: summary.rateCount })}
          </p>
        </>
      ) : (
        <p className="text-muted mt-1 text-sm">{empty}</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        {summaryCard(t("current"), card.data?.current, t("noCurrent"))}
        {summaryCard(t("scheduled"), card.data?.scheduled, t("noScheduled"))}
        {summaryCard(t("open"), card.data?.open[0], t("noOpen"))}
      </div>
      {card.data === null ? <Callout tone="warning" title={t("noCard")} /> : null}

      <Section
        title={t("versionsTitle")}
        description={t("versionsIntro")}
        actions={
          canManage && card.data ? (
            <Button
              size="sm"
              iconStart="plus"
              onClick={() =>
                setCreating({ effectiveFrom: today(), reason: "", from: card.data?.current?.id ?? "empty" })
              }
            >
              {t("newVersion")}
            </Button>
          ) : null
        }
      >
        {versions.isError ? (
          <QueryError error={versions.error} onRetry={() => void versions.refetch()} />
        ) : (
          <DataTable
            caption={t("versionsTitle")}
            columns={versionColumns}
            rows={versions.data ?? []}
            getRowId={(row) => row.id}
            loading={versions.isPending}
            rowTone={(row) => (row.id === shownId ? "info" : undefined)}
            empty={<EmptyState icon="truck" title={t("noVersions")} />}
          />
        )}
      </Section>

      {shown ? (
        <Section
          title={tVersion("title", { no: shown.versionNo })}
          description={
            <>
              {tVersion("from")} <When at={shown.effectiveFrom} absoluteOnly /> · {shown.reason} ·{" "}
              {tVersion("scheme", { scheme: shown.schemeCode })}
              {shown.approvalRequestId ? (
                <>
                  {" · "}
                  <Link href={`/approvals/${shown.approvalRequestId}`} className="text-primary hover:underline">
                    {tVersion("approval")}
                  </Link>
                </>
              ) : null}
            </>
          }
          actions={
            <span className="flex flex-wrap gap-2">
              {statusBadge(shown.status)}
              <Button size="sm" variant="ghost" iconStart="download" onClick={() => void exportVersion(shown.id)}>
                {tVersion("export")}
              </Button>
              {canManage && shown.status === "draft" ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    iconStart="edit"
                    onClick={() =>
                      setEditing(
                        shown.rates.length
                          ? shown.rates.map((rate) => editable(rate, rate.priceAmount))
                          : [emptyLine(zones.data?.[0]?.id)],
                      )
                    }
                  >
                    {tVersion("editRates")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    iconStart="upload"
                    onClick={() => setImporting({ preview: null, busy: false })}
                  >
                    {tVersion("import")}
                  </Button>
                  <Button size="sm" iconStart="send" onClick={() => setConfirming({ kind: "submit", version: shown })}>
                    {t("submit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconStart="trash"
                    onClick={() => setConfirming({ kind: "delete", version: shown })}
                  >
                    {tVersion("delete")}
                  </Button>
                </>
              ) : null}
              {canManage && shown.status === "proposed" ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirming({ kind: "withdraw", version: shown })}>
                  {tVersion("withdraw")}
                </Button>
              ) : null}
            </span>
          }
        >
          <RatesTable
            caption={tVersion("title", { no: shown.versionNo })}
            amountLabel={t("price")}
            rows={shown.rates.map((rate) => ({
              ...rate,
              zoneName: zoneName.get(rate.zoneId),
              amount: rate.priceAmount,
            }))}
          />
        </Section>
      ) : version.isError ? (
        <QueryError error={version.error} onRetry={() => void version.refetch()} />
      ) : null}

      <QuoteTester />

      {creating ? (
        <FormDialog
          title={t("newVersionTitle")}
          description={t("newVersionIntro")}
          submitLabel={t("createDraft")}
          onClose={() => setCreating(null)}
          onSubmit={async () => {
            if (creating.reason.trim().length < 3) throw new FormError(t("reasonRequired"));
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/shipping/customer-rate-card/versions", {
              body: {
                effectiveFrom: effectiveInstant(creating.effectiveFrom),
                reason: creating.reason.trim(),
                ...(creating.from === "empty" ? { rates: [] } : { copyFromVersionId: creating.from }),
              },
            });
            toast.success(t("drafted"));
            refresh(data!.id);
          }}
        >
          <Field label={tVersion("effectiveFrom")} hint={t("effectiveHint")} required>
            <Input
              type="date"
              min={today()}
              value={creating.effectiveFrom}
              onChange={(e) => setCreating({ ...creating, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label={tVersion("reason")} required>
            <Input value={creating.reason} onChange={(e) => setCreating({ ...creating, reason: e.target.value })} />
          </Field>
          <Field label={t("startFrom")}>
            <RadioCards
              columns={1}
              value={creating.from}
              onValueChange={(from) => setCreating({ ...creating, from })}
              options={[
                ...(versions.data ?? [])
                  .filter((v) => v.rateCount > 0)
                  .slice(0, 3)
                  .map((v) => ({
                    value: v.id,
                    label: t("copyOf", { no: v.versionNo }),
                    description: `${tVersion(`statuses.${v.status}`)} · ${tVersion("rates", { count: v.rateCount })}`,
                  })),
                { value: "empty", label: t("startEmpty"), description: t("startEmptyHint") },
              ]}
            />
          </Field>
        </FormDialog>
      ) : null}

      {editing && shown ? (
        <FormDialog
          size="xl"
          title={tVersion("editTitle", { no: shown.versionNo })}
          description={tVersion("editIntro")}
          submitLabel={tVersion("saveRates")}
          onClose={() => setEditing(null)}
          onSubmit={async () => {
            if (problemsOf(editing).size) throw new FormError(tVersion("fixLines"));
            await adminBrowserApis().contract.PUT("/v1/admin/shipping/customer-rate-card/versions/{versionId}/rates", {
              params: { path: { versionId: shown.id } },
              body: {
                rates: editing.map((line) => {
                  const { amount, ...input } = toInput(line);
                  return { ...input, priceAmount: amount };
                }),
              },
            });
            toast.success(tVersion("ratesSaved"));
            refresh(shown.id);
          }}
        >
          <RateLinesEditor
            lines={editing}
            onChange={setEditing}
            zones={zones.data ?? []}
            problems={problemsOf(editing)}
            amountLabel={t("price")}
          />
        </FormDialog>
      ) : null}

      {importing && shown ? (
        <FormDialog
          title={tVersion("importTitle", { no: shown.versionNo })}
          description={tVersion("importIntro")}
          submitLabel={tVersion("importConfirm")}
          onClose={() => setImporting(null)}
          onSubmit={async () => {
            if (!importing.preview?.canConfirm) throw new FormError(tVersion("importNotReady"));
            await adminBrowserApis().contract.POST(
              "/v1/admin/shipping/customer-rate-card/versions/{versionId}/actions/import-confirm",
              {
                params: { path: { versionId: shown.id } },
                body: { fileId: importing.preview.fileId, previewSha256: importing.preview.previewSha256 },
              },
            );
            toast.success(tVersion("imported", { count: importing.preview.rows }));
            refresh(shown.id);
          }}
        >
          <FileDropzone
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            maxBytes={10 * 1024 * 1024}
            disabled={importing.busy}
            onFiles={async ([file]) => {
              if (!file) return;
              setImporting({ preview: null, busy: true });
              try {
                const uploaded = await uploadFile("admin", file, "import");
                const { data } = await adminBrowserApis().contract.POST(
                  "/v1/admin/shipping/customer-rate-card/versions/{versionId}/actions/import-preview",
                  {
                    params: { path: { versionId: shown.id } },
                    body: { fileId: uploaded.id },
                  },
                );
                setImporting({ preview: data!, busy: false });
              } catch (error) {
                toast.error(problemMessage(error, t("failed")));
                setImporting({ preview: null, busy: false });
              }
            }}
            labels={{
              prompt: importing.busy ? tVersion("reading") : tVersion("drop"),
              browse: tVersion("browse"),
              hint: tVersion("importHint"),
              tooLarge: (name) => tVersion("tooLarge", { name }),
              wrongType: (name) => tVersion("wrongType", { name }),
            }}
          />
          {importing.preview ? (
            <Callout
              tone={importing.preview.canConfirm ? "success" : "danger"}
              title={tVersion("previewSummary", { rows: importing.preview.rows, invalid: importing.preview.invalid })}
            >
              {importing.preview.errors.length ? (
                <ul className="list-disc ps-4 text-sm">
                  {importing.preview.errors.slice(0, 20).map((error) => (
                    <li key={`${error.sheet}-${error.row}-${error.column ?? ""}-${error.code}`}>
                      {tVersion("rowError", { row: error.row, column: error.column ?? "—" })} {error.message}
                    </li>
                  ))}
                </ul>
              ) : (
                tVersion("previewReplaces")
              )}
            </Callout>
          ) : null}
        </FormDialog>
      ) : null}

      {confirming ? (
        <ConfirmAction
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={t(`confirm.${confirming.kind}.title`, { no: confirming.version.versionNo })}
          description={t(`confirm.${confirming.kind}.body`)}
          confirmLabel={t(`confirm.${confirming.kind}.action`)}
          tone={confirming.kind === "submit" ? "primary" : "destructive"}
          reason={
            confirming.kind === "withdraw"
              ? { label: tVersion("withdrawReason"), required: true, minLength: 3 }
              : undefined
          }
          onConfirm={async ({ reason }) => {
            const versionId = confirming.version.id;
            const params = { path: { versionId } };
            try {
              if (confirming.kind === "submit")
                await adminBrowserApis().contract.POST(
                  "/v1/admin/shipping/customer-rate-card/versions/{versionId}/actions/submit",
                  { params },
                );
              else if (confirming.kind === "withdraw")
                await adminBrowserApis().contract.POST(
                  "/v1/admin/shipping/customer-rate-card/versions/{versionId}/actions/withdraw",
                  {
                    params,
                    body: { reason },
                  },
                );
              else
                await adminBrowserApis().contract.DELETE("/v1/admin/shipping/customer-rate-card/versions/{versionId}", {
                  params,
                });
              toast.success(t(`confirm.${confirming.kind}.done`));
              if (confirming.kind === "delete") setSelected(null);
              refresh(confirming.kind === "delete" ? undefined : versionId);
              setConfirming(null);
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
