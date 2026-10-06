import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { stepName } from "@/features/partner/jobs/JobCard";
import { qcQueue } from "@/features/partner/jobs/qc-queue";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.qcQueue"))("title") };
}

/**
 * The QC inspector's home (round 2, Phase 1 — the "PartnerQc" board): Packio's booked inspections,
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

  const jobCard = (job: Schemas["PartnerJobDto"], line: string, action: string) => (
    <li key={job.id}>
      <Card padding="md" className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono font-semibold">{job.jobNo}</p>
          <p className="text-muted">
            {[job.productTypeNameTh ?? job.title, t("pieces", { count: format.number(job.quantityOrdered) })].join(
              " · ",
            )}
          </p>
          <p className="text-sm">{line}</p>
        </div>
        <Link
          href={`/jobs/${job.id}#qc`}
          className="bg-primary text-primary-fg inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-semibold"
        >
          <Icon name="clipboard-check" size={20} aria-hidden="true" />
          {action}
          <span className="sr-only"> {job.jobNo}</span>
        </Link>
      </Card>
    </li>
  );

  return (
    <PartnerPage title={t("title")} description={t("body", { date: format.date(new Date().toISOString()) })} wide>
      <p className="flex flex-wrap gap-2" aria-live="polite">
        <span className="bg-warning-subtle text-warning-subtle-fg rounded-full px-3 py-1 font-semibold">
          {t("waiting", { count: waiting })}
        </span>
      </p>
      {waiting === 0 ? <EmptyState icon="clipboard-check" title={t("empty")} /> : null}
      {inspections.length ? (
        <PartnerSection title={t("inspections")}>
          <ul className="flex flex-col gap-3">
            {inspections.map((job) =>
              jobCard(
                job,
                job.inspection!.scheduledAt
                  ? t("inspectionAt", {
                      at: format.dateTime(job.inspection!.scheduledAt),
                      size: format.number(job.inspection!.sampleSize),
                    })
                  : t("inspectionUnscheduled"),
                t("openJob"),
              ),
            )}
          </ul>
        </PartnerSection>
      ) : null}
      {atQc.length ? (
        <PartnerSection title={t("atQc")}>
          <ul className="flex flex-col gap-3">
            {atQc.map((job) => {
              const step = job.milestones.find((m) => m.key === job.currentMilestoneKey)!;
              return jobCard(
                job,
                [
                  t("atStep", { step: stepName(step, locale) }),
                  step.dueAt ? t("due", { date: format.dateTime(step.dueAt) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                t("startCheck"),
              );
            })}
          </ul>
        </PartnerSection>
      ) : null}
      {toRecord.length ? (
        <PartnerSection title={t("samples")}>
          <ul className="flex flex-col gap-3">
            {toRecord.map((sample) => (
              <li key={sample.id}>
                <Link
                  href={`/samples#sample-${sample.id}`}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 items-center gap-3 rounded-xl border p-3"
                >
                  <Icon name="package-check" size={24} className="text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 font-medium">{sample.jobNo ?? t("sample")} · {t("pieces", { count: format.number(sample.quantity) })}</span>
                  <span className="text-primary font-semibold">{t("recordSample")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
