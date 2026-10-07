import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { JobScan } from "@/features/partner/jobs/actions";
import { JobCard } from "@/features/partner/jobs/JobCard";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

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
      <nav aria-label={t("viewsLabel")} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {VIEWS.map((key) => (
            <li key={key} className="shrink-0">
              <Link
                href={href(key)}
                aria-current={key === view ? "page" : undefined}
                className={cn(
                  "border-border inline-flex min-h-12 items-center rounded-control border px-4 font-medium",
                  key === view ? "bg-primary text-primary-fg border-primary" : "bg-surface hover:bg-surface-subtle",
                )}
              >
                {t(`views.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form role="search" className="flex gap-2" action="/jobs">
        <input type="hidden" name="view" value={view} />
        <label htmlFor="jobs-q" className="sr-only">
          {t("search")}
        </label>
        <Input id="jobs-q" name="q" inputSize="lg" defaultValue={query.q ?? ""} placeholder={t("searchPlaceholder")} />
        <Button type="submit" size="xl" variant="secondary" iconStart="search">
          {t("searchAction")}
        </Button>
      </form>
      {jobs.data ? (
        jobs.data.data.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {jobs.data.data.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="factory" title={t(`empty.${view}`)} />
        )
      ) : (
        <PageError error={jobs.error} />
      )}
    </PartnerPage>
  );
}
