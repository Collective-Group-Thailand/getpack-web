import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { getFormat } from "@/features/shared/format/server";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import { Badge } from "@/ui/components/Badge";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("analytics.assistant"))("runTitle") };
}

/** One evaluation run (D-306): every case with its kind and, when it failed, why. Failures first. */
export default async function EvalRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const [t, format, api] = await Promise.all([getTranslations("analytics.assistant"), getFormat(), serverApi("admin")]);
  const run = await api
    .GET("/v1/admin/assistant/eval-runs/{runId}", { params: { path: { runId } } })
    .then((response) => response.data!)
    .catch((error: unknown) => {
      if (isApiError(error) && error.status === 404) notFound();
      throw error;
    });
  const results = [...run.results].sort((a, b) => Number(a.passed) - Number(b.passed));
  return (
    <ConsolePage width="full" className="max-w-[80rem]">
      <Link href="/assistant" className="text-primary text-sm hover:underline">
        {t("back")}
      </Link>
      <PageHeader
        title={t("runTitle")}
        description={t("runDescription", {
          at: format.dateTime(run.finishedAt),
          provider: `${run.provider} · ${run.model}`,
          suite: run.suiteVersion,
        })}
      />
      <p className="text-sm">
        {t("passOf", { passed: run.passed, cases: run.cases, pct: run.passRatePct })} ·{" "}
        {t("redTeamLine", { passed: run.redTeamPassed, cases: run.redTeamCases })}
      </p>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">{t("casesTitle")}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-muted py-2 text-start font-normal">
              {t("columns.case")}
            </th>
            <th scope="col" className="text-muted py-2 text-start font-normal">
              {t("columns.kind")}
            </th>
            <th scope="col" className="text-muted py-2 text-start font-normal">
              {t("columns.result")}
            </th>
            <th scope="col" className="text-muted py-2 text-start font-normal">
              {t("columns.reason")}
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id} className="border-border border-t">
              <td className="py-2 tabular-nums">{result.id}</td>
              <td className="py-2">{t(`kinds.${result.kind}`)}</td>
              <td className="py-2">
                <Badge size="sm" tone={result.passed ? "success" : "danger"} icon={result.passed ? "check" : "error"}>
                  {result.passed ? t("passed") : t("failed")}
                </Badge>
              </td>
              <td className="text-muted py-2">{result.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConsolePage>
  );
}
