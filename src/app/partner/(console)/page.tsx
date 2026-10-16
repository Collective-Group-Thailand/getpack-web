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
import { inboxHref, inboxIcon } from "@/features/partner/today/inbox";

/**
 * The partner zone's landing screen: what is waiting for this factory today.
 *
 * While the factory is onboarding that is its progress and the steps getpack entered for it to
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
  // The maintenance crew and the sales desk open on Today too (D-399): their machines down, expiring quotations
  // and follow-ups are in the inbox there.
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
  const [statements, claims, samples, inbox] = await Promise.all([
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
    // D-399: what the ERP has waiting for this person (approvals, overdue, today, soon).
    canAt(context, "factory_profile.read")
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/inbox", {
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

  type Section = "approve" | "overdue" | "today" | "soon";
  const tasks: {
    key: string;
    section: Section;
    href: string;
    icon: IconName;
    title: string;
    body: string;
    tone?: "warning" | "danger";
    aside?: string;
  }[] = [];
  const toSignOff = (steps?.data ?? []).filter(awaitsSignOff).length;
  if (toSignOff)
    tasks.push({
      key: "steps",
      section: "approve",
      href: "/onboarding",
      icon: "stamp",
      title: t("tasks.signOff", { count: toSignOff }),
      body: t("tasks.signOffBody"),
    });
  for (const item of prices?.proposals ?? []) {
    if (item.direction === "getpack_to_factory" && ["submitted", "under_review"].includes(item.status))
      tasks.push({
        key: item.id,
        section: "approve",
        href: `/prices/proposals/${item.id}`,
        icon: "handshake",
        title: t("tasks.rateCard", { type: prices!.typeName(item.productTypeId) }),
        body: t("tasks.rateCardBody", { count: item.lineCounts.pending }),
      });
    if (item.direction === "factory_to_getpack" && item.status === "countered")
      tasks.push({
        key: item.id,
        section: "approve",
        href: `/prices/proposals/${item.id}`,
        icon: "scale",
        title: t("tasks.countered", { type: prices!.typeName(item.productTypeId) }),
        body: t("tasks.counteredBody", { count: item.lineCounts.countered }),
      });
  }
  for (const statement of statements?.data?.data ?? [])
    tasks.push({
      key: statement.id,
      section: "approve",
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
      section: "overdue",
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
          section: "approve",
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
      section: alert.kind === "acceptance_overdue" || alert.kind === "step_overdue" ? "overdue" : "today",
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

  const ti = await getTranslations("partnerToday.inbox");
  // A getpack job waiting for the factory's yes is a decision with a clock (D-074): first in the list.
  if (canAt(context, "factory_jobs.respond"))
    for (const job of (floor?.data?.queue ?? []).filter((item) => item.status === "released"))
      if (!tasks.some((task) => task.key === `acceptance_overdue-${job.id}`))
        tasks.push({
          key: `accept-${job.id}`,
          section: "approve",
          href: `/jobs/${job.id}`,
          icon: "inbox",
          tone: "warning",
          title: ti("acceptJob", { no: job.jobNo, quantity: format.number(job.quantityOrdered) }),
          body: ti("acceptBy", { at: format.dateTime(job.acceptDueAt) }),
        });
  for (const item of inbox?.data?.items ?? []) {
    const details = [
      item.document && item.party ? item.party : null,
      item.date ? ti(item.section === "today" ? "on" : "due", { date: format.date(item.date) }) : null,
    ].filter(Boolean);
    tasks.push({
      key: item.key,
      section: item.section,
      href: inboxHref(item),
      icon: inboxIcon(item.kind),
      tone: item.tone === "danger" ? "danger" : item.tone === "warning" && item.section !== "soon" ? "warning" : undefined,
      title: ti(`kinds.${item.kind}` as "kinds.alerts", {
        number:
          (item.kind === "tax_due" || item.kind === "period_to_close") && item.document?.number
            ? format.date(`${item.document.number}-01`, { style: "month" })
            : (item.document?.number ?? ""),
        party: item.party ?? "",
        count: item.count,
      }),
      body: details.join(" · "),
      ...(item.amount ? { aside: format.thb(item.amount) } : {}),
    });
  }
  const SECTIONS: Section[] = ["approve", "overdue", "today", "soon"];
  const bySection = (section: Section) => tasks.filter((task) => task.section === section);

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

      {tasks.length ? (
        <StatStrip
          label={ti("summary")}
          items={SECTIONS.filter((section) => bySection(section).length).map((section) => ({
            key: section,
            href: `#${section}`,
            label: ti(`sections.${section}`),
            value: bySection(section).length,
            tone: section === "overdue" ? "danger" : section === "approve" ? "warning" : "neutral",
          }))}
        />
      ) : (
        <p className="border-border text-muted flex items-center gap-2 rounded-xl border border-dashed p-4">
          <Icon name="success" size={20} className="text-success shrink-0" aria-hidden />
          {ti("allClear")}
        </p>
      )}
      {SECTIONS.filter((section) => bySection(section).length).map((section) => (
        <PartnerSection key={section} id={section} title={ti(`sections.${section}`)} description={ti(`sectionHints.${section}`)}>
          <RowList label={ti(`sections.${section}`)}>
            {bySection(section).map((task) => (
              <Row
                key={task.key}
                href={task.href}
                icon={task.icon}
                tone={task.tone ?? "neutral"}
                title={task.title}
                meta={task.body || undefined}
                aside={task.aside}
              />
            ))}
          </RowList>
        </PartnerSection>
      ))}

      {floor?.data ? (
        <>
          <h2 className="mt-2 text-lg font-semibold">{ti("getpackWork")}</h2>
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
