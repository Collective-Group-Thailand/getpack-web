"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ONBOARDING_STEP_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { QueryError, StatusChip, useCan } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { useFactoryPart, useFactoryRefresh } from "../hooks";
import { FormDialog, Section } from "../parts";
import type { Factory } from "../resources";

type Step = Schemas["OnboardingStepDto"];

/**
 * The thirteen onboarding steps (D-011, D-041): where each stands, and — in assisted onboarding
 * (D-100, D-171) — which Packio entered on the factory's behalf and whether the factory has
 * signed that off yet.
 */
export function Onboarding({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.onboarding");
  const tStatus = useTranslations("status");
  const canManage = useCan("partners.manage");
  const refresh = useFactoryRefresh(factory.id);
  const steps = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/onboarding-steps");
  const [editing, setEditing] = useState<Step | null>(null);
  const [status, setStatus] = useState<Step["status"]>("approved");
  const [notes, setNotes] = useState("");

  if (steps.isError) return <QueryError error={steps.error} onRetry={() => void steps.refetch()} />;

  const columns: DataTableColumn<Step>[] = [
    { id: "step", header: t("step"), cell: (row) => <span className="font-medium">{t(`steps.${row.step}`)}</span> },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={ONBOARDING_STEP_STATUS} value={row.status} />,
    },
    {
      id: "entered",
      header: t("entered"),
      cell: (row) =>
        row.enteredByStaff ? (
          row.factorySignedOffAt ? (
            <span className="text-sm">
              {t("signedOff")} <When at={row.factorySignedOffAt} />
            </span>
          ) : (
            <Badge tone="warning" size="sm">
              {t("awaitingSignOff")}
            </Badge>
          )
        ) : (
          <span className="text-muted text-sm">{t("byFactory")}</span>
        ),
    },
    {
      id: "completedAt",
      header: t("completed"),
      cell: (row) => (row.completedAt ? <When at={row.completedAt} /> : <span className="text-muted">–</span>),
    },
    {
      id: "notes",
      header: t("notes"),
      cell: (row) => <span className="block max-w-64 truncate">{row.notes ?? ""}</span>,
    },
    ...(canManage
      ? [
          {
            id: "update",
            header: <span className="sr-only">{t("update")}</span>,
            cell: (row: Step) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(row);
                  setStatus(row.status === "approved" ? "approved" : "in_progress");
                  setNotes(row.notes ?? "");
                }}
              >
                {t("updateStep", { step: t(`steps.${row.step}`) })}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Section title={t("title")} description={factory.onboardingMode === "assisted" ? t("assistedNote") : t("selfNote")}>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={steps.data ?? []}
        getRowId={(row) => row.step}
        loading={steps.isPending}
        density="compact"
      />
      {editing ? (
        <FormDialog
          title={t("updateTitle", { step: t(`steps.${editing.step}`) })}
          description={t("updateBody", { code: factory.code })}
          submitLabel={t("save")}
          onClose={() => setEditing(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.PATCH("/v1/admin/factories/{factoryId}/onboarding-steps/{step}", {
              params: { path: { factoryId: factory.id, step: editing.step } },
              body: { status, notes: notes.trim() || null },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("status")}>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as Step["status"])}
              options={(["pending", "in_progress", "submitted", "approved", "rejected", "waived"] as const).map(
                (value) => ({
                  value,
                  label: tStatus(ONBOARDING_STEP_STATUS[value].labelKey),
                }),
              )}
            />
          </Field>
          <Field label={t("notes")} hint={t("notesHint")}>
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </Section>
  );
}
