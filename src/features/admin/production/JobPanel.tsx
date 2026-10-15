"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, NextActionBar, useCan } from "../console";
import { FileList } from "../logistics/files";
import { useFactoryOptions } from "./factories";

type Job = Schemas["AdminJobDto"];
type Issue = Schemas["JobIssueDto"];
type Qc = Schemas["QcCheckDto"];
type Verb = "hold" | "resume" | "reassign";
const SUPPORTED = new Set<string>(["hold", "resume", "reassign"]);
const QC_TONE: Record<Qc["result"], "success" | "danger" | "warning"> = {
  pass: "success",
  fail: "danger",
  conditional: "warning",
};

/**
 * What staff do on one production job (D-074, D-076, D-012): put it on hold with a reason the
 * factory sees and resume it, move a released or rejected job to another factory (its own buy
 * price, the customer's never changes, only above the margin floor), answer the issues the factory
 * raised, and read its QC checks with their photos. Actions come from the job's `nextActions`.
 */
export function JobPanel({ job }: { job: Job }) {
  const t = useTranslations("production.job");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("production.manage");
  const factories = useFactoryOptions();
  const [dialog, setDialog] = useState<{ verb: Verb; key: string } | null>(null);
  const [text, setText] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [resolving, setResolving] = useState<Issue | null>(null);
  const issues = useQuery({
    queryKey: queryKeys.related("admin", "production_job", job.id, "issues"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/production-jobs/{jobId}/issues", {
          params: { path: { jobId: job.id } },
        })
      ).data!,
  });
  const qc = useQuery({
    queryKey: queryKeys.related("admin", "production_job", job.id, "qc-checks"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/production-jobs/{jobId}/qc-checks", {
          params: { path: { jobId: job.id } },
        })
      ).data!,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "production_job") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const actions = job.nextActions.filter((action) => SUPPORTED.has(action.key.replace(/^job\./, "")));
  const open = issues.data?.filter((issue) => issue.status === "open") ?? [];

  return (
    <div className="flex flex-col gap-4">
      {job.status === "on_hold" && job.holdReason ? (
        <Callout tone="warning" icon="pause" title={t("onHold")}>
          {job.holdReason}
        </Callout>
      ) : null}
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          <NextActionBar
            actions={actions}
            supported={SUPPORTED}
            labelOf={(verb) => (t.has(`verbs.${verb}`) ? t(`verbs.${verb}`) : undefined)}
            onAction={(verb) => {
              setText("");
              setFactoryId("");
              setDialog({ verb: verb as Verb, key: newIdempotencyKey() });
            }}
          />
        </div>
      ) : null}

      <section aria-labelledby={`issues-${job.id}`}>
        <h3 id={`issues-${job.id}`} className="mb-2 text-sm font-semibold">
          {t("issues", { open: open.length })}
        </h3>
        {issues.data?.length ? (
          <ul className="flex flex-col gap-2">
            {issues.data.map((issue) => (
              <li key={issue.id} className="border-border rounded-control border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge size="sm" tone={issue.status === "open" ? "warning" : "neutral"}>
                    {t(`issueStatus.${issue.status}`)}
                  </Badge>
                  <span className="font-medium">
                    {t.has(`kinds.${issue.kind}`) ? t(`kinds.${issue.kind}`) : issue.kind}
                  </span>
                  <span className="text-muted text-xs">
                    {issue.raisedBy?.displayName ?? "—"} · <When at={issue.createdAt} />
                  </span>
                  {canManage && issue.status === "open" ? (
                    <Button size="sm" variant="secondary" className="ms-auto" onClick={() => setResolving(issue)}>
                      {t("resolve")}
                    </Button>
                  ) : null}
                </p>
                <p className="mt-1 whitespace-pre-line">{issue.description}</p>
                {issue.photoFileIds.length ? <FileList fileIds={issue.photoFileIds} label={t("photos")} /> : null}
                {issue.resolutionNote ? (
                  <p className="text-muted border-border mt-2 border-s-2 ps-2 text-xs">
                    {issue.resolutionNote} — {issue.resolvedBy?.displayName ?? ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{issues.isPending ? t("loading") : t("noIssues")}</p>
        )}
      </section>

      <section aria-labelledby={`qc-${job.id}`}>
        <h3 id={`qc-${job.id}`} className="mb-2 text-sm font-semibold">
          {t("qcChecks")}
        </h3>
        {qc.data?.length ? (
          <ul className="flex flex-col gap-2">
            {qc.data.map((check) => (
              <li key={check.id} className="border-border rounded-control border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge size="sm" tone={QC_TONE[check.result]}>
                    {t(`qcResult.${check.result}`)}
                  </Badge>
                  {check.isFirstPass ? (
                    <Badge size="sm" tone="success">
                      {t("firstPass")}
                    </Badge>
                  ) : null}
                  <span className="text-muted text-xs">
                    {check.performedBy?.displayName ?? "—"} · <When at={check.performedAt} />
                  </span>
                </p>
                {check.quantityChecked !== null ? (
                  <p className="mt-1">
                    {t("checked", {
                      checked: format.number(check.quantityChecked),
                      defective: format.number(check.quantityDefective ?? 0),
                    })}
                  </p>
                ) : null}
                {check.defects.length ? (
                  <p className="text-muted text-xs">{t("defects", { count: check.defects.length })}</p>
                ) : null}
                {check.note ? <p className="text-muted mt-1 text-xs">{check.note}</p> : null}
                {check.photoFileIds.length ? <FileList fileIds={check.photoFileIds} label={t("photos")} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{qc.isPending ? t("loading") : t("noQc")}</p>
        )}
      </section>

      {dialog ? (
        <FormDialog
          title={t(`dialogs.${dialog.verb}.title`, { jobNo: job.jobNo })}
          description={t(`dialogs.${dialog.verb}.body`)}
          submitLabel={t(`verbs.${dialog.verb}`)}
          destructive={dialog.verb === "hold"}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            const params = { path: { jobId: job.id } };
            if (dialog.verb === "hold") {
              if (text.trim().length < 3) throw new FormError(t("reasonRequired"));
              await adminBrowserApis().contract.POST("/v1/admin/production-jobs/{jobId}/actions/hold", {
                params,
                body: { reason: text.trim() },
              });
            } else if (dialog.verb === "resume") {
              await adminBrowserApis().contract.POST("/v1/admin/production-jobs/{jobId}/actions/resume", { params });
            } else {
              if (!factoryId || factoryId === job.factoryId) throw new FormError(t("chooseOther"));
              if (text.trim().length < 3) throw new FormError(t("reasonRequired"));
              await adminBrowserApis().contract.POST("/v1/admin/production-jobs/{jobId}/actions/reassign", {
                params,
                body: { factoryId, note: text.trim() },
              });
            }
            toast.success(t(`dialogs.${dialog.verb}.done`));
            refresh();
          }}
        >
          {dialog.verb === "reassign" ? (
            <Field label={t("toFactory")} required>
              <SearchableSelect
                value={factoryId || undefined}
                placeholder={t("chooseFactory")}
                onValueChange={setFactoryId}
                options={factories.filter((f) => f.value !== job.factoryId)}
              />
            </Field>
          ) : null}
          {dialog.verb !== "resume" ? (
            <Field label={t(dialog.verb === "hold" ? "holdReason" : "reassignNote")} required>
              <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          ) : null}
        </FormDialog>
      ) : null}

      {resolving ? (
        <FormDialog
          title={t("resolveTitle", { jobNo: job.jobNo })}
          description={resolving.description}
          submitLabel={t("resolve")}
          onClose={() => setResolving(null)}
          onSubmit={async () => {
            if (text.trim().length < 3) throw new FormError(t("noteRequired"));
            await adminBrowserApis().contract.POST("/v1/admin/job-issues/{issueId}/actions/resolve", {
              params: { path: { issueId: resolving.id } },
              body: { note: text.trim() },
            });
            toast.success(t("resolved"));
            void queryClient.invalidateQueries({
              queryKey: queryKeys.related("admin", "production_job", job.id, "issues"),
            });
            setText("");
          }}
        >
          <Field label={t("resolutionNote")} hint={t("resolutionHint")} required>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
