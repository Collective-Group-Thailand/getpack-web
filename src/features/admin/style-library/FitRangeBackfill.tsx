"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Stat } from "@/ui/components/Stat";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, adminBrowserApis, problemMessage, Section, useCan } from "../console";
import { DIMENSIONS } from "./commercial-form";
import { styleDeskHref } from "./resources";

type Result = Schemas["FitRangeBackfillResult"];
type Change = Result["changes"][number];
type Incomplete = Result["incomplete"][number];

async function run(dryRun: boolean): Promise<Result> {
  const { data } = await adminBrowserApis().contract.POST("/v1/admin/styles/actions/backfill-fit-ranges", {
    body: { dryRun },
  });
  return data!;
}

/** `60–400 × 51–300 × 25–35` (mm), in ยาว × กว้าง × สูง order. */
export function rangeText(r: Change["after"] | null): string {
  if (!r) return "—";
  return DIMENSIONS.map(({ min, max }) => `${r[min]}–${r[max]}`).join(" × ");
}

/**
 * The fit-range backfill (C0b/C1c — DECISIONS-STAGE-A §9.1, §11.1): a dry run first shows what
 * would be filled, from which source, and which styles stay empty and why; confirming runs the same
 * audited curation path. A business-entered range is never touched. `styles.curate` only.
 */
export function FitRangeBackfill() {
  const t = useTranslations("styleLibrary.fitRanges");
  const canCurate = useCan("styles.curate");
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);

  const dry = useMutation({
    mutationFn: () => run(true),
    onSuccess: (result) => {
      setPreview(result);
      setDone(null);
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const shown = done ?? preview;
  const changeColumns: DataTableColumn<Change>[] = [
    {
      id: "code",
      header: t("columns.style"),
      cell: (row) => (
        <Link href={styleDeskHref(row.styleId)} className="text-primary tabular-nums underline underline-offset-2">
          {row.code}
        </Link>
      ),
    },
    { id: "action", header: t("columns.action"), cell: (row) => <Badge>{t(`actions.${row.action}`)}</Badge> },
    {
      id: "range",
      header: t("columns.range"),
      cell: (row) => <span className="tabular-nums">{rangeText(row.after)}</span>,
    },
    {
      id: "before",
      header: t("columns.before"),
      cell: (row) => <span className="text-muted tabular-nums">{rangeText(row.before)}</span>,
    },
    {
      id: "source",
      header: t("columns.source"),
      cell: (row) => <Badge tone="info">{t(`sources.${row.source}`)}</Badge>,
    },
  ];
  const incompleteColumns: DataTableColumn<Incomplete>[] = [
    { id: "code", header: t("columns.style"), cell: (row) => <span className="tabular-nums">{row.code}</span> },
    {
      id: "why",
      header: t("columns.why"),
      cell: (row) => (
        <span className="text-sm">
          {row.missing.length
            ? t("missing", { bounds: row.missing.map((b) => t(`bounds.${b}`)).join(", ") })
            : null}
          {row.conflicting.length
            ? ` ${t("conflicting", { dims: row.conflicting.map((d) => t(`dimensions.${d}`)).join(", ") })}`
            : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Section title={t("orderTitle")} description={t("orderIntro")}>
        <ol className="text-muted list-decimal space-y-1 ps-5 text-sm">
          <li>{t("order.recipe")}</li>
          <li>{t("order.standardSizes")}</li>
          <li>{t("order.envelope")}</li>
        </ol>
        <p className="text-muted mt-3 text-sm">{t("never")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" loading={dry.isPending} onClick={() => dry.mutate()}>
            {t("dryRun")}
          </Button>
          {canCurate ? (
            <Button
              type="button"
              disabled={!preview || preview.changes.length === 0 || done !== null}
              onClick={() => setConfirming(true)}
            >
              {t("confirm")}
            </Button>
          ) : null}
        </div>
        {!canCurate ? <Callout tone="info" className="mt-3" title={t("readOnly")} /> : null}
      </Section>

      {shown ? (
        <>
          <Callout
            tone={done ? "success" : "info"}
            live
            title={done ? t("doneTitle") : t("previewTitle")}
          >
            {t("summary", {
              considered: shown.considered,
              filled: shown.filled.length,
              refreshed: shown.refreshed.length,
              unchanged: shown.unchanged,
              business: shown.keptBusiness.length,
              empty: shown.incomplete.length,
            })}
          </Callout>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="fit-sources">
            {(["recipe", "standard_sizes", "production_envelope", "combined"] as const).map((s) => (
              <Stat key={s} label={t(`sources.${s}`)} value={shown.bySource[s]} />
            ))}
          </div>
          <Section title={t("changesTitle", { count: shown.changes.length })}>
            {shown.changes.length ? (
              <DataTable
                caption={t("changesTitle", { count: shown.changes.length })}
                columns={changeColumns}
                rows={shown.changes}
                getRowId={(row) => row.code}
              />
            ) : (
              <EmptyState title={t("noChanges")} />
            )}
          </Section>
          <Section title={t("incompleteTitle", { count: shown.incomplete.length })} description={t("incompleteIntro")}>
            {shown.incomplete.length ? (
              <DataTable
                caption={t("incompleteTitle", { count: shown.incomplete.length })}
                columns={incompleteColumns}
                rows={shown.incomplete}
                getRowId={(row) => row.code}
              />
            ) : (
              <EmptyState title={t("allComplete")} />
            )}
          </Section>
        </>
      ) : null}

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={t("confirmBody", { count: preview?.changes.length ?? 0 })}
        confirmLabel={t("confirm")}
        onConfirm={async () => {
          try {
            const result = await run(false);
            setDone(result);
            setConfirming(false);
            toast.success(t("done", { count: result.filled.length + result.refreshed.length }));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "style") });
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
          }
        }}
      />
    </div>
  );
}
