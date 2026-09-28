"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CLOSE_STATUS, CLOSE_TASK_STATUS, PERIOD_STATUS } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat, When } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DataTable } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import { useActor, useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { FormDialog, FormError, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { StatusChip } from "../console/StatusChip";
import { useFiscalYears } from "./ledger";

type Checklist = Schemas["CloseChecklistDto"];
type Task = Schemas["CloseTaskDto"];

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/** Where the work of each step is done — the checklist records it, the desks do it. */
const WORK_HREF: Record<Schemas["CloseTaskKey"], (month: string) => string | null> = {
  statements_imported: () => "/finance/banking/lines",
  slips_and_unidentified: () => "/finance/slips",
  deliveries_received: () => "/finance/payables/goods-receipts",
  receivables_reviewed: () => "/finance/receivables/aging",
  rollforwards_reviewed: (month) => `/finance/reports/roll-forwards?to=${month}`,
  accruals_recorded: () => "/finance/ledger/journals?status=pending_approval",
  tax_papers_reconciled: (month) => `/finance/tax?period=${month}`,
  subledgers_reconciled: (month) => `/finance/reports/reconciliation?period=${month}`,
  review: () => null,
};

/** The months of the year and where each one's close stands (§7). */
export function CloseIndex() {
  const t = useTranslations("finance.close.index");
  const format = useFormat();
  const years = useFiscalYears();
  if (years.isError) return <QueryError error={years.error} onRetry={() => void years.refetch()} />;
  const today = bangkokToday();
  return (
    <>
      {(years.data ?? []).map((year) => (
        <Section key={year.id} title={t("year", { label: year.label })} description={t("description")}>
          <DataTable
            caption={t("year", { label: year.label })}
            rows={year.periods.filter((period) => period.startDate <= today)}
            getRowId={(row) => row.id}
            density="compact"
            columns={[
              {
                id: "month",
                header: t("month"),
                cell: (row) => (
                  <Link href={`/finance/close/${row.startDate.slice(0, 7)}`} className="text-primary hover:underline">
                    {format.date(row.startDate, { style: "month" })}
                  </Link>
                ),
              },
              {
                id: "status",
                header: t("period"),
                cell: (row) => <StatusChip map={PERIOD_STATUS} value={row.status} />,
              },
              { id: "changed", header: t("changedAt"), cell: (row) => <When at={row.statusChangedAt} absoluteOnly /> },
            ]}
          />
        </Section>
      ))}
    </>
  );
}

/**
 * One month's close (§7): the nine steps with an owner each, the automatic checks that block a
 * step until they pass, the evidence behind each review, then submit → a Finance Manager other
 * than the submitter approves → closed → locked. The auditor signs the year end off.
 */
