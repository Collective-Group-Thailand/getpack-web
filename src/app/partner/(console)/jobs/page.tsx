import type { Metadata } from "next";
import Link from "next/link";
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
  const [t, tToday, tNav] = await Promise.all([
    getTranslations("partnerJobs"),
    getTranslations("partnerToday.floor"),
    getTranslations("partner.sidebar.items"),
  ]);
  await factoryContext();
  const { contract } = await partnerServerApis();
  // Each tab's count: one row per view, read for its total only (the list carries `meta.total`).
  const countsPromise = Promise.all(
    VIEWS.map((key) =>
      attempt(
        async () =>
          (
            await contract.GET("/v1/partner/production-jobs", {
              params: {
                query: {
                  perPage: 1,
                  ...(key === "all" ? {} : { view: key satisfies Schemas["JobView"] }),
                  ...(query.q ? { q: query.q } : {}),
                },
              },
            })
          ).data!.meta.total,
      ).then((result) => [key, result.data ?? null] as const),
    ),
  );
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
  const counts = Object.fromEntries(await countsPromise) as Record<View, number | null>;
  const href = (next: View) => `/jobs?view=${next}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`;

  return (
    <PartnerPage title={t("title")} actions={<JobScan />} wide>
      {/* One toolbar over the list: the views with their counts, then the search. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          label={t("viewsLabel")}
          current={view}
          items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`), count: counts[key] }))}
        />
        <form role="search" className="flex w-full gap-2 md:w-auto md:min-w-[22rem]" action="/jobs">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="jobs-q" className="sr-only">
            {t("search")}
          </label>
          <Input
            id="jobs-q"
            name="q"
            type="search"
            inputSize="lg"
            className="md:h-10"
            defaultValue={query.q ?? ""}
            placeholder={t("searchPlaceholder")}
          />
          <Button type="submit" size="lg" variant="secondary" iconStart="search" className="h-11 shrink-0 md:h-10">
            {t("searchAction")}
          </Button>
        </form>
      </div>
      {jobs.data ? (
        jobs.data.data.length ? (
          <JobsTable jobs={jobs.data.data} caption={t(`views.${view}`)} />
        ) : (
          <EmptyState
            icon="factory"
            title={t(`empty.${view}`)}
            action={
              <Button asChild variant="secondary" size="nav" iconEnd="arrow-right">
                {view === "all" ? (
                  <Link href="/">{tNav("today")}</Link>
                ) : (
                  <Link href={href("all")}>{tToday("allJobs")}</Link>
                )}
              </Button>
            }
          />
        )
      ) : (
        <PageError error={jobs.error} />
      )}
    </PartnerPage>
  );
}
