"use client";

import { useTranslations } from "next-intl";

import { Row, RowList } from "@/ui/components/RowList";
import { Skeleton } from "@/ui/components/Skeleton";

import { useFormat } from "@/features/shared/format";

import { QueryError } from "../console";
import { REPORT_GROUPS, useReportCatalogue } from "./data";

/** The operational reports this role may run (F2 2.8, B6.2), by area. */
export function ReportsIndex() {
  const t = useTranslations("reports");
  const format = useFormat();
  const reports = useReportCatalogue();
  if (reports.isError) return <QueryError error={reports.error} onRetry={() => void reports.refetch()} />;
  return (
    <div className="grid items-start gap-x-8 gap-y-8 xl:grid-cols-2">
      {REPORT_GROUPS.map((group) => {
        const items = (reports.data ?? []).filter((report) => report.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`reports-${group}`} className="flex min-w-0 flex-col gap-3">
            <h2 id={`reports-${group}`} className="text-lg font-semibold">
              {t(`groups.${group}`)}
            </h2>
            <RowList label={t(`groups.${group}`)}>
              {items.map((report) => (
                <Row
                  key={report.key}
                  href={`/reports/${report.key}`}
                  icon="chart"
                  title={format.locale === "en" ? report.nameEn : report.nameTh}
                  meta={t.has(`notes.${report.key}`) ? t(`notes.${report.key}`) : report.description}
                />
              ))}
            </RowList>
          </section>
        );
      })}
      {reports.isPending ? <Skeleton className="rounded-card h-64" /> : null}
    </div>
  );
}
