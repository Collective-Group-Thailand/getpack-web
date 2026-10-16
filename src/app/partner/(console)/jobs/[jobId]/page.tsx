import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_PRODUCTION_STATUS, INSPECTION_STATUS, JOB_ISSUE_STATUS, JOB_STATUS, QC_RESULT } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { addressLine } from "@/features/partner/address";
import { ViewFile } from "@/features/partner/viewer";
import { termsFrom, TermsHelp } from "@/features/partner/terms";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import {
  AcceptJob,
  CompleteMilestone,
  QcForm,
  RaiseIssue,
  RejectJob,
  ResolveIssue,
  QuickCompleteMilestone,
  StartMilestone,
} from "@/features/partner/jobs/actions";
import { Countdown } from "@/features/partner/jobs/Countdown";
import { needsQcForm } from "@/features/partner/jobs/evidence";
import { jobName, stepName } from "@/features/partner/jobs/JobCard";
import { specLines } from "@/features/partner/jobs/spec";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Badge } from "@/ui/components/Badge";
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
 * One job on the shop floor (F5 5.2) on `partner.production.*`: accept or reject within the window
 * (D-074), then the milestones in order with the one next action open, QC with photos (D-076),
 * the spec, the approved artwork only (opened by its signed URL), the factory's own PO, recipients
 * by name, address and phone only (D-142), getpack's inspection and the issues. What the factory
 * may do comes from the job's own `nextActions`; every write re-renders from the server's state.
 *
 * CONTRACT-GAP partner.jobs — the published job has no activity history, and the factory's view
 * of getpack's inspection has no reasons or notes; neither is shown.
 */
