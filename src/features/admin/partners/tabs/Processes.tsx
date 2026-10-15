"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, useCan } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { useFactoryPart, useFactoryRefresh } from "../hooks";
import { FormDialog, FormError, Section } from "../parts";
import type { Factory } from "../resources";

type Capability = Schemas["ProcessCapabilityDto"];
type Status = Schemas["ProcessCapabilityStatus"];

/** The style library's material classes (D-243). */
const MATERIAL_CLASSES = [
  "paper",
  "paperboard",
  "food_board",
  "corrugated",
  "rigid",
  "label_stock",
  "flexible",
  "shrink_film",
] as const;
const TONE: Record<Status, "warning" | "success" | "danger" | "neutral"> = {
  proposed: "warning",
  verified: "success",
  rejected: "danger",
  withdrawn: "neutral",
  superseded: "neutral",
};

const EMPTY = {
  processCode: "",
  materialClass: "paperboard",
  minBlankWMm: "",
  minBlankLMm: "",
  maxBlankWMm: "",
  maxBlankLMm: "",
  maxCaliperMm: "",
  minRun: "",
  leadTimeMinDays: "",
  leadTimeMaxDays: "",
  note: "",
};

/**
 * What a factory's processes can do, per process × material class (D-244): blank sizes, caliper,
 * minimum run and the lead-time band. A proposal counts only once the Partner Manager verifies it
 * against a passing site visit of the factory — not the person who proposed it — and only
 * verified rows make a style makeable (D-243). Staff propose on the factory's behalf too.
 */
