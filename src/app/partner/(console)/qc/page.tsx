import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Code, Row, RowList } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { stepName } from "@/features/partner/jobs/JobCard";
import { qcQueue } from "@/features/partner/jobs/qc-queue";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
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
  const [t, format, locale] = await Promise.all([getTranslations("partnerJobs.qcQueue"), getFormat(), getLocale()]);
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
              className="bg-primary text-primary-fg hover:bg-primary-hover rounded-control inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 font-semibold md:min-h-10 md:w-auto md:px-4"
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
    <PartnerPage title={t("title")} description={t("body", { date: format.date(new Date().toISOString()) })} wide>
      <p className="flex flex-wrap gap-2" aria-live="polite">
        <span className="bg-warning-subtle text-warning-subtle-fg rounded-control px-3 py-1 font-semibold">
          {t("waiting", { count: waiting })}
        </span>
      </p>
      {waiting === 0 ? <EmptyState icon="clipboard-check" title={t("empty")} /> : null}
      {inspections.length ? (
        <PartnerSection title={t("inspections")}>
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
      {atQc.length ? (
        <PartnerSection title={t("atQc")}>
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
      {toRecord.length ? (
        <PartnerSection title={t("samples")}>
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
