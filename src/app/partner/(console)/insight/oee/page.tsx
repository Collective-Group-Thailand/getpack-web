import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.oee"))("title") };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bangkokDay = (offset: number) => new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

/**
 * OEE (D-377): per machine, availability (running ÷ planned time from the shifts or the calendar), performance
 * (planned minutes for what was made ÷ running) and quality (good ÷ made), with where the paused time went.
 */
export default async function OeePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams;
  const to = query.to && DAY.test(query.to) ? query.to : bangkokDay(-1);
  const from = query.from && DAY.test(query.from) ? query.from : bangkokDay(-7);
  const [t, tReason, format, context] = await Promise.all([
    getTranslations("partnerInsight.oee"),
    getTranslations("partnerInsight.pauseReasons"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/insight/oee", { params: { path: { factoryId: context.factoryId }, query: { from, to } } })).data!,
  );
  const pct = (v: string) => format.percent(v, 1);
  // A machine (or day) that never ran has nothing to measure: a dash, not a red 0%.
  const ran = (row: { runMinutes: number }, v: string) => (row.runMinutes > 0 ? pct(v) : "—");
  const tone = (v: string) => (Number(v) >= 85 ? "text-success" : Number(v) >= 60 ? "text-fg" : "text-danger");
  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <form className="flex flex-wrap items-end gap-2" action="/insight/oee">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("from")}</span>
          <Input type="date" name="from" defaultValue={from} className="w-44" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("to")}</span>
          <Input type="date" name="to" defaultValue={to} className="w-44" />
        </label>
        <Button type="submit" variant="secondary">
          {t("show")}
        </Button>
        {read.data?.oeePct ? <p className="ms-auto text-lg font-semibold">{t("overall", { pct: pct(read.data.oeePct) })}</p> : null}
      </form>
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
                { key: "run", header: t("run"), align: "end", hideOnPhone: true, cell: (row) => t("minutes", { run: format.number(row.runMinutes), planned: format.number(row.plannedMinutes) }) },
                { key: "a", header: t("availability"), align: "end", cell: (row) => ran(row, row.availabilityPct) },
                { key: "p", header: t("performance"), align: "end", cell: (row) => ran(row, row.performancePct) },
                { key: "q", header: t("quality"), align: "end", cell: (row) => ran(row, row.qualityPct) },
                { key: "o", header: t("oee"), align: "end", cell: (row) => (row.runMinutes > 0 ? <span className={`font-semibold ${tone(row.oeePct)}`}>{pct(row.oeePct)}</span> : "—") },
                { key: "g", header: t("good"), align: "end", hideOnPhone: true, cell: (row) => formatQty(row.good, format.locale) },
                {
                  key: "l",
                  header: t("losses"),
                  hideOnPhone: true,
                  cell: (row) => row.losses.map((l) => t("loss", { reason: tReason(l.reason), minutes: format.number(l.minutes) })).join(", ") || "—",
                },
              ]}
            />
            {read.data.machines
              .filter((m) => m.runMinutes > 0)
              .map((m) => (
                <PartnerSection key={m.machine.id} title={m.machine.name}>
                  <PartnerTable
                    caption={m.machine.name}
                    rows={m.days}
                    rowKey={(row) => row.day}
                    columns={[
                      { key: "d", header: t("day"), primary: true, cell: (row) => format.date(row.day) },
                      { key: "r", header: t("run"), align: "end", cell: (row) => t("minutes", { run: format.number(row.runMinutes), planned: format.number(row.plannedMinutes) }) },
                      { key: "a", header: t("availability"), align: "end", cell: (row) => ran(row, row.availabilityPct) },
                      { key: "p", header: t("performance"), align: "end", cell: (row) => ran(row, row.performancePct) },
                      { key: "q", header: t("quality"), align: "end", cell: (row) => ran(row, row.qualityPct) },
                      { key: "o", header: t("oee"), align: "end", cell: (row) => (row.runMinutes > 0 ? <span className={tone(row.oeePct)}>{pct(row.oeePct)}</span> : "—") },
                    ]}
                  />
                </PartnerSection>
              ))}
            <p className="text-muted text-sm">{t("note")}</p>
          </>
        ) : (
          <EmptyState icon="activity" title={t("empty")} />
        )
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