export default async function JobPage({ params }: Props) {
  const { jobId } = await params;
  const [t, tStages, tIssue, tQc, tSpec, format, locale] = await Promise.all([
    getTranslations("partnerJobs.detail"),
    getTranslations("partnerJobs.stages"),
    getTranslations("partnerJobs.issue"),
    getTranslations("partnerJobs.qc"),
    getTranslations("partnerJobs.spec"),
    getFormat(),
    getLocale(),
  ]);
  const tTerms = await getTranslations("partner.terms");
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const path = { jobId };
  const found = await attempt(
    async () => (await contract.GET("/v1/partner/production-jobs/{jobId}", { params: { path } })).data!,
  );
  const back = { href: "/jobs", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const job = found.data;
  const download = (fileId: string | null) =>
    fileId
      ? attempt(
          async () =>
            (await contract.GET("/v1/partner/files/{fileId}/download", { params: { path: { fileId } } })).data!.url,
        ).then((result) => result.data)
      : Promise.resolve(null);
  const [qc, issues, po, proofUrl, dielineUrl] = await Promise.all([
    attempt(
      async () => (await contract.GET("/v1/partner/production-jobs/{jobId}/qc-checks", { params: { path } })).data!,
    ),
    attempt(async () => (await contract.GET("/v1/partner/production-jobs/{jobId}/issues", { params: { path } })).data!),
    canAt(context, "factory_payables.read")
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/purchase-orders", { params: { query: { q: job.jobNo, perPage: 5 } } })
            ).data!.data.find((item) => item.jobNo === job.jobNo) ?? null,
        ).then((result) => result.data)
      : null,
    download(job.approvedFileId),
    download(job.dielineFileId),
  ]);
  // The ERP's production order for this job (made on acceptance): where the factory plans and records it.
  const mo =
    context.factoryId && canAt(context, "factory_planning.read")
      ? (
          await attempt(
            async () =>
              (
                await contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders", {
                  params: { path: { factoryId: context.factoryId }, query: { q: job.jobNo, source: "getpack_job", perPage: 5 } },
                })
              ).data!.data.find((order) => order.title.startsWith(job.jobNo)) ?? null,
          )
        ).data
      : null;
  const [tTable] = await Promise.all([getTranslations("partnerJobs.table")]);
  const offered = new Set(job.nextActions.filter((action) => !action.disabledReason).map((action) => action.key));
  // A QC inspector records quality, not production (round 2, Phase 1): the steps of the floor are
  // shown to them, but their start / finish buttons are the operators' — except the QC step itself.
  const qcOnly = context.roles.length > 0 && context.roles.every((role) => role === "factory_qc");
  const mayRun = (milestone: { evidence: (typeof job.milestones)[number]["evidence"] }) =>
    offered.has("job.update_milestone") && (!qcOnly || needsQcForm(milestone));
  // Why the step's buttons are not here — said so the reader knows what to do next, not just "no".
  const blocked =
    job.status === "released" ? t("acceptFirst") : qcOnly ? t("operatorStep") : t("noMilestonePermission");
  // Nothing to record on the step (no counts, no photo, no QC form): one tap marks it done.
  const simple = (milestone: (typeof job.milestones)[number]) =>
    !milestone.tracksQuantity && milestone.evidence === "none";
  const checks = qc.data ?? [];
  const current = job.milestones.find((milestone) => milestone.key === job.currentMilestoneKey);
  const stateOf = (status: string, isCurrent: boolean): StageState =>
    status === "completed" ? "done" : status === "skipped" ? "skipped" : isCurrent ? "current" : "upcoming";
  // The step's QC form is the latest check, and it must not have failed (D-076).
  const latest = [...checks].sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
  const passedQc = Boolean(latest && latest.result !== "fail");
  const openIssues = (issues.data ?? []).filter((issue) => issue.status === "open");
  const spec = specLines(job.spec, (n) => format.number(n));

  return (
    <PartnerPage
      title={job.jobNo}
      back={back}
      meta={
        <span className="flex flex-wrap items-center gap-2">
          <StatusChip map={JOB_STATUS} value={job.status} size="md" />
          {job.kind !== "production" ? <Badge tone="info">{tTable(`kinds.${job.kind}`)}</Badge> : null}
        </span>
      }
      description={
        job.promisedShipDate
          ? t("summary", {
              title: jobName(job),
              quantity: format.number(job.quantityOrdered),
              date: format.date(job.promisedShipDate),
            })
          : t("summaryNoDate", { title: jobName(job), quantity: format.number(job.quantityOrdered) })
      }
      wide
    >
      {job.kind !== "production" ? (
        <Callout tone="info">{t(`kindNote.${job.kind}`, { quantity: format.number(job.quantityOrdered) })}</Callout>
      ) : null}
      {canAt(context, "factory_planning.read") && job.status !== "released" && job.kind !== "mockup" ? (
        <Card padding="md" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("erpTitle")}</h2>
            {mo ? (
              <Link href={`/planning/orders/${mo.id}`} className="text-primary text-sm font-medium underline underline-offset-2">
                {t("erpOpen", { no: mo.moNo })}
              </Link>
            ) : null}
          </div>
          {mo ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusChip map={ERP_PRODUCTION_STATUS} value={mo.status} />
              <Badge tone={mo.short ? "warning" : "success"}>{mo.short ? t("erpShort") : t("erpReady")}</Badge>
              <span className="text-muted">{t("erpProgress", { pct: Math.round(Number(mo.progressPct)) })}</span>
              {mo.dueOn ? <span className="text-muted">{t("erpDue", { date: format.date(mo.dueOn) })}</span> : null}
            </div>
          ) : (
            <p className="text-muted text-sm">{t("erpNone")}</p>
          )}
          <p className="text-muted text-xs">{t("erpBody")}</p>
        </Card>
      ) : null}
      {job.status === "released" ? (
        <Card padding="md" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("acceptTitle")}</h2>
          <Countdown dueAt={job.acceptDueAt} large />
          {/* What the owner is saying yes to, before he says it — not three sections further down. */}
          <DescriptionList
            columns={2}
            items={[
              { term: t("acceptSummary.product"), description: jobName(job) },
              { term: t("acceptSummary.quantity"), description: format.number(job.quantityOrdered) },
              ...(job.promisedShipDate
                ? [{ term: t("acceptSummary.ship"), description: format.date(job.promisedShipDate) }]
                : []),
              ...(po
                ? [
                    {
                      term: t("acceptSummary.amount"),
                      description: <span className="font-semibold tabular-nums">{format.thb(po.netAmount)}</span>,
                    },
                  ]
                : []),
            ]}
          />
          {spec.length ? (
            <a href="#spec" className="text-primary self-start font-medium underline underline-offset-4">
              {t("acceptSummary.seeSpec")}
            </a>
          ) : null}
          {offered.has("job.accept") ? (
            <AcceptJob job={job} poAmount={po?.netAmount ?? null} />
          ) : (
            <p className="text-muted">{t("plannerOnly")}</p>
          )}
          {offered.has("job.reject") ? <RejectJob job={job} /> : null}
        </Card>
      ) : null}
      {job.status === "rejected" ? (
        <Callout tone="neutral" title={t("rejectedTitle")}>
          {job.rejectReasonCode
            ? t.has(`rejectReasons.${job.rejectReasonCode}`)
              ? t(`rejectReasons.${job.rejectReasonCode}`)
              : job.rejectReasonCode
            : null}
          {job.rejectNote ? ` · ${job.rejectNote}` : null}
        </Callout>
      ) : null}
      {openIssues.length ? (
        <Callout tone="warning" icon="flag" title={t("openIssues", { count: openIssues.length })}>
          <ul className="flex flex-col gap-1">
            {openIssues.map((issue) => (
              <li key={issue.id}>{issue.description}</li>
            ))}
          </ul>
          <a href="#issues" className="mt-1 inline-block font-medium underline underline-offset-4">
            {t("openIssuesLink")}
          </a>
        </Callout>
      ) : null}
      {job.atRisk ? (
        <Callout tone="warning" icon="warning" title={t("atRisk")}>
          {job.riskReason ? t(`riskReasons.${job.riskReason}`) : null}
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
              const isCurrent = milestone.id === current?.id;
              const name = stepName(milestone, locale);
              const qcFirst = needsQcForm(milestone) && !passedQc;
              return {
                key: milestone.key,
                title: name,
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
                      {milestone.photoFileIds.length
                        ? ` · ${t("photos", { count: milestone.photoFileIds.length })}`
                        : ""}
                      {milestone.completedAt ? ` · ${format.dateTime(milestone.completedAt)}` : ""}
                    </span>
                  ) : isCurrent && job.status === "released" && job.acceptDueAt ? (
                    // Before acceptance the step's deadline is the acceptance deadline, not the plan's.
                    t("due", { date: format.dateTime(job.acceptDueAt) })
                  ) : milestone.dueAt ? (
                    // The plan splits the lead time evenly, so its clock times (02:24, 04:48) mean nothing on
                    // the floor; the day is what the factory plans by.
                    t("due", { date: format.date(milestone.dueAt) })
                  ) : null,
                children: isCurrent ? (
                  milestone.status === "pending" ? (
                    mayRun(milestone) ? (
                      simple(milestone) ? (
                        <QuickCompleteMilestone job={job} milestone={milestone} name={name} />
                      ) : (
                        <StartMilestone job={job} milestone={milestone} name={name} />
                      )
                    ) : (
                      <p className="text-muted">{blocked}</p>
                    )
                  ) : (
                    <>
                      {qcFirst ? (
                        offered.has("job.record_qc") ? (
                          <div id="qc" className="flex scroll-mt-24 flex-col gap-4">
                            <QcForm job={job} />
                            {/* The guide that applies here (U2.F7): the knowledge base's QC photo standard. */}
                            <Link
                              href="/knowledge?category=qc-photo-standard"
                              className="text-primary inline-flex min-h-11 items-center underline md:min-h-10"
                            >
                              {tQc("photoStandard")}
                            </Link>
                          </div>
                        ) : (
                          <p className="text-muted">{tQc("qcOnly")}</p>
                        )
                      ) : null}
                      {qcFirst ? (
                        <p className="text-muted">{t("qcFirst")}</p>
                      ) : mayRun(milestone) ? (
                        <CompleteMilestone job={job} milestone={milestone} name={name} />
                      ) : (
                        <p className="text-muted">{blocked}</p>
                      )}
                    </>
                  )
                ) : undefined,
              };
            })}
          />
        </PartnerSection>
      ) : null}

      {offered.has("job.ship") ? (
        <Link
          href={`/ship#job-${job.id}`}
          data-big
          className="bg-primary text-primary-fg hover:bg-primary-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 text-lg font-semibold md:min-h-10"
        >
          <Icon name="truck" size={22} />
          {t("toShip")}
        </Link>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {spec.length ? (
          <PartnerSection title={t("spec")} id="spec">
            <Card padding="md">
              <DescriptionList
                columns={2}
                items={spec.map((line) => ({
                  term: tSpec(`${line.key}.term`),
                  description: tSpec(`${line.key}.value`, line.values ?? {}),
                }))}
              />
            </Card>
          </PartnerSection>
        ) : null}

        <PartnerSection title={t("artwork")}>
          {job.artwork ? (
            <Card padding="md" className="flex flex-col gap-3">
              <div className="bg-surface-subtle relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg">
                <Icon name="document" size={48} className="text-muted" />
                {/* The approval reads as a stamp in the corner, in the colour of "approved" — not a red warning across the file. */}
                <span
                  aria-hidden
                  className="border-success text-success absolute end-3 top-3 rotate-[-6deg] rounded-md border-2 px-2.5 py-0.5 text-sm font-semibold"
                >
                  {t("watermark", { version: job.artwork.versionNo })}
                </span>
              </div>
              <p className="text-sm">
                {job.artwork.approvedAt
                  ? t("approvedOn", {
                      version: job.artwork.versionNo,
                      date: format.dateTime(job.artwork.approvedAt),
                    })
                  : t("approvedVersion", { version: job.artwork.versionNo })}
              </p>
              <div className="flex flex-wrap gap-3">
                {proofUrl ? (
                  <ViewFile src={proofUrl} title={t("openProof")}>
                    {t("openProof")}
                  </ViewFile>
                ) : null}
                {dielineUrl ? (
                  <ViewFile src={dielineUrl} title={t("openDieline")}>
                    {t("openDieline")}
                  </ViewFile>
                ) : null}
              </div>
            </Card>
          ) : (
            <p className="text-muted">{t("noArtwork")}</p>
          )}
        </PartnerSection>

        {po || job.tolerance ? (
          <PartnerSection title={t("po")}>
            <Card padding="md">
              <DescriptionList
                columns={2}
                items={[
                  ...(po
                    ? [
                        { term: t("poNumber"), description: <span className="font-mono">{po.poNumber}</span> },
                        { term: t("poIssued"), description: format.dateTime(po.issuedAt) },
                        {
                          term: t("poAmount"),
                          description: <span className="tabular-nums">{format.thb(po.netAmount)}</span>,
                        },
                      ]
                    : []),
                  ...(job.tolerance
                    ? [
                        {
                          term: t("tolerance"),
                          description: t("toleranceValue", {
                            shortage: format.percent(job.tolerance.shortagePct),
                            overage: format.percent(job.tolerance.overagePct),
                          }),
                        },
                      ]
                    : []),
                ]}
              />
            </Card>
          </PartnerSection>
        ) : null}

        <PartnerSection title={t("destinations")} description={t("destinationsNote")}>
          <ul className="flex flex-col gap-2">
            {job.destinations.map((destination) => (
              <li key={destination.id}>
                <Card padding="md">
                  <p className="font-medium">{destination.recipientName}</p>
                  <p className="text-sm">
                    {addressLine({
                      ...destination,
                      province: locale === "en" ? destination.provinceNameEn : destination.provinceNameTh,
                    })}
                  </p>
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

      {checks.length || job.inspection ? (
        <PartnerSection title={t("quality")}>
          <ul className="flex flex-col gap-2">
            {checks.map((check) => (
              <li key={check.id}>
                <Card padding="md" className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {check.performedBy ? t("qcBy", { name: check.performedBy.displayName }) : t("qcRecorded")}
                    </span>
                    <StatusChip map={QC_RESULT} value={check.result} />
                  </span>
                  <span className="text-muted text-sm">
                    {format.dateTime(check.performedAt)} · {t("photos", { count: check.photoFileIds.length })}
                    {check.defects.length
                      ? ` · ${check.defects
                          .map((defect) =>
                            t("defect", {
                              item: tQc.has(`items.${defect.code}`) ? tQc(`items.${defect.code}`) : defect.code,
                              severity: tQc(`severity.${defect.severity}`),
                              count: format.number(defect.count),
                            }),
                          )
                          .join(", ")}`
                      : ""}
                  </span>
                </Card>
              </li>
            ))}
            {job.inspection ? (
              <li>
                <Callout tone="info" icon="shield" title={t("inspection")}>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusChip map={INSPECTION_STATUS} value={job.inspection.status} />
                    {job.inspection.scheduledAt
                      ? t("inspectionOn", { date: format.date(job.inspection.scheduledAt) })
                      : null}
                  </span>
                  <span className="mt-1 block text-sm">
                    {t("inspectionSample", { count: format.number(job.inspection.sampleSize) })}
                  </span>
                </Callout>
              </li>
            ) : null}
          </ul>
        </PartnerSection>
      ) : null}

      <TermsHelp title={tTerms("title")} terms={termsFrom(tTerms.raw, ["po", "tolerance", "proof"])} />
      <PartnerSection title={t("issues")} id="issues">
        {issues.data?.length ? (
          <ul className="flex flex-col gap-2">
            {issues.data.map((issue) => (
              <li key={issue.id}>
                <Card padding="md" className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{issue.description}</span>
                    <span className="text-muted text-sm">
                      {tIssue.has(`kinds.${issue.kind}`) ? tIssue(`kinds.${issue.kind}`) : issue.kind}
                      {issue.raisedBy ? ` · ${issue.raisedBy.displayName}` : ""} · {format.dateTime(issue.createdAt)}
                    </span>
                    {issue.resolutionNote ? (
                      <span className="text-muted block text-sm">
                        {t("issueResolved", {
                          note: issue.resolutionNote,
                          name: issue.resolvedBy?.displayName ?? "",
                        })}
                      </span>
                    ) : null}
                  </span>
                  <StatusChip map={JOB_ISSUE_STATUS} value={issue.status} />
                  {issue.status === "open" && offered.has("job.raise_issue") ? (
                    <ResolveIssue jobId={job.id} issueId={issue.id} description={issue.description} />
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
        {offered.has("job.raise_issue") ? (
          // Folded until needed: most visits to a job never raise one.
          <details className="border-border bg-surface group rounded-xl border">
            <summary className="hover:bg-surface-subtle flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 font-medium md:min-h-10">
              <Icon name="flag" size={18} />
              {t("raiseIssueToggle")}
            </summary>
            <div className="border-border border-t p-4">
              <RaiseIssue job={job} />
            </div>
          </details>
        ) : null}
      </PartnerSection>
    </PartnerPage>
  );
}
