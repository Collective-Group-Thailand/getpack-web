import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { INSPECTION_STATUS, JOB_ISSUE_STATUS, JOB_STATUS, QC_RESULT } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { addressLine } from "@/features/partner/address";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import {
  AcceptJob,
  CompleteMilestone,
  QcForm,
  RaiseIssue,
  RejectJob,
  ResolveIssue,
  StartMilestone,
} from "@/features/partner/jobs/actions";
import { Countdown } from "@/features/partner/jobs/Countdown";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { StageStepper, type StageState } from "@/ui/components/StageStepper";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.detail"))("metaTitle") };
}

/**
 * One job on the shop floor (F5 5.2): accept or reject within the window (D-074), then the
 * milestones in order with the one next action open, QC with photos (D-076), the spec, the
 * approved artwork only, the PO, recipients by name, address and phone only (D-142), Packio's
 * inspection notices, issues and history. Every write re-renders from the server's state.
 */
export default async function JobPage({ params }: Props) {
  const { jobId } = await params;
  const t = await getTranslations("partnerJobs.detail");
  const tStages = await getTranslations("partnerJobs.stages");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const found = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/jobs/{jobId}", {
      path: { factoryId: context.factoryId, jobId },
    }),
  );
  const back = { href: "/jobs", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const job = found.data;
  const current = job.milestones.find((milestone) => milestone.status !== "completed");
  const stateOf = (status: string, isCurrent: boolean): StageState =>
    status === "completed" ? "done" : status === "skipped" ? "skipped" : isCurrent ? "current" : "upcoming";
  const passedQc = job.qcChecks.some((check) => check.result !== "fail");

  return (
    <PartnerPage
      title={job.jobNo}
      back={back}
      meta={<StatusChip map={JOB_STATUS} value={job.status} size="md" />}
      description={t("summary", {
        title: job.title,
        quantity: format.number(job.quantity),
        date: format.date(job.promisedShipDate),
      })}
      wide
    >
      {job.status === "released" ? (
        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("acceptTitle")}</h2>
          <Countdown dueAt={job.acceptDueAt} large />
          <AcceptJob job={job} />
          <RejectJob job={job} />
        </Card>
      ) : null}
      {job.status === "rejected" ? (
        <Callout tone="neutral" title={t("rejectedTitle")}>
          {job.rejectedReason ? t(`rejectReasons.${job.rejectedReason}`) : null}
        </Callout>
      ) : null}
      {job.atRisk && job.riskReason ? (
        <Callout tone="warning" icon="warning" title={t("atRisk")}>
          {job.riskReason}
        </Callout>
      ) : null}

      {job.milestones.length ? (
        <PartnerSection title={t("milestones")} id="milestones">
          <StageStepper
            label={t("milestones")}
            stateLabels={{
              done: tStages("done"),
              current: tStages("current"),
              upcoming: tStages("upcoming"),
              skipped: tStages("skipped"),
            }}
            stages={job.milestones.map((milestone) => {
              const isCurrent = milestone.seq === current?.seq;
              return {
                key: milestone.key,
                title: milestone.name,
                state: stateOf(milestone.status, isCurrent),
                meta:
                  milestone.status === "completed" ? (
                    <span>
                      {milestone.quantityOut !== null
                        ? t("stepDone", {
                            good: format.number(milestone.quantityOut),
                            scrap: format.number(milestone.quantityScrap ?? 0),
                          })
                        : t("stepDoneNoQty")}
                      {milestone.photos.length ? ` · ${t("photos", { count: milestone.photos.length })}` : ""}
                      {milestone.completedAt ? ` · ${format.dateTime(milestone.completedAt)}` : ""}
                    </span>
                  ) : milestone.dueAt ? (
                    t("due", { date: format.dateTime(milestone.dueAt) })
                  ) : null,
                children: isCurrent ? (
                  milestone.status === "pending" ? (
                    <StartMilestone job={job} milestone={milestone} />
                  ) : (
                    <>
                      {milestone.requiresQc && !passedQc ? <QcForm job={job} /> : null}
                      <CompleteMilestone job={job} milestone={milestone} />
                    </>
                  )
                ) : undefined,
              };
            })}
          />
        </PartnerSection>
      ) : null}

      {job.nextActions.includes("ship") && canAt(context, "factory_shipments.read") ? (
        <Link
          href={`/ship#job-${job.id}`}
          className="bg-primary text-primary-fg hover:bg-primary-hover inline-flex min-h-16 items-center justify-center gap-2 rounded-xl px-6 text-xl font-semibold"
        >
          <Icon name="truck" size={28} />
          {t("toShip")}
        </Link>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <PartnerSection title={t("spec")}>
          <Card padding="md">
            <DescriptionList
              columns={1}
              items={job.spec.map((line) => ({ term: line.label, description: line.value }))}
            />
          </Card>
        </PartnerSection>

        <PartnerSection title={t("artwork")}>
          {job.artwork ? (
            <Card padding="md" className="flex flex-col gap-3">
              <div className="bg-surface-subtle relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg">
                {job.artwork.proof.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL
                  <img
                    src={job.artwork.proof.thumbnailUrl}
                    alt={t("proofAlt", { version: job.artwork.versionNo })}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Icon name="document" size={48} className="text-muted" />
                )}
                <span
                  aria-hidden
                  className="text-danger/60 border-danger/60 absolute rotate-[-18deg] rounded-md border-4 px-3 py-1 text-3xl font-black tracking-widest"
                >
                  {t("watermark", { version: job.artwork.versionNo })}
                </span>
              </div>
              <p className="text-sm">
                {t("approvedOn", { version: job.artwork.versionNo, date: format.dateTime(job.artwork.approvedAt) })}
              </p>
              <div className="flex flex-wrap gap-3">
                {job.artwork.proof.url ? (
                  <a
                    href={job.artwork.proof.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex min-h-12 items-center underline"
                  >
                    {t("openProof")}
                  </a>
                ) : null}
                {job.artwork.dieline?.url ? (
                  <a
                    href={job.artwork.dieline.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex min-h-12 items-center underline"
                  >
                    {t("openDieline")}
                  </a>
                ) : null}
              </div>
            </Card>
          ) : (
            <p className="text-muted">{t("noArtwork")}</p>
          )}
        </PartnerSection>

        <PartnerSection title={t("po")}>
          <Card padding="md">
            <DescriptionList
              columns={1}
              items={[
                { term: t("poNumber"), description: <span className="font-mono">{job.purchaseOrder.poNumber}</span> },
                { term: t("poIssued"), description: format.dateTime(job.purchaseOrder.issuedAt) },
                {
                  term: t("poAmount"),
                  description: <span className="tabular-nums">{format.thb(job.purchaseOrder.buyAmount)}</span>,
                },
                {
                  term: t("tolerance"),
                  description: t("toleranceValue", {
                    shortage: format.percent(job.tolerance.shortagePct),
                    overage: format.percent(job.tolerance.overagePct),
                  }),
                },
              ]}
            />
          </Card>
        </PartnerSection>

        <PartnerSection title={t("destinations")} description={t("destinationsNote")}>
          <ul className="flex flex-col gap-2">
            {job.destinations.map((destination) => (
              <li key={destination.id}>
                <Card padding="md">
                  <p className="font-medium">{destination.recipientName}</p>
                  <p className="text-sm">{addressLine(destination)}</p>
                  <p className="text-sm">
                    <a href={`tel:${destination.phone}`} className="text-primary underline">
                      {destination.phone}
                    </a>
                  </p>
                  <p className="text-muted mt-1 text-sm">
                    {t("destinationQty", {
                      quantity: format.number(destination.quantity),
                      shipped: format.number(destination.shippedQuantity),
                    })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </PartnerSection>
      </div>

      {job.qcChecks.length || job.inspections.length ? (
        <PartnerSection title={t("quality")}>
          <ul className="flex flex-col gap-2">
            {job.qcChecks.map((check) => (
              <li key={check.id}>
                <Card padding="md" className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t("qcBy", { name: check.performedBy.displayName })}</span>
                    <StatusChip map={QC_RESULT} value={check.result} />
                  </span>
                  <span className="text-muted text-sm">
                    {format.dateTime(check.performedAt)} · {t("photos", { count: check.photos.length })}
                    {check.defects.length
                      ? ` · ${check.defects.map((defect) => `${defect.label} ${format.number(defect.count)}`).join(", ")}`
                      : ""}
                  </span>
                </Card>
              </li>
            ))}
            {job.inspections.map((inspection) => (
              <li key={inspection.id}>
                <Callout tone="info" icon="shield" title={t("inspection")}>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusChip map={INSPECTION_STATUS} value={inspection.status} />
                    {inspection.plannedFor ? t("inspectionOn", { date: format.date(inspection.plannedFor) }) : null}
                  </span>
                  <span className="mt-1 block text-sm">{inspection.reasons.join(" · ")}</span>
                  {inspection.notes ? <span className="mt-1 block text-sm">{inspection.notes}</span> : null}
                </Callout>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("issues")}>
        {job.issues.length ? (
          <ul className="flex flex-col gap-2">
            {job.issues.map((issue) => (
              <li key={issue.id}>
                <Card padding="md" className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{issue.description}</span>
                    <span className="text-muted text-sm">
                      {issue.raisedBy.displayName} · {format.dateTime(issue.raisedAt)}
                    </span>
                  </span>
                  <StatusChip map={JOB_ISSUE_STATUS} value={issue.status} />
                  {issue.status === "open" ? <ResolveIssue jobId={job.id} issueId={issue.id} /> : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
        {job.nextActions.includes("raise_issue") ? (
          <Card padding="lg">
            <RaiseIssue job={job} />
          </Card>
        ) : null}
      </PartnerSection>

      {job.history.length ? (
        <PartnerSection title={t("history")}>
          <ol className="border-border flex flex-col gap-2 border-s-2 ps-4">
            {job.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="text-sm">
                <span className="text-muted">{format.dateTime(entry.at)}</span> · {entry.text}
                {entry.actor ? <span className="text-muted"> · {entry.actor.displayName}</span> : null}
              </li>
            ))}
          </ol>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
