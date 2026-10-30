import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BarValue, TrendChart } from "@/features/partner/charts";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PeriodPicker } from "@/features/partner/period";
import { ListToolbar } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Panel } from "@/ui/components/Panel";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.oee"))("title") };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bangkokDay = (offset: number) =>
  new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

/**
 * OEE (D-377): per machine, availability (running ÷ planned time from the shifts or the calendar), performance
 * (planned minutes for what was made ÷ running) and quality (good ÷ made), with where the paused time went. The
 * dates sit in the toolbar with the overall figure; how the measure is worked out folds away under the toolbar;
 * each machine that ran gets its day-by-day line.
 */
export default async function OeePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams;
  const to = query.to && DAY.test(query.to) ? query.to : bangkokDay(-1);
  const from = query.from && DAY.test(query.from) ? query.from : bangkokDay(-7);
  const [t, tReason, tPerf, tNav, format, context] = await Promise.all([
    getTranslations("partnerInsight.oee"),
    getTranslations("partnerInsight.pauseReasons"),
    getTranslations("partnerAccount.performance"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/insight/oee", {
          params: { path: { factoryId: context.factoryId }, query: { from, to } },
        })
      ).data!,
  );
  const pct = (v: string) => format.percent(v, 1);
  // A machine (or day) that never ran has nothing to measure: a dash, not a red 0%.
  const ran = (row: { runMinutes: number }, v: string) => (row.runMinutes > 0 ? pct(v) : "—");
  const ranMachines = read.data?.machines.filter((m) => m.runMinutes > 0) ?? [];
  return (
    <PartnerPage full title={t("title")} description={t("lede")}>
      <ListToolbar>
        <PeriodPicker
          action="/insight/oee"
          label={t("title")}
          fields={[
            { name: "from", label: t("from"), value: from, type: "date" },
            { name: "to", label: t("to"), value: to, type: "date" },
          ]}
          submit={t("show")}
        />
        {read.data?.oeePct ? (
          <p className="text-lg font-semibold tabular-nums">{t("overall", { pct: pct(read.data.oeePct) })}</p>
        ) : null}
      </ListToolbar>
      <details className="group border-border bg-surface -mt-1 rounded-xl border">
        <summary className="text-muted hover:text-fg focus-visible:ring-focus-ring flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 md:min-h-10 [&::-webkit-details-marker]:hidden">
          <Icon name="help" size={16} aria-hidden="true" />
          {t("howTitle")}
          <Icon
            name="chevron-down"
            size={16}
            aria-hidden="true"
            className="ms-auto transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="border-border flex flex-col gap-2 border-t px-4 py-3 text-sm">
          <p className="max-w-[72ch] text-pretty">{t("body")}</p>
          <p className="text-muted max-w-[72ch] text-pretty">{t("note")}</p>
        </div>
      </details>
      {read.data ? (
        read.data.machines.length ? (
          <>
            <PartnerTable
              caption={t("title")}
              rows={[...read.data.machines].sort((a, b) => b.runMinutes - a.runMinutes)}
              rowKey={(row) => row.machine.id}
              rowTone={(row) => (row.runMinutes > 0 && Number(row.oeePct) < 50 ? "warning" : undefined)}
              columns={[
                { key: "m", header: t("machine"), primary: true, cell: (row) => row.machine.name },
                {
                  key: "o",
                  header: t("oee"),
                  align: "end",
                  cell: (row) =>
                    row.runMinutes > 0 ? (
                      <BarValue value={Number(row.oeePct)} max={100}>
                        <span className="font-semibold">{pct(row.oeePct)}</span>
                      </BarValue>
                    ) : (
                      "—"
                    ),
                },
                { key: "a", header: t("availability"), align: "end", cell: (row) => ran(row, row.availabilityPct) },
                { key: "p", header: t("performance"), align: "end", cell: (row) => ran(row, row.performancePct) },
                { key: "q", header: t("quality"), align: "end", cell: (row) => ran(row, row.qualityPct) },
                {
                  key: "run",
                  header: t("run"),
                  align: "end",
                  hideOnPhone: true,
                  className: "whitespace-nowrap",
                  cell: (row) =>
                    t("minutes", { run: format.number(row.runMinutes), planned: format.number(row.plannedMinutes) }),
                },
                {
                  key: "g",
                  header: t("good"),
                  align: "end",
                  hideOnPhone: true,
                  cell: (row) => formatQty(row.good, format.locale),
                },
                {
                  key: "l",
                  header: t("losses"),
                  hideOnPhone: true,
                  cell: (row) =>
                    row.losses
                      .map((l) => t("loss", { reason: tReason(l.reason), minutes: format.number(l.minutes) }))
                      .join(", ") || "—",
                },
              ]}
            />
            {ranMachines.length ? (
              <PartnerSection id="by-day" title={t("byDay")}>
                <div className="grid gap-4 xl:grid-cols-2">
                  {ranMachines.map((m) => (
                    <Panel key={m.machine.id} id={`oee-${m.machine.id}`} title={m.machine.name}>
                      <div className="flex flex-col gap-3">
                        <TrendChart
                          title={m.machine.name}
                          points={m.days.map((day) => ({
                            key: day.day,
                            label: format.date(day.day, { style: "dayMonth" }),
                            value: day.runMinutes > 0 ? Number(day.oeePct) : null,
                            display: ran(day, day.oeePct),
                          }))}
                          formatTick={(tick) => format.percent(String(tick), 0)}
                        />
                        <details className="group">
                          <summary className="text-primary inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium md:min-h-8 [&::-webkit-details-marker]:hidden">
                            <span className="group-open:hidden">{tPerf("showTable")}</span>
                            <span className="hidden group-open:inline">{tPerf("hideTable")}</span>
                          </summary>
                          <PartnerTable
                            caption={m.machine.name}
                            rows={m.days}
                            rowKey={(row) => row.day}
                            columns={[
                              { key: "d", header: t("day"), primary: true, cell: (row) => format.date(row.day) },
                              {
                                key: "a",
                                header: t("availability"),
                                align: "end",
                                cell: (row) => ran(row, row.availabilityPct),
                              },
                              {
                                key: "p",
                                header: t("performance"),
                                align: "end",
                                cell: (row) => ran(row, row.performancePct),
                              },
                              { key: "q", header: t("quality"), align: "end", cell: (row) => ran(row, row.qualityPct) },
                              {
                                key: "o",
                                header: t("oee"),
                                align: "end",
                                cell: (row) => <span className="font-semibold">{ran(row, row.oeePct)}</span>,
                              },
                            ]}
                          />
                        </details>
                      </div>
                    </Panel>
                  ))}
                </div>
              </PartnerSection>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="activity"
            title={t("empty")}
            action={
              <Button asChild variant="secondary">
                <Link href="/machines">{tNav("machines")}</Link>
              </Button>
            }
          />
        )
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
