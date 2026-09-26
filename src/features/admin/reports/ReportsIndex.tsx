"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";

import { QueryError, Section } from "../console";

const GROUPS = ["sales", "finance", "marketing", "operations"] as const;

/** The operational reports this role may run (F2 2.8, B6.2), by area. */
export function ReportsIndex() {
  const t = useTranslations("reports");
  const reports = useQuery({
    queryKey: queryKeys.list("admin", "report", {}),
    queryFn: () => browserRequests().call("GET /v1/admin/reports"),
  });
  if (reports.isError) return <QueryError error={reports.error} onRetry={() => void reports.refetch()} />;
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const items = (reports.data ?? []).filter((report) => report.group === group);
        if (items.length === 0) return null;
        return (
          <Section key={group} title={t(`groups.${group}`)}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((report) => (
                <li key={report.key}>
                  <Card padding="md" className="hover:border-primary h-full transition-colors">
                    <Link href={`/reports/${report.key}`} className="flex items-start gap-3">
                      <Icon name="chart" size={20} className="text-primary mt-0.5" />
                      <span>
                        <span className="text-primary block font-medium">{t(`names.${report.key}`)}</span>
                        <span className="text-muted block text-sm">{t(`notes.${report.key}`)}</span>
                      </span>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
