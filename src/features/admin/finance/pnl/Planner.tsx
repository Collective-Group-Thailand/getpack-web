"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PNL_PLAN_STATUS } from "@/domain/status";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { EmptyState } from "@/ui/components/EmptyState";
import { ErrorState } from "@/ui/components/ErrorState";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, download, problemMessage, QueryError, useCan } from "../../console";
import { usePnlFormat } from "./format";
import { PnlGridView } from "./Grid";
import { SourcesSheet } from "./SourcesSheet";
import { CopyPlanDialog, CreatePlanDialog, LockPlanDialog } from "./PlanDialogs";
import {
  PNL_SCENARIOS,
  pnlKeys,
  type PnlCell,
  type PnlGrid,
  type PnlGridLine,
  type PnlPlan,
  type PnlScenario,
} from "./resources";

const thisYear = () => Number(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 4));

/**
 * The management P&L planner (D-472, `/finance/pnl`). Readers are C-Level, VP, Director and the Finance Manager
 * (`pnl.read`); everyone else gets the 403 page here and a 403 from the API. Editing, recompute, copy and lock need
 * `pnl.manage`; files need `pnl.export` — the controls are absent without them, and the API refuses regardless.
 *
 * Which plan is open lives in the address (`?plan=`, or `?year=&scenario=` for a scenario with no plan yet), so a
 * link opens the same plan; `?view=variance` is the plan-vs-actual view.
 */
export function PnlPlanner() {
  const canRead = useCan("pnl.read");
  const t = useTranslations("common.errors");
  if (!canRead) return <ErrorState title={t("forbiddenTitle")} description={t("forbiddenBody")} />;
  return <PlannerBody />;
}

