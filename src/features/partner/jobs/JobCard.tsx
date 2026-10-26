import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { JOB_STATUS } from "@/domain/status";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Icon } from "@/ui/icons";

import { Countdown } from "./Countdown";

export type JobSummary = Schemas["PartnerJobDto"];

/** A step's name in the reader's language (`MilestoneDto.nameTh` / `nameEn`). */
export const stepName = (step: { nameTh: string; nameEn: string }, locale: string) =>
  locale === "en" ? step.nameEn : step.nameTh;

/**
 * What a job is, in words: the product type's name (the quantity is shown beside it in its own
 * words), falling back to the API's `title` — which spells the unit as the spec stores it ("piece").
 */
export const jobName = (job: Pick<JobSummary, "productTypeNameTh" | "title">) => job.productTypeNameTh ?? job.title;

/** One job as the floor scans a list: number, what it is, where it stands, what is due. */
export async function JobCard({ job }: { job: JobSummary }) {
  const [t, format, locale] = await Promise.all([getTranslations("partnerJobs.card"), getFormat(), getLocale()]);
  const current = job.milestones.find((step) => step.key === job.currentMilestoneKey);
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group border-border bg-surface hover:border-border-strong flex h-full flex-col rounded-xl border transition-colors"
    >
      <span className="flex flex-col gap-1.5 p-4 lg:p-3.5">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-sm font-semibold tabular-nums">{job.jobNo}</span>
          <StatusChip map={JOB_STATUS} value={job.status} />
        </span>
        <span className="font-semibold">{jobName(job)}</span>
        <span className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="package" size={16} aria-hidden />
            {t("quantity", { quantity: format.number(job.quantityOrdered) })}
          </span>
          {job.promisedShipDate ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="truck" size={16} aria-hidden />
              {t("ship", { date: format.date(job.promisedShipDate) })}
            </span>
          ) : null}
          {current ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="route" size={16} aria-hidden />
              {t("step", { name: stepName(current, locale) })}
            </span>
          ) : null}
        </span>
        {job.atRisk || job.inspectionRequired ? (
          <span className="flex flex-wrap gap-1.5">
            {job.atRisk ? (
              <Badge tone="danger" size="sm" icon="warning">
                {t("late")}
              </Badge>
            ) : null}
            {job.inspectionRequired ? (
              <Badge size="sm" icon="shield">
                {t("inspection")}
              </Badge>
            ) : null}
          </span>
        ) : null}
      </span>
      {job.status === "released" ? (
        <span className="border-border bg-warning-subtle/40 mt-auto flex items-center justify-between gap-2 rounded-b-xl border-t px-4 py-2.5 text-sm md:px-3.5 md:py-2">
          <Countdown dueAt={job.acceptDueAt} />
          <span className="text-primary inline-flex items-center gap-1 font-medium group-hover:underline">
            {t("open")}
            <Icon name="arrow-right" size={16} aria-hidden />
          </span>
        </span>
      ) : null}
    </Link>
  );
}
