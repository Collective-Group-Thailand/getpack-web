import { getLocale, getTranslations } from "next-intl/server";

import { JOB_STATUS } from "@/domain/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Badge } from "@/ui/components/Badge";

import { Countdown } from "./Countdown";
import { jobName, stepName, type JobSummary } from "./JobCard";

/**
 * The factory's jobs as a table — the way a planner reads a job board: one line per job, the
 * columns he scans down (when it ships, which step it is at, what he must do) side by side.
 * A phone gets one card per job with the same names.
 */
export async function JobsTable({ jobs, caption }: { jobs: JobSummary[]; caption: string }) {
  const [t, format, locale] = await Promise.all([getTranslations("partnerJobs.table"), getFormat(), getLocale()]);
  return (
    <PartnerTable
      caption={caption}
      rows={jobs}
      rowKey={(job) => job.id}
      rowHref={(job) => `/jobs/${job.id}`}
      rowTone={(job) => (job.atRisk ? "danger" : job.status === "released" ? "warning" : undefined)}
      columns={[
        {
          key: "no",
          header: t("no"),
          primary: true,
          cell: (job) => <span className="font-mono font-semibold whitespace-nowrap md:text-sm md:font-normal">{job.jobNo}</span>,
        },
        {
          key: "product",
          header: t("product"),
          cell: (job) => (
            <span className="flex flex-col gap-1">
              <span>{jobName(job)}</span>
              {job.atRisk || job.inspectionRequired ? (
                <span className="flex flex-wrap gap-1">
                  {job.atRisk ? (
                    <Badge tone="danger" size="sm">
                      {t("late")}
                    </Badge>
                  ) : null}
                  {job.inspectionRequired ? <Badge size="sm">{t("inspection")}</Badge> : null}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: "quantity",
          header: t("quantity"),
          align: "end",
          cell: (job) => format.number(job.quantityOrdered),
        },
        {
          key: "ship",
          header: t("ship"),
          cell: (job) => (job.promisedShipDate ? format.date(job.promisedShipDate, { style: "dayMonth" }) : "—"),
          className: "whitespace-nowrap",
        },
        {
          key: "step",
          header: t("step"),
          cell: (job) => {
            const step = job.milestones.find((item) => item.key === job.currentMilestoneKey);
            return step ? (
              <span className="flex flex-col">
                <span>{stepName(step, locale)}</span>
                {job.status === "released" ? (
                  <span className="text-sm">
                    <Countdown dueAt={job.acceptDueAt} wrap />
                  </span>
                ) : step.dueAt ? (
                  <span className="text-muted text-sm whitespace-nowrap">
                    {t("due", { date: format.date(step.dueAt, { style: "dayMonth" }) })}
                  </span>
                ) : null}
              </span>
            ) : (
              "—"
            );
          },
        },
        {
          key: "status",
          header: t("status"),
          cell: (job) => <StatusChip map={JOB_STATUS} value={job.status} />,
          className: "whitespace-nowrap",
        },
      ]}
    />
  );
}