function PlannerBody() {
  const t = useTranslations("finance.pnl");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = useCan("pnl.manage");
  const format = usePnlFormat();
  const [dialog, setDialog] = useState<"create" | "copy" | "lock" | null>(null);
  const [drill, setDrill] = useState<{ line: PnlGridLine; cell: PnlCell } | null>(null);

  const plans = useQuery({
    queryKey: pnlKeys.plans(),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/finance/pnl/plans", { params: { query: { perPage: 100 } } }))
        .data!.data,
  });

  const all = plans.data ?? [];
  const requested = all.find((plan) => plan.id === params.get("plan"));
  const fallbackYear = Number(params.get("year")) || thisYear();
  const fallbackScenario = (PNL_SCENARIOS as readonly string[]).includes(params.get("scenario") ?? "")
    ? (params.get("scenario") as PnlScenario)
    : "base";
  // Without a plan in the address: the newest plan of the year and scenario asked for (this year's base by default).
  const plan =
    requested ??
    (params.get("plan") || params.get("scenario")
      ? all.find((p) => p.fiscalYear === fallbackYear && p.scenario === fallbackScenario)
      : (all.find((p) => p.fiscalYear === fallbackYear && p.scenario === "base") ?? all[0]));
  const year = plan?.fiscalYear ?? fallbackYear;
  const scenario = plan?.scenario ?? fallbackScenario;
  const variance = params.get("view") === "variance";

  const grid = useQuery({
    queryKey: pnlKeys.grid(plan?.id ?? "none"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/finance/pnl/plans/{planId}/grid", {
          params: { path: { planId: plan!.id } },
        })
      ).data!,
    enabled: Boolean(plan),
  });

  const navigate = (next: { plan?: string; year?: number; scenario?: PnlScenario; view?: string | null }) => {
    const search = new URLSearchParams();
    if (next.plan) search.set("plan", next.plan);
    else {
      search.set("year", String(next.year ?? year));
      search.set("scenario", next.scenario ?? scenario);
    }
    const view = next.view === undefined ? (variance ? "variance" : null) : next.view;
    if (view) search.set("view", view);
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  };
  const choose = (target: { year?: number; scenario?: PnlScenario }) => {
    const y = target.year ?? year;
    const s = target.scenario ?? scenario;
    const match =
      all.find((p) => p.fiscalYear === y && p.scenario === s) ??
      (target.year !== undefined ? all.find((p) => p.fiscalYear === y) : undefined);
    if (match) navigate({ plan: match.id });
    else navigate({ year: y, scenario: s });
  };
  const opened = async (next: PnlPlan) => {
    setDialog(null);
    await queryClient.invalidateQueries({ queryKey: pnlKeys.all() });
    navigate({ plan: next.id, view: null });
  };

  if (plans.isError) return <QueryError error={plans.error} onRetry={() => void plans.refetch()} />;

  const years = [...new Set([...all.map((p) => p.fiscalYear), year, thisYear()])].sort((a, b) => b - a);
  const ofYearAndScenario = all.filter((p) => p.fiscalYear === year && p.scenario === scenario);
  const sibling = all.find((p) => p.fiscalYear === year && p.id !== plan?.id);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canManage ? (
            <Button iconStart="plus" onClick={() => setDialog("create")}>
              {t("header.create")}
            </Button>
          ) : undefined
        }
      />

      {plans.isPending ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <PlanToolbar
          years={years}
          year={year}
          scenario={scenario}
          plan={plan}
          plans={ofYearAndScenario}
          grid={grid.data}
          variance={variance}
          onYear={(y) => choose({ year: y })}
          onScenario={(s) => choose({ scenario: s })}
          onPlan={(id) => navigate({ plan: id })}
          onVariance={(on) => (plan ? navigate({ plan: plan.id, view: on ? "variance" : null }) : undefined)}
          onCopy={() => setDialog("copy")}
          onLock={() => setDialog("lock")}
        />
      )}

      {plans.isPending ? null : !plan ? (
        <EmptyState
          icon="spreadsheet"
          titleAs="h2"
          title={
            all.some((p) => p.fiscalYear === year)
              ? t("empty.noScenarioTitle", {
                  scenario: t(`header.scenarios.${scenario}`),
                  year: format.year(year),
                })
              : t("empty.noPlansTitle", { year: format.year(year) })
          }
          description={
            !canManage
              ? t("empty.readerBody")
              : all.some((p) => p.fiscalYear === year)
                ? t("empty.noScenarioBody")
                : t("empty.noPlansBody")
          }
          action={
            canManage ? (
              sibling ? (
                <Button iconStart="copy" onClick={() => setDialog("copy")}>
                  {t("empty.copyFrom", { name: sibling.name })}
                </Button>
              ) : (
                <Button iconStart="plus" onClick={() => setDialog("create")}>
                  {t("header.create")}
                </Button>
              )
            ) : all[0] ? (
              <Button variant="secondary" iconStart="arrow-right" onClick={() => navigate({ plan: all[0]!.id })}>
                {t("empty.openLatest", { name: all[0].name })}
              </Button>
            ) : (
              <Button asChild variant="secondary" iconStart="arrow-left">
                <Link href="/finance">{t("empty.backToFinance")}</Link>
              </Button>
            )
          }
        />
      ) : grid.isError ? (
        <QueryError error={grid.error} onRetry={() => void grid.refetch()} />
      ) : (
        <>
          <PlanNotices plan={plan} canManage={canManage} />
          {grid.data ? (
            <PnlGridView
              grid={grid.data}
              canEdit={canManage && grid.data.plan.status === "draft"}
              onDrill={(line, cell) => setDrill({ line, cell })}
            />
          ) : (
            <Skeleton className="h-[32rem] w-full" />
          )}
        </>
      )}

      {drill && plan ? (
        <SourcesSheet planId={plan.id} line={drill.line.line} cell={drill.cell} onClose={() => setDrill(null)} />
      ) : null}
      {canManage ? (
        <CreatePlanDialog
          open={dialog === "create"}
          onOpenChange={(open) => setDialog(open ? "create" : null)}
          year={year}
          scenario={scenario}
          onCreated={opened}
        />
      ) : null}
      {canManage && (plan ?? sibling) && dialog === "copy" ? (
        <CopyPlanDialog
          plan={(plan ?? sibling)!}
          open
          onOpenChange={(open) => setDialog(open ? "copy" : null)}
          scenario={plan ? undefined : scenario}
          onCopied={opened}
        />
      ) : null}
      {canManage && plan ? (
        <LockPlanDialog
          plan={grid.data?.plan ?? plan}
          emptyManualCells={grid.data?.summary.emptyManualCells ?? 0}
          open={dialog === "lock"}
          onOpenChange={(open) => setDialog(open ? "lock" : null)}
          onLocked={async () => {
            setDialog(null);
            await queryClient.invalidateQueries({ queryKey: pnlKeys.all() });
          }}
        />
      ) : null}
    </div>
  );
}

/** The plan's standing in words: who may edit, and what a lock means. */
function PlanNotices({ plan, canManage }: { plan: PnlPlan; canManage: boolean }) {
  const t = useTranslations("finance.pnl.header");
  if (plan.status === "locked")
    return (
      <Callout tone="info" icon="lock">
        {t("lockedNote")}
      </Callout>
    );
  if (!canManage)
    return (
      <Callout tone="neutral" icon="eye">
        {t("readOnly")}
      </Callout>
    );
  return null;
}

/**
 * The plan bar (D-472 item 1): year, scenario tabs, the plan of that year and scenario, its status and when it was
 * computed or locked; then the view switch and the actions — recompute, copy, lock for `pnl.manage`, export for
 * `pnl.export`. One row on a wide screen, wrapping cleanly below.
 */
