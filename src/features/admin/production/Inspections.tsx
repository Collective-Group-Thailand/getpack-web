"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { INSPECTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  problemMessage,
  ResourceList,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { useProductTypes } from "../console/useProductTypes";
import { inspectionsList, type Inspection } from "../partners/resources";
import { useFactoryOptions } from "./factories";

type Grade = "critical" | "major" | "minor";

/** A count from the inspection's typed accept or found numbers. */
const countOf = (counts: Inspection["accept"] | null, grade: Grade): string => (counts ? String(counts[grade]) : "–");

/**
 * Packio's risk-based QC inspections (D-076): the job, its order and product type, why it was
 * selected, the ISO 2859-1 sample with the AQL and accept numbers per defect class, the scheduled
 * inspector, and recording what was found — the API judges pass or fail against those numbers;
 * the result feeds the factory's scorecard. Filtered by status and factory.
 *
 * CONTRACT-GAP admin.inspections — the inspection names its factory by code only.
 */
export function Inspections({ initial }: { initial: InitialPage<Inspection> | null }) {
  const t = useTranslations("production.inspections");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canInspect = useCan("inspections.perform");
  const queryClient = useQueryClient();
  const factories = useFactoryOptions();
  const productTypes = useProductTypes();
  const [recording, setRecording] = useState<{ row: Inspection; key: string } | null>(null);
  const [found, setFound] = useState({ critical: "0", major: "0", minor: "0" });
  const [notes, setNotes] = useState("");

  const columns: DataTableColumn<Inspection>[] = [
    {
      id: "job",
      header: t("columns.job"),
      cell: (row) => (
        <div>
          <span className="font-mono">{row.jobNo}</span>
          <p className="text-xs">
            <Link href={`/orders/${row.orderId}?tab=production`} className="text-primary font-mono hover:underline">
              {row.orderCode}
            </Link>
          </p>
          <p className="text-muted text-xs">
            {row.factoryCode} · {productTypes.labelOf(row.productTypeCode)}
          </p>
        </div>
      ),
    },
    {
      id: "reasons",
      header: t("columns.reasons"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.reasons.map((reason) => (
            <Badge key={reason} size="sm">
              {t(`reasons.${reason}`)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "sample",
      header: t("columns.sample"),
      cell: (row) => (
        <span className="text-sm">
          {t("sample", { sample: format.number(row.sampleSize), lot: format.number(row.lotSize) })}
          <span className="text-muted block text-xs">
            {t("aql", { critical: row.aql.critical, major: row.aql.major, minor: row.aql.minor })}
          </span>
          <span className="text-muted block text-xs">
            {t("accept", {
              critical: countOf(row.accept, "critical"),
              major: countOf(row.accept, "major"),
              minor: countOf(row.accept, "minor"),
            })}
          </span>
        </span>
      ),
    },
    {
      id: "found",
      header: t("columns.found"),
      cell: (row) =>
        row.found
          ? t("foundValue", {
              critical: countOf(row.found, "critical"),
              major: countOf(row.found, "major"),
              minor: countOf(row.found, "minor"),
            })
          : "–",
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={INSPECTION_STATUS} value={row.status} />,
    },
    {
      id: "when",
      header: t("columns.when"),
      cell: (row) => (
        <span className="text-sm">
          {row.resultAt ? <When at={row.resultAt} /> : row.scheduledAt ? <When at={row.scheduledAt} /> : "–"}
          {row.inspectorUser || row.inspector ? (
            <span className="text-muted block text-xs">{row.inspectorUser?.displayName ?? row.inspector}</span>
          ) : null}
        </span>
      ),
    },
    ...(canInspect
      ? [
          {
            id: "record",
            header: <span className="sr-only">{t("record")}</span>,
            cell: (row: Inspection) =>
              ["planned", "in_progress"].includes(row.status) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFound({ critical: "0", major: "0", minor: "0" });
                    setNotes("");
                    setRecording({ row, key: newIdempotencyKey() });
                  }}
                >
                  {t("recordFor", { job: row.jobNo })}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <>
      <ResourceList
        resource={inspectionsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: Object.entries(INSPECTION_STATUS).map(([value, meta]) => ({
              value,
              label: tStatus(meta.labelKey),
            })),
          },
          ...(factories.length
            ? [{ id: "factoryId", label: t("columns.factory"), kind: "select" as const, options: factories }]
            : []),
        ]}
        empty={{ title: t("empty") }}
      />
      <ConfirmAction
        open={recording !== null}
        onOpenChange={(open) => (open ? undefined : setRecording(null))}
        title={recording ? t("recordTitle", { job: recording.row.jobNo }) : ""}
        description={
          recording
            ? t("recordBody", {
                job: recording.row.jobNo,
                factory: recording.row.factoryCode,
                sample: recording.row.sampleSize,
                critical: countOf(recording.row.accept, "critical"),
                major: countOf(recording.row.accept, "major"),
                minor: countOf(recording.row.accept, "minor"),
              })
            : ""
        }
        confirmLabel={t("record")}
        onConfirm={async () => {
          if (!recording) return;
          try {
            // admin.inspections.record takes flat counts, and one key per intent (v0.5.0).
            const result = (
              await adminBrowserApis().contract.POST("/v1/admin/inspections/{inspectionId}/actions/record", {
                params: { path: { inspectionId: recording.row.id }, header: { "Idempotency-Key": recording.key } },
                body: {
                  foundCritical: Math.trunc(Number(found.critical) || 0),
                  foundMajor: Math.trunc(Number(found.major) || 0),
                  foundMinor: Math.trunc(Number(found.minor) || 0),
                  ...(notes.trim() ? { notes: notes.trim() } : {}),
                },
              })
            ).data!;
            toast.success(result.status === "passed" ? t("passed") : t("failed"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "inspection") });
          } catch (error) {
            toast.error(problemMessage(error, t("recordFailed")));
            throw error;
          }
        }}
      >
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(["critical", "major", "minor"] as const).map((grade) => (
            <Field key={grade} label={t(`grades.${grade}`)}>
              <NumberInput
                min={0}
                value={found[grade]}
                onChange={(event) => setFound({ ...found, [grade]: event.target.value })}
              />
            </Field>
          ))}
        </div>
        <Field label={t("notes")} className="mt-3">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </ConfirmAction>
    </>
  );
}