export function Processes({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.processes");
  const tStyles = useTranslations("styles");
  const format = useFormat();
  const locale = useLocale();
  const nameOf = (ref: { nameTh: string; nameEn: string }) => (locale === "en" ? ref.nameEn : ref.nameTh);
  const canManage = useCan("partners.manage");
  const refresh = useFactoryRefresh(factory.id);
  const [status, setStatus] = useState<Status | "all">("all");
  const list = useFactoryPart(
    factory.id,
    "/v1/admin/factories/{factoryId}/process-capabilities",
    status === "all" ? undefined : { status },
  );
  const visits = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/site-visits");
  const processes = useQuery({
    queryKey: queryKeys.list("admin", "process_type", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/process-types")).data!,
  });
  const [proposing, setProposing] = useState<typeof EMPTY | null>(null);
  const [deciding, setDeciding] = useState<{ kind: "verify" | "reject" | "withdraw"; row: Capability } | null>(null);
  const [visitId, setVisitId] = useState("");
  const passing = (visits.data ?? []).filter((v) => v.result === "pass");
  const mm = (value: number | null) => (value === null ? "–" : format.number(value));
  const materialName = (code: string) =>
    tStyles.has(`materialClasses.${code}`) ? tStyles(`materialClasses.${code}`) : code;

  const columns: DataTableColumn<Capability>[] = [
    {
      id: "process",
      header: t("process"),
      cell: (row) => (
        <div>
          <p className="font-medium">{nameOf(row.process)}</p>
          <p className="text-muted font-mono text-xs">{row.process.code}</p>
        </div>
      ),
    },
    { id: "material", header: t("materialClass"), cell: (row) => materialName(row.materialClass) },
    {
      id: "blank",
      header: t("blank"),
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {t("blankRange", {
            minW: mm(row.minBlankWMm),
            minL: mm(row.minBlankLMm),
            maxW: mm(row.maxBlankWMm),
            maxL: mm(row.maxBlankLMm),
          })}
        </span>
      ),
    },
    { id: "caliper", header: t("caliper"), numeric: true, cell: (row) => mm(row.maxCaliperMm) },
    {
      id: "minRun",
      header: t("minRun"),
      numeric: true,
      cell: (row) => (row.minRun === null ? "–" : format.number(row.minRun)),
    },
    {
      id: "lead",
      header: t("leadTime"),
      cell: (row) => t("days", { min: row.leadTimeMinDays, max: row.leadTimeMaxDays }),
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <div>
          <Badge size="sm" tone={TONE[row.status]}>
            {t(`statuses.${row.status}`)}
          </Badge>
          {row.decisionNote ? <p className="text-muted mt-1 text-xs">{row.decisionNote}</p> : null}
          <p className="text-muted text-xs">
            <When at={row.verifiedAt ?? row.decidedAt ?? row.proposedAt} />
          </p>
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Capability) => (
              <span className="flex flex-wrap gap-1">
                {row.status === "proposed" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setVisitId(passing[0]?.id ?? "");
                        setDeciding({ kind: "verify", row });
                      }}
                    >
                      {t("verify")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeciding({ kind: "reject", row })}>
                      {t("reject")}
                    </Button>
                  </>
                ) : null}
                {row.status === "proposed" || row.status === "verified" ? (
                  <Button size="sm" variant="ghost" onClick={() => setDeciding({ kind: "withdraw", row })}>
                    {t("withdraw")}
                  </Button>
                ) : null}
              </span>
            ),
          } satisfies DataTableColumn<Capability>,
        ]
      : []),
  ];

  const num = (value: string) => (value.trim() === "" ? undefined : Number(value));
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("title")}
        description={t("intro")}
        actions={
          canManage ? (
            <Button size="sm" iconStart="plus" onClick={() => setProposing(EMPTY)}>
              {t("propose")}
            </Button>
          ) : null
        }
      >
        <SegmentedControl
          label={t("status")}
          value={status}
          onValueChange={(value) => setStatus(value as Status | "all")}
          options={[
            { value: "all", label: t("all") },
            ...(["proposed", "verified", "rejected", "withdrawn"] as const).map((s) => ({
              value: s,
              label: t(`statuses.${s}`),
            })),
          ]}
        />
        <div className="mt-3">
          <DataTable
            caption={t("title")}
            columns={columns}
            rows={list.data ?? []}
            getRowId={(row) => row.id}
            loading={list.isPending}
            rowTone={(row) => (row.status === "proposed" ? "warning" : undefined)}
            empty={<EmptyState icon="factory" title={t("empty")} />}
          />
        </div>
      </Section>

      {proposing ? (
        <FormDialog
          size="lg"
          title={t("proposeTitle", { code: factory.code })}
          description={t("proposeIntro")}
          submitLabel={t("propose")}
          onClose={() => setProposing(null)}
          onSubmit={async () => {
            const min = Number(proposing.leadTimeMinDays);
            const max = Number(proposing.leadTimeMaxDays);
            if (!proposing.processCode || !(min >= 0) || !(max >= min) || proposing.leadTimeMaxDays.trim() === "")
              throw new FormError(t("incomplete"));
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/process-capabilities", {
              params: { path: { factoryId: factory.id } },
              body: {
                processCode: proposing.processCode,
                materialClass: proposing.materialClass,
                leadTimeMinDays: min,
                leadTimeMaxDays: max,
                minBlankWMm: num(proposing.minBlankWMm),
                minBlankLMm: num(proposing.minBlankLMm),
                maxBlankWMm: num(proposing.maxBlankWMm),
                maxBlankLMm: num(proposing.maxBlankLMm),
                maxCaliperMm: num(proposing.maxCaliperMm),
                minRun: num(proposing.minRun),
                ...(proposing.note.trim() ? { note: proposing.note.trim() } : {}),
              },
            });
            toast.success(t("proposed"));
            refresh();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("process")} required>
              <SearchableSelect
                value={proposing.processCode || undefined}
                placeholder={t("chooseProcess")}
                onValueChange={(processCode) => setProposing({ ...proposing, processCode })}
                options={(processes.data ?? []).map((p) => ({ value: p.code, label: `${nameOf(p)} (${p.code})` }))}
              />
            </Field>
            <Field label={t("materialClass")} required>
              <SearchableSelect
                value={proposing.materialClass}
                onValueChange={(materialClass) => setProposing({ ...proposing, materialClass })}
                options={MATERIAL_CLASSES.map((code) => ({ value: code, label: materialName(code) }))}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {(["minBlankWMm", "minBlankLMm", "maxBlankWMm", "maxBlankLMm"] as const).map((key) => (
              <Field key={key} label={t(key)}>
                <NumberInput
                  unit="mm"
                  min={0}
                  value={proposing[key]}
                  onChange={(e) => setProposing({ ...proposing, [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t("caliper")}>
              <NumberInput
                unit="mm"
                min={0}
                step="0.01"
                value={proposing.maxCaliperMm}
                onChange={(e) => setProposing({ ...proposing, maxCaliperMm: e.target.value })}
              />
            </Field>
            <Field label={t("minRun")}>
              <NumberInput
                min={0}
                value={proposing.minRun}
                onChange={(e) => setProposing({ ...proposing, minRun: e.target.value })}
              />
            </Field>
            <Field label={t("leadMin")} required>
              <NumberInput
                min={0}
                value={proposing.leadTimeMinDays}
                onChange={(e) => setProposing({ ...proposing, leadTimeMinDays: e.target.value })}
              />
            </Field>
            <Field label={t("leadMax")} required>
              <NumberInput
                min={0}
                value={proposing.leadTimeMaxDays}
                onChange={(e) => setProposing({ ...proposing, leadTimeMaxDays: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("note")}>
            <Textarea
              rows={2}
              value={proposing.note}
              onChange={(e) => setProposing({ ...proposing, note: e.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}

      {deciding?.kind === "verify" ? (
        <FormDialog
          title={t("verifyTitle", { process: nameOf(deciding.row.process) })}
          description={t("verifyIntro")}
          submitLabel={t("verify")}
          onClose={() => setDeciding(null)}
          onSubmit={async () => {
            if (!visitId) throw new FormError(t("needVisit"));
            await adminBrowserApis().contract.POST(
              "/v1/admin/factories/{factoryId}/process-capabilities/{capabilityId}/actions/verify",
              {
                params: { path: { factoryId: factory.id, capabilityId: deciding.row.id } },
                body: { siteVisitId: visitId },
              },
            );
            toast.success(t("verified"));
            refresh();
          }}
        >
          {passing.length ? (
            <Field label={t("siteVisit")} required>
              <SearchableSelect
                value={visitId || undefined}
                onValueChange={setVisitId}
                options={passing.map((v) => ({ value: v.id, label: t("visitOn", { date: format.date(v.visitedOn) }) }))}
              />
            </Field>
          ) : (
            <Callout tone="warning" title={t("noPassingVisit")} />
          )}
        </FormDialog>
      ) : null}

      {deciding && deciding.kind !== "verify" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => !open && setDeciding(null)}
          title={t(`${deciding.kind}Title`, { process: nameOf(deciding.row.process) })}
          description={t(`${deciding.kind}Body`)}
          confirmLabel={t(deciding.kind)}
          tone="destructive"
          reason={{ label: t("reason"), required: deciding.kind === "reject", minLength: 3 }}
          onConfirm={async ({ reason }) => {
            const params = { path: { factoryId: factory.id, capabilityId: deciding.row.id } };
            try {
              if (deciding.kind === "reject")
                await adminBrowserApis().contract.POST(
                  "/v1/admin/factories/{factoryId}/process-capabilities/{capabilityId}/actions/reject",
                  { params, body: { note: reason } },
                );
              else
                await adminBrowserApis().contract.POST(
                  "/v1/admin/factories/{factoryId}/process-capabilities/{capabilityId}/actions/withdraw",
                  { params, body: reason ? { note: reason } : {} },
                );
              toast.success(t(deciding.kind === "reject" ? "rejected" : "withdrawn"));
              refresh();
              setDeciding(null);
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
