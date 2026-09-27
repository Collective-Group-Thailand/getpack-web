import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { JOB_STATUS } from "@/domain/status";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Badge } from "@/ui/components/Badge";
import { Icon } from "@/ui/icons";

import { Countdown } from "./Countdown";

export type JobSummary = ResponseOf<Requests, "GET /v1/partner/factories/{factoryId}/jobs">["data"][number];

/** One job as the floor scans a list: number, what it is, where it stands, what is due. */
export async function JobCard({ job }: { job: JobSummary }) {
  const t = await getTranslations("partnerJobs.card");
  const format = await getFormat();
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="border-border bg-surface hover:bg-surface-subtle flex min-h-20 flex-col gap-2 rounded-xl border p-3"
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">{job.jobNo}</span>
        <StatusChip map={JOB_STATUS} value={job.status} />
        {job.views.includes("late") ? (
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
      <span className="font-medium">{job.title}</span>
      <span className="text-muted flex flex-wrap gap-x-3 text-sm">
        <span>{t("quantity", { quantity: format.number(job.quantity) })}</span>
        <span>{t("ship", { date: format.date(job.promisedShipDate) })}</span>
        {job.current ? <span>{t("step", { name: job.current.name })}</span> : null}
      </span>
      {job.status === "released" ? <Countdown dueAt={job.acceptDueAt} /> : null}
    </Link>
  );
}
