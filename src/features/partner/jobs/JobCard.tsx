import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { JOB_STATUS } from "@/domain/status";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
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
      className="border-border bg-surface hover:bg-surface-subtle flex min-h-20 flex-col gap-2 rounded-xl border p-3"
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">{job.jobNo}</span>
        <StatusChip map={JOB_STATUS} value={job.status} />
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
        <Icon name="chevron-right" size={24} className="text-muted ms-auto" />
      </span>
      <span className="font-medium">{jobName(job)}</span>
      <span className="text-muted flex flex-wrap gap-x-3 text-sm">
        <span>{t("quantity", { quantity: format.number(job.quantityOrdered) })}</span>
        {job.promisedShipDate ? <span>{t("ship", { date: format.date(job.promisedShipDate) })}</span> : null}
        {current ? <span>{t("step", { name: stepName(current, locale) })}</span> : null}
      </span>
      {job.status === "released" ? <Countdown dueAt={job.acceptDueAt} /> : null}
    </Link>
  );
}
