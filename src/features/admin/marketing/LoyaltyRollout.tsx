"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  CohortLookup,
  LoyaltyRollout,
  RolloutGate,
  RolloutStage,
  RolloutTarget,
} from "@/features/shared/loyalty-p4/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, FormDialog, FormError, QueryError, useCan } from "../console";
import { useLoyaltyProblem } from "@/features/shared/loyalty-p4/useLoyaltyProblem";

export const ROLLOUT_STAGE_ORDER: readonly RolloutStage[] = ["internal", "uat", "percent", "all"];
const rolloutKey = queryKeys.list("admin", "loyalty_rollout", {});
const card = "border-border bg-surface rounded-panel border";

/** Whether `to` grows the cohort of `from` — the API's rule (a later stage, a higher percent, an added id). */
export function growsCohort(from: RolloutTarget, to: RolloutTarget): boolean {
  const order = (stage: RolloutStage) => ROLLOUT_STAGE_ORDER.indexOf(stage);
  if (order(to.stage) > order(from.stage)) return true;
  if (to.stage === from.stage && to.percent > from.percent) return true;
  return (
    to.allowlistCompanyIds.some((id) => !from.allowlistCompanyIds.includes(id)) ||
    to.allowlistUserIds.some((id) => !from.allowlistUserIds.includes(id))
  );
}

const targetOf = (rollout: LoyaltyRollout): RolloutTarget => ({
  stage: rollout.current.stage,
  percent: rollout.current.percent,
  allowlistCompanyIds: rollout.current.allowlistCompanyIds,
  allowlistUserIds: rollout.current.allowlistUserIds,
});

type Dialog = { kind: "advance" | "rollback"; target?: RolloutTarget } | null;

/**
 * `/marketing/loyalty/rollout` (loyalty P4, D-510; prototype `p4-admin-rollout.html`): the stage in force on a static
 * rail, the cohort, a pending advance, four advisory gate cards (they never block), the allowlists, the cohort lookup
 * for support and the last ten versions. "ขอเลื่อนขั้น" proposes a version for the Finance Manager's approval;
 * "ถอยกลับ" applies at once. The stage is edited only here (the settings screen shows it read-only).
 */
