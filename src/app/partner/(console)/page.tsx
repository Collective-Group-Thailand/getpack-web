import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerPage, PartnerSection } from "@/features/partner/frame";
import { JobsTable } from "@/features/partner/jobs/JobsTable";
import { awaitsSignOff } from "@/features/partner/onboarding/steps";
import { loadPrices } from "@/features/partner/prices/server";
import { getFormat } from "@/features/shared/format/server";
import { Card } from "@/ui/components/Card";
import { Meter } from "@/ui/components/Meter";
import { Icon, type IconName } from "@/ui/icons";
import { Button } from "@/ui/components/Button";
import { Row, RowList, StatStrip } from "@/features/partner/rows";

/**
 * The partner zone's landing screen: what is waiting for this factory today.
 *
 * While the factory is onboarding that is its progress and the steps Packio entered for it to
 * sign off; for every factory, the price items waiting for an answer (a rate card, prices to sign
 * off, counters). From trial on, the floor comes first: counters (to accept and overdue, due
 * today, at risk, on hold, inspections planned), alerts and the queue in the order to work it
 * (`partner.production.today`). Statements to check and claims to answer come from their lists
 * (`partner.payables.listStatements`, `partner.claims.list`), a claim when it offers `claim.respond`.
 */
export default async function PartnerHomePage() {
  const [t, locale] = await Promise.all([getTranslations("partnerToday"), getLocale()]);
  const context = await factoryContext();
  const factory = context.factory;
  const onboarding = factory && ["applied", "under_review", "trial"].includes(factory.status);
  const { contract } = await partnerServerApis();
  const producing =
    factory && ["trial", "active", "suspended"].includes(factory.status) && canAt(context, "factory_jobs.read");
  // A role with one job opens on it (round 2, Phase 1): QC on its queue, shipping on today's trips.
  const only = (role: string) => context.roles.length > 0 && context.roles.every((r) => r === role);
  if (producing && only("factory_qc")) redirect("/qc");
  if (producing && only("factory_shipping")) redirect("/ship");
  const [steps, prices, floor] = await Promise.all([
    onboarding
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/onboarding-steps", {
                params: { path: { factoryId: context.factoryId } },
              })
            ).data ?? [],
        )
      : null,
    canAt(context, "factory_prices.read") ? loadPrices(context.factoryId) : null,
    producing
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/today", {
                params: { path: { factoryId: context.factoryId } },
              })
            ).data!,
        )
      : null,
  ]);
  const [statements, claims, samples] = await Promise.all([
    canAt(context, "factory_payables.manage")
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/billing-statements", {
                params: { query: { factoryId: context.factoryId, status: "sent" } },
              })
            ).data!,
        )
      : null,
    canAt(context, "factory_claims.respond")
      ? attempt(
          async () =>
            (await contract.GET("/v1/partner/claims", { params: { query: { status: "factory_review" } } })).data!,
        )
      : null,
    // Sample jobs to make and record (U2.F7): counted on Today like the rest of the work.
    producing
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
  const samplesToRecord = (samples?.data?.data ?? []).filter(
    (sample) => !sample.evidence.recordedAt && ["paid", "in_production"].includes(sample.status),
  ).length;
  const claimsToAnswer = claims?.data?.data.length ?? 0;
  const [tFloor, format] = await Promise.all([getTranslations("partnerToday.floor"), getFormat()]);

  const tasks: {
    key: string;
    href: string;
    icon: IconName;
    title: string;
    body: string;
    tone?: "warning" | "danger";
  }[] = [];
  const toSignOff = (steps?.data ?? []).filter(awaitsSignOff).length;
  if (toSignOff)
    tasks.push({
      key: "steps",
      href: "/onboarding",
      icon: "stamp",
      title: t("tasks.signOff", { count: toSignOff }),
      body: t("tasks.signOffBody"),
    });
  for (const item of prices?.proposals ?? []) {
    if (item.direction === "packio_to_factory" && ["submitted", "under_review"].includes(item.status))
      tasks.push({
        key: item.id,
        href: `/prices/proposals/${item.id}`,
        icon: "handshake",
        title: t("tasks.rateCard", { type: prices!.typeName(item.productTypeId) }),
        body: t("tasks.rateCardBody", { count: item.lineCounts.pending }),
      });
    if (item.direction === "factory_to_packio" && item.status === "countered")
      tasks.push({
        key: item.id,
        href: `/prices/proposals/${item.id}`,
        icon: "scale",
        title: t("tasks.countered", { type: prices!.typeName(item.productTypeId) }),
        body: t("tasks.counteredBody", { count: item.lineCounts.countered }),
      });
  }
  for (const statement of statements?.data?.data ?? [])
    tasks.push({
      key: statement.id,
      href: `/billing/${statement.id}`,
      icon: "receipt",
      title: t("tasks.statement", { no: statement.bsNumber }),
      body: t("tasks.statementBody"),
    });
  // The ones the API offers the factory an answer on (`claim.respond`).
  for (const claim of (claims?.data?.data ?? []).filter((item) =>
    item.nextActions.some((action) => action.key === "claim.respond"),
  ))
    tasks.push({
      key: claim.id,
      href: `/claims/${claim.id}`,
      icon: "shield-alert",
      tone: "danger",
      title: t("tasks.claim", { no: claim.claimNo }),
      body: t("tasks.claimBody"),
    });
  for (const list of prices?.lists.data ?? [])
    for (const version of list.upcoming)
      if (version.origin === "assisted_entry" && !version.factorySignedOffAt)
        tasks.push({
          key: version.id,
          href: `/prices/${list.productTypeCode}?version=${version.id}`,
          icon: "stamp",
          title: t("tasks.pricesToSignOff", { type: prices!.typeName(list.productTypeId) }),
          body: t("tasks.pricesToSignOffBody", { lines: version.lineCount }),
        });

  // The floor's alerts lead the to-do list, as rows like the rest: an overdue one in red, a planned
  // inspection as information — not a coloured box of its own above everything else.
  for (const alert of [...(floor?.data?.alerts ?? [])].reverse())
    tasks.unshift({
      key: `${alert.kind}-${alert.jobId}`,
      href: `/jobs/${alert.jobId}`,
      icon: alert.kind === "inspection_planned" ? "shield" : "warning",
      tone:
        alert.kind === "acceptance_overdue" || alert.kind === "step_overdue"
          ? "danger"
          : alert.kind === "inspection_planned"
            ? undefined
            : "warning",
      title: alert.jobNo,
      body: alert.dueAt
        ? tFloor(`alerts.${alert.kind}`, { at: format.dateTime(alert.dueAt) })
        : tFloor(`alertsUndated.${alert.kind}`),
    });

  return (
    <PartnerPage
      wide
      title={t("title")}
      // The factory's name is in the sidebar and the bar already; the page says whose day and which day.
      // The date only: the factory's name and status are in the sidebar, the user's name in the bar.
      description={format.date(new Date().toISOString(), { style: "long" })}
    >
      {onboarding && factory ? (
        <Card padding="md" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t(`stage.${factory.status}`)}</h2>
          <Meter
            label={t("progressLabel")}
            value={factory.onboarding.total ? (factory.onboarding.done / factory.onboarding.total) * 100 : 0}
            valueText={t("progress", { done: factory.onboarding.done, total: factory.onboarding.total })}
          />
          <Link
            href="/onboarding"
            className="bg-primary text-primary-fg hover:bg-primary-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 font-semibold md:min-h-10"
          >
            {t("continue")}
            <Icon name="arrow-right" size={20} />
          </Link>
        </Card>
      ) : null}

      {floor?.data ? (
        <>
          {(() => {
            const counters = [
              ["toAccept", "/jobs?view=to_accept", "inbox", floor.data.counters.awaitingAcceptance],
              ["dueToday", "/jobs?view=in_production", "calendar", floor.data.counters.milestonesDueToday],
              ["atRisk", "/jobs?view=late", "warning", floor.data.counters.atRisk],
              ["onHold", "/jobs?view=all", "pause", floor.data.counters.onHold],
              ["inspections", "/jobs?view=all", "shield", floor.data.counters.inspectionsPlanned],
              ["samples", "/samples", "package-check", samplesToRecord],
              ["claims", "/claims", "shield-alert", claimsToAnswer],
            ] as const;
            const busy = counters.filter(([, , , value]) => value > 0);
            const clear = counters.filter(([, , , value]) => value === 0);
            return (
              <section aria-label={tFloor("countersLabel")} className="flex flex-col gap-2">
                {busy.length ? (
                  <StatStrip
                    label={tFloor("countersLabel")}
                    items={busy.map(([key, href, , value]) => {
                      const overdue = key === "toAccept" ? floor.data!.counters.acceptanceOverdue : 0;
                      return {
                        key,
                        href,
                        label: tFloor(`counters.${key}`),
                        value,
                        hint: overdue > 0 ? tFloor("acceptanceOverdue", { count: overdue }) : undefined,
                        tone:
                          (key === "atRisk" && value > 0) || overdue > 0 || (key === "claims" && value > 0)
                            ? "danger"
                            : "neutral",
                      };
                    })}
                  />
                ) : null}
                {clear.length ? (
                  <p className="text-muted flex items-start gap-2 text-sm">
                    <Icon name="check" size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      {tFloor("clear", {
                        // "ครบกำหนดวันนี้, เสี่ยงล่าช้า หรือ พักงาน" — a sentence, not a list of labels.
                        list: new Intl.ListFormat(locale, { type: "disjunction" }).format(
                          clear.map(([key]) => tFloor(`counters.${key}`)),
                        ),
                      })}
                    </span>
                  </p>
                ) : null}
              </section>
            );
          })()}
          <PartnerSection title={t("tasks.title")} id="tasks">
            {tasks.length ? (
              <RowList label={t("tasks.title")}>
                {tasks.map((task) => (
                  <Row
                    key={task.key}
                    href={task.href}
                    icon={task.icon}
                    tone={task.tone ?? "neutral"}
                    title={task.title}
                    meta={task.body}
                  />
                ))}
              </RowList>
            ) : (
              <p className="border-border text-muted flex items-center gap-2 rounded-xl border border-dashed p-4">
                <Icon name="success" size={20} className="text-success shrink-0" aria-hidden />
                {t("tasks.none")}
              </p>
            )}
          </PartnerSection>

          <PartnerSection
            title={tFloor("queue")}
            actions={
              <Button asChild variant="link" size="sm" iconEnd="arrow-right">
                <Link href="/jobs">{tFloor("allJobs")}</Link>
              </Button>
            }
          >
            {floor.data.queue.length ? (
              <JobsTable jobs={floor.data.queue} caption={tFloor("queue")} />
            ) : (
              <p className="text-muted">{tFloor("queueEmpty")}</p>
            )}
          </PartnerSection>
        </>
      ) : null}
    </PartnerPage>
  );
}
