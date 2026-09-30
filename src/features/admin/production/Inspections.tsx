"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { INSPECTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
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
import { inspectionsList, type Inspection } from "../partners/resources";

type Grade = "critical" | "major" | "minor";

/**
 * A count from the inspection's accept or found map. CONTRACT-GAP admin.inspections — they are free
 * maps on the published `InspectionDto`, not typed `{critical, major, minor}` objects (U-B0.2).
 */
function countOf(map: Inspection["accept"] | null, grade: Grade): string {
  const value = map?.[grade];
  return typeof value === "number" ? String(value) : "–";
}

/**
 * Packio's risk-based QC inspections (D-076): why each job was selected, the ISO 2859-1 sample and
 * the accept numbers per defect class, and recording what was found — the API judges pass or fail
 * against those numbers; the result feeds the factory's scorecard.
 *
 * Not on the published inspection (CONTRACT-GAP admin.inspections): the order and product type,
 * the factory's name (its code only), the AQL per class and the inspector as a person.
 */
export function Inspections({ initial }: { initial: InitialPage<Inspection> | null }) {
  const t = useTranslations("production.inspections");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canInspect = useCan("inspections.perform");
  const queryClient = useQueryClient();
  const [recording, setRecording] = useState<Inspection | null>(null);
  const [found, setFound] = useState({ critical: "0", major: "0", minor: "0" });
  const [notes, setNotes] = useState("");

  const columns: DataTableColumn<Inspection>[] = [
    {
      id: "job",
      header: t("columns.job"),
      cell: (row) => (
        <div>
          <span className="font-mono">{row.jobNo}</span>
          <p className="text-muted text-xs">{row.factoryCode}</p>
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
          {row.inspector ? <span className="text-muted block text-xs">{row.inspector}</span> : null}
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
                    setRecording(row);
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
        ]}
        empty={{ title: t("empty") }}
      />
      <ConfirmAction
        open={recording !== null}
        onOpenChange={(open) => (open ? undefined : setRecording(null))}
        title={recording ? t("recordTitle", { job: recording.jobNo }) : ""}
        description={
          recording
            ? t("recordBody", {
                job: recording.jobNo,
                factory: recording.factoryCode,
                sample: recording.sampleSize,
                critical: countOf(recording.accept, "critical"),
                major: countOf(recording.accept, "major"),
                minor: countOf(recording.accept, "minor"),
              })
            : ""
        }
        confirmLabel={t("record")}
        onConfirm={async () => {
          if (!recording) return;
          try {
            // admin.inspections.record takes flat counts and declares no Idempotency-Key.
            const result = (
              await adminBrowserApis().contract.POST("/v1/admin/inspections/{inspectionId}/actions/record", {
                params: { path: { inspectionId: recording.id } },
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