export function LoyaltyRolloutScreen() {
  const t = useTranslations("marketing.rollout");
  const canManage = useCan("loyalty.programme.manage");
  const [dialog, setDialog] = useState<Dialog>(null);
  const query = useQuery({
    queryKey: rolloutKey,
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/loyalty/rollout")).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton className="h-96 w-full" />;
  const data = query.data;
  const current = targetOf(data);
  const atAll = current.stage === "all";
  const atStart =
    current.stage === "internal" && current.allowlistCompanyIds.length + current.allowlistUserIds.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {canManage ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            iconStart="undo"
            disabled={atStart}
            onClick={() => setDialog({ kind: "rollback" })}
          >
            {t("rollback.action")}
          </Button>
          <Button
            iconStart="arrow-right"
            disabled={Boolean(data.pendingAdvance) || atAll}
            onClick={() => setDialog({ kind: "advance" })}
          >
            {t("advance.action")}
          </Button>
        </div>
      ) : null}
      <RolloutStageCard data={data} />
      {data.pendingAdvance ? <PendingAdvance data={data} /> : null}
      <section aria-labelledby="rollout-gates" className="flex flex-col gap-3">
        <h2 id="rollout-gates" className="text-lg font-semibold">
          {t("gates.title")} <span className="text-muted text-sm font-normal">{t("gates.note")}</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {data.gates.map((gate) => (
            <GateCard key={gate.metric} gate={gate} />
          ))}
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Allowlists
          data={data}
          canManage={canManage && !data.pendingAdvance}
          onAdd={(target) => setDialog({ kind: "advance", target })}
          onRemove={(target) => setDialog({ kind: "rollback", target })}
        />
        <CohortCheck />
      </div>
      <History data={data} />
      {dialog?.kind === "advance" ? (
        <AdvanceDialog current={current} preset={dialog.target} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "rollback" ? (
        <RollbackDialog current={current} preset={dialog.target} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

/** The stage rail and the cohort — shared with the story. */
export function RolloutStageCard({ data }: { data: LoyaltyRollout }) {
  const t = useTranslations("marketing.rollout");
  const format = useFormat();
  const index = ROLLOUT_STAGE_ORDER.indexOf(data.current.stage);
  const latest = data.history[0];
  return (
    <section aria-labelledby="rollout-stage" className={cn(card, "overflow-hidden")}>
      <div className="px-5 pt-4">
        <h2 id="rollout-stage" className="font-semibold">
          {t("stageTitle")}
        </h2>
        <p className="text-muted text-sm">
          {t("since", {
            stage: stageLabel(t, data.current.stage, data.current.percent),
            at: format.dateTime(data.current.effectiveFrom),
          })}
          {latest?.approvedBy ? ` · ${t("approvedBy", { name: latest.approvedBy.displayName })}` : null}
        </p>
      </div>
      <ol aria-label={t("stageTitle")} className="mt-4 grid grid-cols-2 md:grid-cols-4">
        {ROLLOUT_STAGE_ORDER.map((stage, at) => {
          const done = at < index;
          const now = at === index;
          return (
            <li
              key={stage}
              aria-current={now ? "step" : undefined}
              className={cn("border-t-[3px] px-5 pt-3 pb-4", done || now ? "border-primary" : "border-border")}
            >
              <span className="text-subtle text-xs tabular-nums">{at + 1}</span>
              <p
                className={cn(
                  "flex items-center gap-1.5 font-semibold",
                  now && "text-primary-subtle-fg",
                  !done && !now && "text-subtle",
                )}
              >
                {done ? <Icon name="check" size={16} aria-hidden="true" className="text-success" /> : null}
                {now ? stageLabel(t, stage, data.current.percent) : t(`stages.${stage}`)}
              </p>
              <p className={cn("text-sm", done || now ? "text-muted" : "text-subtle")}>{t(`stageNotes.${stage}`)}</p>
            </li>
          );
        })}
      </ol>
      <dl className="border-border grid border-t md:grid-cols-2">
        <div className="px-5 py-3.5">
          <dt className="sr-only">{t("cohort.companiesLabel")}</dt>
          <dd className="text-muted text-sm">
            <b className="text-fg me-1.5 text-[1.375rem] font-semibold tabular-nums">
              {format.number(data.cohort.companies)}
            </b>
            {t("cohort.companies", { total: format.number(data.cohort.companiesTotal) })}
          </dd>
        </div>
        <div className="border-border border-t px-5 py-3.5 md:border-s md:border-t-0">
          <dt className="sr-only">{t("cohort.usersLabel")}</dt>
          <dd className="text-muted text-sm">
            <b className="text-fg me-1.5 text-[1.375rem] font-semibold tabular-nums">
              {format.number(data.cohort.usersWithoutCompany)}
            </b>
            {t("cohort.users", { total: format.number(data.cohort.usersWithoutCompanyTotal) })}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function stageLabel(t: ReturnType<typeof useTranslations>, stage: RolloutStage, percent: number) {
  return stage === "percent" ? t("stages.percentOf", { percent }) : t(`stages.${stage}`);
}

function PendingAdvance({ data }: { data: LoyaltyRollout }) {
  const t = useTranslations("marketing.rollout.pending");
  const tRollout = useTranslations("marketing.rollout");
  const format = useFormat();
  const pending = data.pendingAdvance!;
  return (
    <section
      aria-labelledby="rollout-pending"
      className={cn(card, "border-s-primary flex flex-wrap items-start justify-between gap-3 border-s-[3px] px-5 py-4")}
    >
      <div className="min-w-0">
        <h2 id="rollout-pending" className="font-semibold">
          {t("title", { stage: stageLabel(tRollout, pending.target.stage, pending.target.percent) })}
        </h2>
        <p className="text-muted text-sm">
          {t("body", {
            name: pending.requestedBy?.displayName ?? t("unknownRequester"),
            at: format.dateTime(pending.requestedAt),
          })}
          {" · "}
          {pending.reason}
        </p>
      </div>
      <Link href={`/approvals/${pending.approvalId}`} className="text-primary text-sm font-medium hover:underline">
        {t("open")}
      </Link>
    </section>
  );
}

/** A gate: value, target with its window, and pass / attention / no data — advisory, never a block. */
export function GateCard({ gate }: { gate: RolloutGate }) {
  const t = useTranslations("marketing.rollout.gates");
  const format = useFormat();
  const money = gate.metric === "points_liability";
  const show = (value: string) => (money ? format.thb(value) : format.percent(value));
  return (
    <div className="border-border bg-surface rounded-card flex flex-col gap-1 border px-4 pt-3.5 pb-4">
      <p className="text-muted flex flex-col-reverse gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span>{t(`metrics.${gate.metric}`)}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
            gate.status === "pass" && "text-success-subtle-fg",
            gate.status === "attention" && "text-warning-subtle-fg",
          )}
        >
          {gate.status === "pass" ? <Icon name="check" size={14} aria-hidden="true" /> : null}
          {gate.status === "attention" ? <Icon name="info" size={14} aria-hidden="true" /> : null}
          {t(`status.${gate.status}`)}
        </span>
      </p>
      <p className="text-[1.375rem] leading-snug font-semibold tracking-tight tabular-nums sm:text-2xl">
        {gate.value === null ? "—" : show(gate.value)}
      </p>
      <p className="text-muted text-xs tabular-nums">
        {t(gate.direction === "min" ? "targetMin" : "targetMax", { target: show(gate.target) })}
        {" · "}
        {t(`windows.${gate.window}`)}
      </p>
    </div>
  );
}

function useCompanySearch(q: string) {
  return useQuery({
    queryKey: queryKeys.list("admin", "company", { q, perPage: 5, view: "rollout" }),
    enabled: q.trim().length >= 2,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/companies", {
          params: { query: { q: q.trim(), perPage: 5 } },
        })
      ).data!.data,
  });
}

function CompanyPicker({ onPick, label }: { onPick: (company: { id: string; name: string }) => void; label: string }) {
  const t = useTranslations("marketing.rollout.search");
  const [q, setQ] = useState("");
  const results = useCompanySearch(q);
  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={t("hint")}>
        <Input type="search" value={q} onChange={(event) => setQ(event.target.value)} />
      </Field>
      {results.data?.length ? (
        <ul className="border-border rounded-control divide-border divide-y border text-sm">
          {results.data.map((company) => (
            <li key={company.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate">{company.legalName}</span>
                <span className="text-muted text-xs tabular-nums">{company.companyCode ?? company.taxId}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => onPick({ id: company.id, name: company.legalName })}>
                {t("pick")}
              </Button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && results.isSuccess ? (
        <p className="text-muted text-sm">{t("none")}</p>
      ) : null}
    </div>
  );
}

function Allowlists({
  data,
  canManage,
  onAdd,
  onRemove,
}: {
  data: LoyaltyRollout;
  canManage: boolean;
  onAdd: (target: RolloutTarget) => void;
  onRemove: (target: RolloutTarget) => void;
}) {
  const t = useTranslations("marketing.rollout.allowlist");
  const current = targetOf(data);
  const [userId, setUserId] = useState("");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const list = (ids: string[], kind: "allowlistCompanyIds" | "allowlistUserIds") =>
    ids.length === 0 ? (
      <p className="text-muted py-2 text-sm">{t("none")}</p>
    ) : (
      <ul className="divide-border divide-y text-sm">
        {ids.map((id) => (
          <li key={id} className="flex items-center justify-between gap-2 py-2">
            <span className="text-muted font-mono text-xs break-all">{id}</span>
            {canManage ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove({ ...current, [kind]: ids.filter((other) => other !== id) })}
              >
                {t("remove")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    );
  return (
    <section aria-labelledby="rollout-allow" className={cn(card, "flex flex-col gap-3 p-5")}>
      <div>
        <h2 id="rollout-allow" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("note")}</p>
      </div>
      <div>
        <h3 className="text-muted text-sm font-medium">
          {t("companies", { count: current.allowlistCompanyIds.length })}
        </h3>
        {list(current.allowlistCompanyIds, "allowlistCompanyIds")}
      </div>
      <div>
        <h3 className="text-muted text-sm font-medium">{t("users", { count: current.allowlistUserIds.length })}</h3>
        {list(current.allowlistUserIds, "allowlistUserIds")}
      </div>
      {canManage ? (
        <div className="border-border grid gap-4 border-t pt-4 md:grid-cols-2">
          <CompanyPicker
            label={t("addCompany")}
            onPick={(company) =>
              current.allowlistCompanyIds.includes(company.id)
                ? toast(t("already"))
                : onAdd({ ...current, allowlistCompanyIds: [...current.allowlistCompanyIds, company.id] })
            }
          />
          <div className="flex flex-col gap-2">
            <Field label={t("addUser")} hint={t("addUserHint")}>
              <Input value={userId} onChange={(event) => setUserId(event.target.value.trim())} />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              disabled={!uuid.test(userId)}
              onClick={() => onAdd({ ...current, allowlistUserIds: [...current.allowlistUserIds, userId] })}
            >
              {t("add")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CohortCheck() {
  const t = useTranslations("marketing.rollout.lookup");
  const p4Message = useLoyaltyProblem();
  const [result, setResult] = useState<{ name: string; data: CohortLookup } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lookUp = async (company: { id: string; name: string }) => {
    setError(null);
    try {
      const { data } = await adminBrowserApis().contract.GET("/v1/admin/loyalty/rollout/cohort", {
        params: { query: { companyId: company.id } },
      });
      setResult({ name: company.name, data: data! });
    } catch (failure) {
      setResult(null);
      setError(p4Message(failure, t("failed")));
    }
  };
  return (
    <section aria-labelledby="rollout-lookup" className={cn(card, "flex flex-col gap-3 p-5")}>
      <div>
        <h2 id="rollout-lookup" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("note")}</p>
      </div>
      <CompanyPicker label={t("company")} onPick={(company) => void lookUp(company)} />
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      {result ? <CohortResult name={result.name} data={result.data} /> : null}
    </section>
  );
}

export function CohortResult({ name, data }: { name: string; data: CohortLookup }) {
  const t = useTranslations("marketing.rollout.lookup");
  return (
    <div role="status" className="bg-bg-subtle rounded-control p-3.5 text-sm">
      <p className="font-semibold">{data.inCohort ? t("in", { name }) : t("out", { name })}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-0.5">
        <dt className="text-muted">{t("key")}</dt>
        <dd>{t(`keys.${data.key}`)}</dd>
        <dt className="text-muted">{t("bucket")}</dt>
        <dd className="tabular-nums">{data.bucket}</dd>
        <dt className="text-muted">{t("reason")}</dt>
        <dd>{t(`reasons.${data.reason}`)}</dd>
      </dl>
    </div>
  );
}

function History({ data }: { data: LoyaltyRollout }) {
  const t = useTranslations("marketing.rollout.history");
  const tRollout = useTranslations("marketing.rollout");
  const format = useFormat();
  type Row = LoyaltyRollout["history"][number];
  return (
    <section aria-labelledby="rollout-history" className="flex flex-col gap-3">
      <h2 id="rollout-history" className="text-lg font-semibold">
        {t("title")} <span className="text-muted text-sm font-normal">{t("note")}</span>
      </h2>
      <DataTable<Row>
        caption={t("title")}
        rows={data.history}
        getRowId={(row) => row.settingVersionId}
        columns={[
          {
            id: "at",
            header: t("at"),
            cell: (row) => <span className="tabular-nums">{format.dateTime(row.effectiveFrom)}</span>,
          },
          { id: "stage", header: t("stage"), cell: (row) => stageLabel(tRollout, row.stage, row.percent) },
          {
            id: "kind",
            header: t("kind"),
            cell: (row) => (
              <Badge size="sm" tone={row.kind === "advance" ? "primary" : "neutral"}>
                {t(`kinds.${row.kind}`)}
              </Badge>
            ),
          },
          { id: "reason", header: t("reason"), cell: (row) => row.reason ?? "—" },
          {
            id: "by",
            header: t("by"),
            cell: (row) =>
              row.by
                ? row.approvedBy
                  ? t("byApproved", { name: row.by.displayName, approver: row.approvedBy.displayName })
                  : row.by.displayName
                : t("system"),
          },
        ]}
      />
    </section>
  );
}

function StageChoice({
  stages,
  value,
  onChange,
}: {
  stages: readonly RolloutStage[];
  value: RolloutStage;
  onChange: (stage: RolloutStage) => void;
}) {
  const t = useTranslations("marketing.rollout");
  return (
    <Field label={t("dialog.stage")}>
      <RadioCards
        columns={1}
        value={value}
        onValueChange={(next) => onChange(next as RolloutStage)}
        options={stages.map((stage) => ({
          value: stage,
          label: t(`stages.${stage}`),
          description: t(`stageNotes.${stage}`),
        }))}
      />
    </Field>
  );
}

function AdvanceDialog({
  current,
  preset,
  onClose,
}: {
  current: RolloutTarget;
  preset?: RolloutTarget;
  onClose: () => void;
}) {
  const t = useTranslations("marketing.rollout");
  const p4Message = useLoyaltyProblem();
  const queryClient = useQueryClient();
  const later = ROLLOUT_STAGE_ORDER.slice(ROLLOUT_STAGE_ORDER.indexOf(current.stage)).filter(
    (stage) => stage !== current.stage || stage === "percent",
  );
  const [stage, setStage] = useState<RolloutStage>(preset?.stage ?? later[0] ?? current.stage);
  const [percent, setPercent] = useState(
    String(preset?.percent ?? (current.stage === "percent" ? current.percent : 10)),
  );
  const [reason, setReason] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  return (
    <FormDialog
      title={t("advance.title")}
      description={t("advance.body")}
      submitLabel={t("advance.submit")}
      onClose={onClose}
      onSubmit={async () => {
        const target: RolloutTarget = preset ?? {
          ...current,
          stage,
          percent: stage === "percent" ? Number(percent) : 0,
        };
        if (target.stage === "percent" && !(target.percent >= 1 && target.percent <= 99))
          throw new FormError(t("dialog.percentRange"));
        if (!growsCohort(current, target)) throw new FormError(t("advance.notAnAdvance"));
        if (reason.trim().length < 10) throw new FormError(t("dialog.needReason"));
        try {
          await adminBrowserApis().contract.POST("/v1/admin/loyalty/rollout/actions/advance", {
            params: { header: { "Idempotency-Key": key } },
            body: { ...target, reason: reason.trim() },
          });
        } catch (error) {
          throw new FormError(p4Message(error, t("dialog.failed")));
        }
        toast.success(t("advance.done"));
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "loyalty_rollout") });
      }}
    >
      {preset ? (
        <p className="text-sm">{t("advance.allowlistOnly")}</p>
      ) : (
        <>
          <StageChoice stages={later} value={stage} onChange={setStage} />
          {stage === "percent" ? (
            <Field label={t("dialog.percent")} required hint={t("dialog.percentHint", { now: current.percent })}>
              <Input inputMode="numeric" value={percent} onChange={(event) => setPercent(event.target.value)} />
            </Field>
          ) : null}
        </>
      )}
      <Field label={t("dialog.reason")} required hint={t("dialog.reasonHint")}>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

function RollbackDialog({
  current,
  preset,
  onClose,
}: {
  current: RolloutTarget;
  preset?: RolloutTarget;
  onClose: () => void;
}) {
  const t = useTranslations("marketing.rollout");
  const p4Message = useLoyaltyProblem();
  const queryClient = useQueryClient();
  const earlier = ROLLOUT_STAGE_ORDER.slice(0, ROLLOUT_STAGE_ORDER.indexOf(current.stage) + 1).reverse();
  const [stage, setStage] = useState<RolloutStage>(preset?.stage ?? earlier[1] ?? current.stage);
  const [percent, setPercent] = useState(String(current.stage === "percent" ? Math.max(1, current.percent - 5) : 5));
  const [reason, setReason] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  return (
    <FormDialog
      title={t("rollback.title")}
      description={t("rollback.body")}
      submitLabel={t("rollback.submit")}
      destructive
      onClose={onClose}
      onSubmit={async () => {
        const target: RolloutTarget = preset ?? {
          ...current,
          stage,
          percent: stage === "percent" ? Number(percent) : 0,
        };
        if (target.stage === "percent" && !(target.percent >= 1 && target.percent <= 99))
          throw new FormError(t("dialog.percentRange"));
        if (growsCohort(current, target)) throw new FormError(t("rollback.notARollback"));
        if (reason.trim().length < 10) throw new FormError(t("dialog.needReason"));
        try {
          await adminBrowserApis().contract.POST("/v1/admin/loyalty/rollout/actions/rollback", {
            params: { header: { "Idempotency-Key": key } },
            body: { ...target, reason: reason.trim() },
          });
        } catch (error) {
          throw new FormError(p4Message(error, t("dialog.failed")));
        }
        toast.success(t("rollback.done"));
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "loyalty_rollout") });
      }}
    >
      {preset ? (
        <p className="text-sm">{t("rollback.allowlistOnly")}</p>
      ) : (
        <>
          <StageChoice stages={earlier} value={stage} onChange={setStage} />
          {stage === "percent" ? (
            <Field label={t("dialog.percent")} required hint={t("dialog.percentHint", { now: current.percent })}>
              <Input inputMode="numeric" value={percent} onChange={(event) => setPercent(event.target.value)} />
            </Field>
          ) : null}
        </>
      )}
      <Field label={t("dialog.reason")} required>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <ul className="text-muted flex flex-col gap-1 text-sm">
        <li>{t("rollback.keeps")}</li>
        <li>{t("rollback.withdraws")}</li>
      </ul>
    </FormDialog>
  );
}
