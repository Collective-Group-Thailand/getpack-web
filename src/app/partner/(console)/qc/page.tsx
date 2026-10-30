import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { Code, Row, RowList } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { stepName } from "@/features/partner/jobs/JobCard";
import { qcQueue } from "@/features/partner/jobs/qc-queue";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.qcQueue"))("title") };
}

/**
 * The QC inspector's home (round 2, Phase 1 — the "PartnerQc" board): getpack's booked inspections,
 * the jobs waiting at a QC step, and the samples to record, each one tap from its form. Counted at
 * the top so the shift starts with how much there is.
 */
export default async function QcPage() {
  const [t, tNav, format, locale] = await Promise.all([
    getTranslations("partnerJobs.qcQueue"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
    getLocale(),
  ]);
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const [jobs, samples] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/production-jobs", {
            params: { query: { factoryId: context.factoryId, perPage: 100 } },
          })
        ).data!,
    ),
    canAt(context, "factory_samples.record_evidence")
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/samples", {
                params: { path: { factoryId: context.factoryId } },
              })
            ).data!,
        )
      : null,
  ]);
  if (!jobs.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={jobs.error} />
      </PartnerPage>
    );
  const { inspections, atQc } = qcQueue(jobs.data.data);
  const toRecord = (samples?.data?.data ?? []).filter(
    (sample) => !sample.evidence.recordedAt && ["paid", "in_production"].includes(sample.status),
  );
  const waiting = inspections.length + atQc.length + toRecord.length;

  /** Jobs waiting on QC as a table on a desk, a card each on the floor's phone — with the action on every row. */
  const jobTable = (
    jobs: Schemas["PartnerJobDto"][],
    caption: string,
    when: (job: Schemas["PartnerJobDto"]) => string,
    action: string,
  ) => (
    <PartnerTable
      caption={caption}
      rows={jobs}
      rowKey={(job) => job.id}
      columns={[
        {
          key: "job",
          header: t("table.job"),
          primary: true,
          cell: (job) => <span className="whitespace-nowrap tabular-nums">{job.jobNo}</span>,
        },
        { key: "product", header: t("table.product"), cell: (job) => job.productTypeNameTh ?? job.title },
        {
          key: "quantity",
          header: t("table.quantity"),
          align: "end",
          cell: (job) => format.number(job.quantityOrdered),
        },
        { key: "when", header: t("table.when"), cell: (job) => when(job) },
        {
          key: "action",
          header: <span className="sr-only">{t("table.action")}</span>,
          className: "w-[1%] whitespace-nowrap",
          cell: (job) => (
            <Link
              href={`/jobs/${job.id}#qc`}
              className="bg-primary text-primary-fg hover:bg-primary-hover rounded-control focus-visible:ring-focus-ring relative z-10 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 font-semibold outline-none focus-visible:ring-2 md:min-h-10 md:w-auto md:px-4"
            >
              <Icon name="clipboard-check" size={18} aria-hidden="true" />
              {action}
              <span className="sr-only"> {job.jobNo}</span>
            </Link>
          ),
        },
      ]}
    />
  );

  return (
    <PartnerPage
      title={t("title")}
      description={t("body", { date: format.date(new Date().toISOString()) })}
      wide
      actions={
        <Button asChild variant="secondary" size="nav" iconStart="factory">
          <Link href="/jobs?view=in_production">{tNav("jobs")}</Link>
        </Button>
      }
    >
      <p className="sr-only" aria-live="polite">
        {t("waiting", { count: waiting })}
      </p>
      {waiting ? (
        <PartnerStats
          label={t("title")}
          items={[
            {
              key: "atQc",
              href: "#at-qc",
              icon: "clipboard-check" as const,
              label: t("atQc"),
              value: format.number(atQc.length),
              highlight: atQc.length > 0,
            },
            {
              key: "inspections",
              href: "#inspections",
              icon: "shield" as const,
              label: t("inspections"),
              value: format.number(inspections.length),
            },
            ...(samples
              ? [
                  {
                    key: "samples",
                    href: "#samples",
                    icon: "package-check" as const,
                    label: t("samples"),
                    value: format.number(toRecord.length),
                  },
                ]
              : []),
          ]}
        />
      ) : (
        <EmptyState
          icon="clipboard-check"
          title={t("empty")}
          action={
            <Button asChild variant="secondary" size="nav" iconEnd="arrow-right">
              <Link href="/jobs?view=in_production">{tNav("jobs")}</Link>
            </Button>
          }
        />
      )}
      {atQc.length ? (
        <PartnerSection id="at-qc" title={t("atQc")}>
          {jobTable(
            atQc,
            t("atQc"),
            (job) => {
              const step = job.milestones.find((m) => m.key === job.currentMilestoneKey)!;
              return [
                t("atStep", { step: stepName(step, locale) }),
                step.dueAt ? t("due", { date: format.dateTime(step.dueAt) }) : null,
              ]
                .filter(Boolean)
                .join(" · ");
            },
            t("startCheck"),
          )}
        </PartnerSection>
      ) : null}
      {inspections.length ? (
        <PartnerSection id="inspections" title={t("inspections")}>
          {jobTable(
            inspections,
            t("inspections"),
            (job) =>
              job.inspection!.scheduledAt
                ? t("inspectionAt", {
                    at: format.dateTime(job.inspection!.scheduledAt),
                    size: format.number(job.inspection!.sampleSize),
                  })
                : t("inspectionUnscheduled"),
            t("openJob"),
          )}
        </PartnerSection>
      ) : null}
      {toRecord.length ? (
        <PartnerSection id="samples" title={t("samples")}>
          <RowList label={t("samples")}>
            {toRecord.map((sample) => (
              <Row
                key={sample.id}
                href={`/samples#sample-${sample.id}`}
                icon="package-check"
                title={
                  <>
                    <Code>{sample.jobNo ?? t("sample")}</Code>
                    <span className="text-muted font-normal">
                      {t("pieces", { count: format.number(sample.quantity) })}
                    </span>
                  </>
                }
                aside={<span className="text-primary font-semibold">{t("recordSample")}</span>}
              />
            ))}
          </RowList>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
