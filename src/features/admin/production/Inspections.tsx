"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { INSPECTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, ResourceList, StatusChip, useCan, type InitialPage } from "../console";
import { inspectionsList, type Inspection } from "../partners/resources";

/**
 * Packio's risk-based QC inspections (D-076): why each job was selected, the ISO 2859-1 sample and
 * the accept numbers per defect class, and recording what was found — the API judges pass or fail
 * against those numbers; the result feeds the factory's scorecard.
 */
export function Inspections({ initial }: { initial: InitialPage<Inspection> | null }) {
  const t = useTranslations("production.inspections");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canInspect = useCan("qc.inspect");
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
          <Link href={`/orders/${row.order.id}?tab=production`} className="text-primary font-mono hover:underline">
            {row.job.jobNo}
          </Link>
          <p className="text-muted text-xs">{row.factory.name}</p>
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
              critical: row.acceptNumbers.critical,
              major: row.acceptNumbers.major,
              minor: row.acceptNumbers.minor,
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
          ? t("foundValue", { critical: row.found.critical, major: row.found.major, minor: row.found.minor })
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
      cell: (row) =>
        row.resultAt ? <When at={row.resultAt} /> : row.scheduledAt ? <When at={row.scheduledAt} /> : "–",
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
                  {t("recordFor", { job: row.job.jobNo })}
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
        title={recording ? t("recordTitle", { job: recording.job.jobNo }) : ""}
        description={
          recording
            ? t("recordBody", {
                job: recording.job.jobNo,
                factory: recording.factory.name,
                sample: recording.sampleSize,
                critical: recording.acceptNumbers.critical,
                major: recording.acceptNumbers.major,
                minor: recording.acceptNumbers.minor,
              })
            : ""
        }
        confirmLabel={t("record")}
        onConfirm={async ({ idempotencyKey }) => {
          if (!recording) return;
          try {
            const result = await browserRequests().call("POST /v1/admin/inspections/{inspectionId}/actions/record", {
              path: { inspectionId: recording.id },
              body: {
                found: { critical: Number(found.critical), major: Number(found.major), minor: Number(found.minor) },
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              },
              idempotencyKey,
            });
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