export function CloseChecklistView({ month }: { month: string }) {
  const t = useTranslations("finance.close");
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  const canManage = useCan("close.manage");
  const canApprove = useCan("close.approve");
  const canSignOff = useCan("close.audit_sign_off");
  const [action, setAction] = useState<"submit" | "approve" | "return" | "lock" | "signOff" | null>(null);
  const [starting, setStarting] = useState(false);
  const key = queryKeys.detail("admin", "close-checklist", month);
  const checklist = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/close-checklists/{period}", {
          params: { path: { period: month } },
        })
      ).data!,
    retry: false,
  });
  const monthLabel = format.date(`${month}-01`, { style: "month" });
  const refresh = (updated?: Checklist) => {
    if (updated) queryClient.setQueryData(key, updated);
    for (const resource of ["close-checklist", "fiscal-year"])
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
  };
  const header = (data?: Checklist) => (
    <PageHeader
      breadcrumbs={
        <Breadcrumbs
          label={t("breadcrumb")}
          items={[{ label: t("title"), href: "/finance/close" }, { label: monthLabel }]}
        />
      }
      title={t("checklistTitle", { month: monthLabel })}
      description={t("description")}
      meta={
        data ? (
          <>
            <StatusChip map={CLOSE_STATUS} value={data.status} size="md" />
            <span className="text-muted flex items-center gap-1 text-sm">
              {t("periodIs")} <StatusChip map={PERIOD_STATUS} value={data.periodStatus} />
            </span>
          </>
        ) : null
      }
      actions={data ? checklistActions(data) : null}
    />
  );

  if (checklist.isError && !(isApiError(checklist.error) && checklist.error.status === 404))
    return <QueryError error={checklist.error} onRetry={() => void checklist.refetch()} />;
  if (checklist.isError)
    return (
      <div className="flex flex-col gap-5">
        {header()}
        <EmptyState
          icon="checklist"
          title={t("notStarted")}
          description={t("notStartedBody")}
          action={
            canManage ? (
              <Button
                loading={starting}
                onClick={async () => {
                  setStarting(true);
                  try {
                    const { data } = await adminBrowserApis().contract.POST("/v1/admin/close-checklists/{period}", {
                      params: { path: { period: month }, header: { "Idempotency-Key": crypto.randomUUID() } },
                    });
                    queryClient.setQueryData(key, data);
                    void checklist.refetch();
                  } catch (error) {
                    toast.error(problemMessage(error, t("failed")));
                  } finally {
                    setStarting(false);
                  }
                }}
              >
                {t("start")}
              </Button>
            ) : null
          }
        />
      </div>
    );
  const data = checklist.data;
  if (!data) return null;
  const submitterIsMe = data.submittedBy?.id === actor.id;
  const remaining = data.tasks.filter((task) => task.key !== "review" && !["done", "waived"].includes(task.status));

  return (
    <div className="flex flex-col gap-5">
      {header(data)}
      {data.status === "open" && remaining.length ? (
        <Callout tone="info" title={t("remainingTitle", { count: remaining.length })}>
          {t("remainingBody")}
        </Callout>
      ) : null}
      {data.status === "in_review" ? (
        <Callout tone="warning" title={t("inReviewTitle")}>
          {submitterIsMe
            ? t("inReviewMine")
            : t("inReviewBody", { name: data.submittedBy?.name ?? "", at: format.dateTime(data.submittedAt) })}
        </Callout>
      ) : null}
      {data.status === "closed" ? (
        <Callout tone="success" title={t("closedTitle")}>
          {t("closedBody", { name: data.closedBy?.name ?? "", at: format.dateTime(data.closedAt) })}
          {data.auditorSignedOffAt ? ` ${t("signedOff", { at: format.dateTime(data.auditorSignedOffAt) })}` : ""}
        </Callout>
      ) : null}
      {data.status === "locked" ? (
        <Callout tone="neutral" title={t("lockedTitle")}>
          {t("lockedBody")}
        </Callout>
      ) : null}

      <ol className="flex flex-col gap-3">
        {data.tasks.map((task) => (
          <li key={task.id}>
            <TaskCard checklist={data} task={task} onChange={refresh} />
          </li>
        ))}
      </ol>

      {action === "submit" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("submitTitle", { month: monthLabel })}
          description={t("submitBody")}
          confirmLabel={t("submit")}
          onConfirm={({ idempotencyKey }) => run("submit", idempotencyKey)}
        />
      ) : null}
      {action === "approve" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("approveTitle", { month: monthLabel })}
          description={t("approveBody")}
          confirmLabel={t("approve")}
          confirmationPhrase={month}
          reason={{ label: t("note"), required: false }}
          onConfirm={({ idempotencyKey, reason }) => run("approve", idempotencyKey, reason)}
        />
      ) : null}
      {action === "return" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("returnTitle")}
          description={t("returnBody")}
          confirmLabel={t("return")}
          tone="destructive"
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={({ idempotencyKey, reason }) => run("return", idempotencyKey, reason)}
        />
      ) : null}
      {action === "lock" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("lockTitle", { month: monthLabel })}
          description={t("lockBody")}
          confirmLabel={t("lock")}
          tone="destructive"
          confirmationPhrase={month}
          onConfirm={({ idempotencyKey }) => run("lock", idempotencyKey)}
        />
      ) : null}
      {action === "signOff" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("signOffTitle", { month: monthLabel })}
          description={t("signOffBody")}
          confirmLabel={t("signOff")}
          confirmationPhrase={month}
          onConfirm={({ idempotencyKey }) => run("sign-off", idempotencyKey)}
        />
      ) : null}
    </div>
  );

  async function run(
    step: "submit" | "approve" | "return" | "lock" | "sign-off",
    idempotencyKey: string,
    text?: string,
  ) {
    const params = { path: { period: month }, header: { "Idempotency-Key": idempotencyKey } };
    try {
      const api = adminBrowserApis().contract;
      const { data: updated } =
        step === "submit"
          ? await api.POST("/v1/admin/close-checklists/{period}/actions/submit", { params })
          : step === "approve"
            ? await api.POST("/v1/admin/close-checklists/{period}/actions/approve", {
                params,
                body: { note: text || null },
              })
            : step === "return"
              ? await api.POST("/v1/admin/close-checklists/{period}/actions/return", {
                  params,
                  body: { reason: text ?? "" },
                })
              : step === "lock"
                ? await api.POST("/v1/admin/close-checklists/{period}/actions/lock", { params })
                : await api.POST("/v1/admin/close-checklists/{period}/actions/sign-off", { params });
      refresh(updated);
      toast.success(t(`done.${step}`));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
      throw error;
    }
  }

  function checklistActions(data: Checklist) {
    const mine = data.submittedBy?.id === actor.id;
    const onAction = setAction;
    return (
      <>
        {canManage && data.status === "open" ? (
          <Button disabled={remaining.length > 0} onClick={() => onAction("submit")}>
            {t("submit")}
          </Button>
        ) : null}
        {canApprove && data.status === "in_review" ? (
          <>
            <Button variant="ghost" onClick={() => onAction("return")}>
              {t("return")}
            </Button>
            <Button disabled={mine} title={mine ? t("ownSubmission") : undefined} onClick={() => onAction("approve")}>
              {t("approve")}
            </Button>
          </>
        ) : null}
        {canSignOff && data.status === "closed" && !data.auditorSignedOffAt ? (
          <Button variant="secondary" onClick={() => onAction("signOff")}>
            {t("signOff")}
          </Button>
        ) : null}
        {canApprove && data.status === "closed" ? (
          <Button variant="secondary" iconStart="lock" onClick={() => onAction("lock")}>
            {t("lock")}
          </Button>
        ) : null}
      </>
    );
  }
}

