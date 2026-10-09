import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { JobScan } from "@/features/partner/jobs/actions";
import { JobsTable } from "@/features/partner/jobs/JobsTable";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";

/**
 * The floor's tabs, as `partner.production.list?view` names them, and everything.
 * CONTRACT-GAP partner.jobs — the published views have no "awaiting QC" tab (`JobView`).
 */
const VIEWS = ["to_accept", "in_production", "ready_to_ship", "late", "all"] as const;
type View = (typeof VIEWS)[number];

type Props = { searchParams: Promise<{ view?: string; q?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs"))("title") };
}

/**
 * The factory's jobs by the floor's tabs — รอรับงาน · กำลังผลิต · พร้อมส่ง · ล่าช้า — with search
 * and a scanner for the code on a job tag or carton label (F5 5.2). Token-scoped: the signed-in
 * user's factory only (D-044).
 */
export default async function JobsPage({ searchParams }: Props) {
  const query = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(query.view ?? "") ? (query.view as View) : "to_accept";
  const t = await getTranslations("partnerJobs");
  await factoryContext();
  const { contract } = await partnerServerApis();
  const jobs = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/production-jobs", {
          params: {
            query: {
              perPage: 50,
              ...(view === "all" ? {} : { view: view satisfies Schemas["JobView"] }),
              ...(query.q ? { q: query.q } : {}),
            },
          },
        })
      ).data!,
  );
  const href = (next: View) => `/jobs?view=${next}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`;

  return (
    <PartnerPage title={t("title")} actions={<JobScan />} wide>
      <ViewTabs
        label={t("viewsLabel")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
      />
      <form role="search" className="flex max-w-xl gap-2" action="/jobs">
        <input type="hidden" name="view" value={view} />
        <label htmlFor="jobs-q" className="sr-only">
          {t("search")}
        </label>
        <Input
          id="jobs-q"
          name="q"
          inputSize="lg"
          className="md:h-10"
          defaultValue={query.q ?? ""}
          placeholder={t("searchPlaceholder")}
        />
        <Button type="submit" size="lg" variant="secondary" iconStart="search" className="h-11 shrink-0 md:h-10">
          {t("searchAction")}
        </Button>
      </form>
      {jobs.data ? (
        jobs.data.data.length ? (
          <JobsTable jobs={jobs.data.data} caption={t(`views.${view}`)} />
        ) : (
          <EmptyState icon="factory" title={t(`empty.${view}`)} />
        )
      ) : (
        <PageError error={jobs.error} />
      )}
    </PartnerPage>
  );
}
