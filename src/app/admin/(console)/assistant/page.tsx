import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ASSISTANT_OUTCOME } from "@/domain/status";
import { RunEvaluation } from "@/features/admin/assistant/RunEvaluation";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { getFormat } from "@/features/shared/format/server";
import { serverApi } from "@/lib/api/server";
import { Callout } from "@/ui/components/Callout";
import { PageHeader } from "@/ui/components/PageHeader";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("analytics.assistant"))("title") };
}

/**
 * The assistant's evaluation gate and usage (U5.5 §3, D-306): whether it is cleared to be switched on,
 * the latest evaluation runs (≥ 100 Thai cases and the red-team set, in packio-api), what its turns
 * ended as, and its cost. No menu entry yet (CONTRACT-REQUEST admin.menu-assistant): linked from Analytics.
 */
export default async function AssistantDashboardPage() {
  const [t, format, api] = await Promise.all([getTranslations("analytics.assistant"), getFormat(), serverApi("admin")]);
  const { data } = await api.GET("/v1/admin/assistant/dashboard");
  const dashboard = data!;
  return (
    <ConsolePage width="full" className="max-w-[80rem]">
      <PageHeader title={t("title")} description={t("description")} actions={<RunEvaluation />} />
      <Callout
        tone={dashboard.clearance.cleared ? "success" : "warning"}
        title={dashboard.clearance.cleared ? t("cleared") : t("notCleared")}
      >
        {dashboard.clearance.reason ? <p className="text-sm">{dashboard.clearance.reason}</p> : null}
        <p className="text-sm">{t("gate")}</p>
      </Callout>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t("sessions")} value={format.number(dashboard.sessions)} icon="chat" />
        <Stat label={t("cost")} value={`US$ ${dashboard.costUsd}`} icon="coins" />
        <Stat
          label={t("latestPass")}
          value={dashboard.runs[0] ? `${dashboard.runs[0].passRatePct}%` : "—"}
          icon="checklist"
        />
      </div>
      <section aria-labelledby="assistant-outcomes" className="mt-8">
        <h2 id="assistant-outcomes" className="text-lg font-semibold">
          {t("outcomesTitle")}
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-5">
          {dashboard.outcomes.map((row) => (
            <li key={row.outcome} className="border-border rounded-lg border p-3 text-sm">
              <StatusChip map={ASSISTANT_OUTCOME} value={row.outcome} />
              <p className="mt-1 text-xl font-semibold tabular-nums">{format.number(row.turns)}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="assistant-runs" className="mt-8">
        <h2 id="assistant-runs" className="text-lg font-semibold">
          {t("runsTitle")}
        </h2>
        {dashboard.runs.length === 0 ? (
          <p className="text-muted mt-2 text-sm">{t("noRuns")}</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{t("runsTitle")}</caption>
            <thead>
              <tr className="text-muted text-start">
                <th scope="col" className="py-2 text-start font-normal">
                  {t("columns.finished")}
                </th>
                <th scope="col" className="py-2 text-start font-normal">
                  {t("columns.provider")}
                </th>
                <th scope="col" className="py-2 text-start font-normal">
                  {t("columns.cases")}
                </th>
                <th scope="col" className="py-2 text-start font-normal">
                  {t("columns.redTeam")}
                </th>
                <th scope="col" className="py-2 text-start font-normal">
                  {t("columns.trigger")}
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboard.runs.map((run) => (
                <tr key={run.id} className="border-border border-t">
                  <td className="py-2">
                    <Link href={`/assistant/runs/${run.id}`} className="text-primary hover:underline">
                      {format.dateTime(run.finishedAt)}
                    </Link>
                  </td>
                  <td className="py-2">
                    {run.provider} · {run.model}
                  </td>
                  <td className="py-2 tabular-nums">
                    {t("passOf", { passed: run.passed, cases: run.cases, pct: run.passRatePct })}
                  </td>
                  <td className="py-2 tabular-nums">
                    {t("passOfShort", { passed: run.redTeamPassed, cases: run.redTeamCases })}
                  </td>
                  <td className="py-2">{t(`triggers.${run.trigger}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </ConsolePage>
  );
}