/** One step: what it checks, its owner, the check's result, the evidence and the note. */
function TaskCard({
  checklist,
  task,
  onChange,
}: {
  checklist: Checklist;
  task: Task;
  onChange: (c?: Checklist) => void;
}) {
  const t = useTranslations("finance.close.task");
  const tSteps = useTranslations("finance.close.steps");
  const format = useFormat();
  const actor = useActor();
  const canManage = useCan("close.manage");
  const canApprove = useCan("close.approve");
  const [dialog, setDialog] = useState<"complete" | "waive" | "evidence" | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = checklist.status === "open" && task.key !== "review" && !["done", "waived"].includes(task.status);
  const href = WORK_HREF[task.key](checklist.period);
  const path = { period: checklist.period, taskKey: task.key };

  async function act(kind: "check" | "assign") {
    setBusy(true);
    try {
      const params = { path, header: { "Idempotency-Key": crypto.randomUUID() } };
      const { data } =
        kind === "check"
          ? await adminBrowserApis().contract.POST(
              "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/check",
              { params },
            )
          : await adminBrowserApis().contract.POST(
              "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/assign",
              {
                params,
                body: { ownerUserId: actor.id },
              },
            );
      onChange(data);
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  const result = task.checkResult;
  return (
    <Card as="section" padding="lg" aria-labelledby={`task-${task.key}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`task-${task.key}`} className="flex flex-wrap items-center gap-2 text-base font-semibold">
            <span className="text-muted tabular-nums">{t("step", { no: task.stepNo })}</span>
            {tSteps(`${task.key}.title`)}
            <StatusChip map={CLOSE_TASK_STATUS} value={task.status} />
            {task.automatic ? <span className="text-muted text-xs font-normal">{t("automatic")}</span> : null}
          </h2>
          <p className="text-muted mt-1 text-sm">{tSteps(`${task.key}.body`)}</p>
          <p className="mt-2 text-sm">
            {t("owner")}: {task.owner?.name ?? t("noOwner")}
            {task.completedBy
              ? ` · ${t("completedBy", { name: task.completedBy.name, at: format.dateTime(task.completedAt) })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {href ? (
            <Button asChild variant="ghost" size="sm" iconEnd="arrow-right">
              <Link href={href}>{t("goToWork")}</Link>
            </Button>
          ) : null}
          {canManage && editable && task.owner?.id !== actor.id ? (
            <Button variant="ghost" size="sm" loading={busy} onClick={() => void act("assign")}>
              {t("takeIt")}
            </Button>
          ) : null}
          {canManage && editable && task.automatic ? (
            <Button variant="secondary" size="sm" iconStart="refresh" loading={busy} onClick={() => void act("check")}>
              {t("runCheck")}
            </Button>
          ) : null}
          {canManage && editable ? (
            <Button variant="secondary" size="sm" iconStart="paperclip" onClick={() => setDialog("evidence")}>
              {t("addEvidence")}
            </Button>
          ) : null}
          {canApprove && editable ? (
            <Button variant="ghost" size="sm" onClick={() => setDialog("waive")}>
              {t("waive")}
            </Button>
          ) : null}
          {canManage && editable ? (
            <Button size="sm" onClick={() => setDialog("complete")}>
              {t("complete")}
            </Button>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="mt-3">
          <Callout
            tone={result.passed ? "success" : "danger"}
            title={result.passed ? t("checkPassed") : t("checkFailed")}
          >
            {result.summary}
            {task.checkedAt ? (
              <span className="text-muted block text-xs">
                {t("checkedAt", { at: format.dateTime(task.checkedAt) })}
              </span>
            ) : null}
          </Callout>
          {result.items.length ? (
            <DataTable
              className="mt-2"
              caption={t("items", { step: task.stepNo })}
              rows={result.items}
              getRowId={(row) => `${row.type}-${row.id ?? row.description}`}
              density="compact"
              columns={[
                {
                  id: "type",
                  header: t("itemType"),
                  cell: (row) => (t.has(`itemTypes.${row.type}`) ? t(`itemTypes.${row.type}`) : row.type),
                },
                { id: "description", header: t("itemDescription"), cell: (row) => row.description },
                { id: "date", header: t("itemDate"), cell: (row) => (row.date ? format.date(row.date) : "") },
                {
                  id: "amount",
                  header: t("itemAmount"),
                  numeric: true,
                  cell: (row) => (row.amount ? format.thb(row.amount) : ""),
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}
      {task.waivedReason ? (
        <p className="mt-3 text-sm">
          <span className="font-medium">{t("waivedBecause")}</span> {task.waivedReason}
        </p>
      ) : null}
      {task.note ? (
        <p className="mt-3 text-sm">
          <span className="font-medium">{t("noteLabel")}</span> {task.note}
        </p>
      ) : null}
      {task.evidence.length ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm" aria-label={t("evidence")}>
          {task.evidence.map((item) => (
            <li key={item.fileId} className="flex items-center gap-2">
              <span className="text-muted">{t("evidence")}:</span> {item.name}
            </li>
          ))}
        </ul>
      ) : null}

      {dialog === "complete" ? (
        <CompleteTask checklist={checklist} task={task} onClose={() => setDialog(null)} onDone={onChange} />
      ) : null}
      {dialog === "waive" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setDialog(null))}
          title={t("waiveTitle", { step: tSteps(`${task.key}.title`) })}
          description={t("waiveBody")}
          confirmLabel={t("waive")}
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              const { data } = await adminBrowserApis().contract.POST(
                "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/waive",
                { params: { path, header: { "Idempotency-Key": idempotencyKey } }, body: { reason } },
              );
              onChange(data);
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
      {dialog === "evidence" ? (
        <AddEvidence checklist={checklist} task={task} onClose={() => setDialog(null)} onDone={onChange} />
      ) : null}
    </Card>
  );
}

function CompleteTask({
  checklist,
  task,
  onClose,
  onDone,
}: {
  checklist: Checklist;
  task: Task;
  onClose: () => void;
  onDone: (c?: Checklist) => void;
}) {
  const t = useTranslations("finance.close.task");
  const tSteps = useTranslations("finance.close.steps");
  const [note, setNote] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <FormDialog
      title={t("completeTitle", { step: tSteps(`${task.key}.title`) })}
      description={task.automatic ? t("completeAutomatic") : t("completeReview")}
      submitLabel={t("complete")}
      onClose={onClose}
      onSubmit={async () => {
        const { data } = await adminBrowserApis().contract.POST(
          "/v1/admin/close-checklists/{period}/tasks/{taskKey}/actions/complete",
          {
            params: {
              path: { period: checklist.period, taskKey: task.key },
              header: { "Idempotency-Key": idempotencyKey },
            },
            body: { note: note.trim() || null },
          },
        );
        onDone(data);
      }}
    >
      <Field label={t("noteLabel")} hint={t("noteHint")}>
        <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

function AddEvidence({
  checklist,
  task,
  onClose,
  onDone,
}: {
  checklist: Checklist;
  task: Task;
  onClose: () => void;
  onDone: (c?: Checklist) => void;
}) {
  const t = useTranslations("finance.close.task");
  const tCommon = useTranslations("common");
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <FormDialog
      title={t("evidenceTitle")}
      description={t("evidenceBody")}
      submitLabel={t("attach")}
      onClose={onClose}
      onSubmit={async () => {
        if (!file) throw new FormError(t("pickFile"));
        if (!description.trim()) throw new FormError(t("describe"));
        const uploaded = await uploadFile("admin", file, "document");
        const { data } = await adminBrowserApis().contract.POST(
          "/v1/admin/close-checklists/{period}/tasks/{taskKey}/evidence",
          {
            params: {
              path: { period: checklist.period, taskKey: task.key },
              header: { "Idempotency-Key": idempotencyKey },
            },
            body: { fileId: uploaded.id, description: description.trim() },
          },
        );
        onDone(data);
      }}
    >
      <FileDropzone
        accept=".pdf,.xlsx,.csv,image/*"
        maxBytes={10 * 1024 * 1024}
        onFiles={(files) => setFile(files[0] ?? null)}
        labels={{
          prompt: file ? t("chosen", { name: file.name }) : t("drop"),
          browse: t("browse"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      <Field label={t("whatItShows")} required requiredLabel={tCommon("state.required")}>
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
    </FormDialog>
  );
}