function PlanToolbar({
  years,
  year,
  scenario,
  plan,
  plans,
  grid,
  variance,
  onYear,
  onScenario,
  onPlan,
  onVariance,
  onCopy,
  onLock,
}: {
  years: number[];
  year: number;
  scenario: PnlScenario;
  plan: PnlPlan | undefined;
  plans: PnlPlan[];
  grid: PnlGrid | undefined;
  variance: boolean;
  onYear: (year: number) => void;
  onScenario: (scenario: PnlScenario) => void;
  onPlan: (id: string) => void;
  onVariance: (on: boolean) => void;
  onCopy: () => void;
  onLock: () => void;
}) {
  const t = useTranslations("finance.pnl.header");
  const tStatus = useTranslations("status");
  const format = usePnlFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("pnl.manage");
  const canExport = useCan("pnl.export");
  const [busy, setBusy] = useState<string | null>(null);
  const current = grid?.plan ?? plan;
  const draft = current?.status === "draft";

  const recompute = async () => {
    if (!current) return;
    setBusy("recompute");
    try {
      const { data } = await adminBrowserApis().contract.POST(
        "/v1/admin/finance/pnl/plans/{planId}/actions/recompute",
        { params: { path: { planId: current.id }, header: { "If-Match": current.etag } } },
      );
      queryClient.setQueryData(pnlKeys.grid(current.id), data);
      await queryClient.invalidateQueries({ queryKey: pnlKeys.plans() });
      toast.success(t("recomputed"));
    } catch (error) {
      if (isApiError(error) && error.status === 412) await queryClient.invalidateQueries({ queryKey: pnlKeys.all() });
      toast.error(problemMessage(error, t("recomputeFailed")));
    } finally {
      setBusy(null);
    }
  };

  const exportAs = async (format_: "xlsx" | "pdf", view: "plan" | "variance") => {
    if (!current) return;
    setBusy("export");
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/finance/pnl/plans/{planId}/exports", {
        params: { path: { planId: current.id } },
        body: { format: format_, view },
      });
      toast.success(t("exportStarted"));
      download(data!.url);
    } catch (error) {
      toast.error(problemMessage(error, t("exportFailed")));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-label={t("label")}
      className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("year")}
            <NativeSelect
              className="w-32"
              value={String(year)}
              onValueChange={(value) => onYear(Number(value))}
              options={years.map((y) => ({ value: String(y), label: t("yearOption", { year: format.year(y) }) }))}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" aria-hidden>
              {t("scenario")}
            </span>
            <SegmentedControl
              label={t("scenario")}
              value={scenario}
              onValueChange={onScenario}
              options={PNL_SCENARIOS.map((value) => ({ value, label: t(`scenarios.${value}`) }))}
            />
          </div>
          {plans.length > 0 && current ? (
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
              {t("plan")}
              <NativeSelect
                className="max-w-80 min-w-56"
                value={current.id}
                onValueChange={onPlan}
                options={plans.map((p) => ({
                  value: p.id,
                  label: t(p.status === "locked" ? "planOptionLocked" : "planOption", {
                    name: p.name,
                    version: p.version,
                  }),
                }))}
              />
            </label>
          ) : null}
        </div>
        {current ? (
          <p className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <StatusBadge
              meta={PNL_PLAN_STATUS[current.status]}
              label={tStatus(PNL_PLAN_STATUS[current.status].labelKey)}
            />
            <span>
              {current.status === "locked" && current.lockedBy
                ? t("lockedBy", { name: current.lockedBy.displayName, at: format.dateTime(current.lockedAt) })
                : current.computedAt
                  ? t("computedAt", { at: format.dateTime(current.computedAt) })
                  : t("notComputed")}
            </span>
            <span aria-hidden>·</span>
            <span>{t("owner", { name: current.owner.displayName })}</span>
          </p>
        ) : null}
      </div>

      {current ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="me-2 flex">
            <Switch label={t("variance")} checked={variance} onCheckedChange={(checked) => onVariance(checked)} />
          </span>
          {canManage && draft ? (
            <Button
              variant="secondary"
              size="sm"
              iconStart="refresh"
              loading={busy === "recompute"}
              onClick={recompute}
            >
              {t("recompute")}
            </Button>
          ) : null}
          {canManage ? (
            <Button variant="secondary" size="sm" iconStart="copy" onClick={onCopy}>
              {t("copy")}
            </Button>
          ) : null}
          {canExport ? (
            <DropdownMenu
              label={t("export")}
              heading={<span className="text-muted text-xs">{t("exportHint")}</span>}
              trigger={
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="download"
                  iconEnd="chevron-down"
                  loading={busy === "export"}
                >
                  {t("export")}
                </Button>
              }
              items={[
                {
                  id: "xlsx",
                  label: t("exportXlsx"),
                  icon: "spreadsheet",
                  onSelect: () => void exportAs("xlsx", "plan"),
                },
                { id: "pdf", label: t("exportPdf"), icon: "document", onSelect: () => void exportAs("pdf", "plan") },
                {
                  id: "variance",
                  label: t("exportVariance"),
                  icon: "columns",
                  separatorBefore: true,
                  onSelect: () => void exportAs("xlsx", "variance"),
                },
              ]}
            />
          ) : null}
          {canManage && draft ? (
            <Button size="sm" iconStart="lock" onClick={onLock}>
              {t("lock")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
