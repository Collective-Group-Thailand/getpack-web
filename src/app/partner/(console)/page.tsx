import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { FACTORY_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerPage, PartnerSection } from "@/features/partner/frame";
import { JobCard } from "@/features/partner/jobs/JobCard";
import { awaitsSignOff } from "@/features/partner/onboarding/steps";
import { loadPrices } from "@/features/partner/prices/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Meter } from "@/ui/components/Meter";
import { Stat } from "@/ui/components/Stat";
import { Icon, type IconName } from "@/ui/icons";

/**
 * The partner zone's landing screen: what is waiting for this factory today.
 *
 * While the factory is onboarding that is its progress and the steps Packio entered for it to
 * sign off; for every factory, the price items waiting for an answer (a rate card, prices to sign
 * off, counters). From trial on, the floor comes first: counters (to accept, due today, at risk, on
 * hold), alerts and the queue in the order to work it (contract request `partner.today`).
 */
export default async function PartnerHomePage() {
  const t = await getTranslations("partnerToday");
  const context = await factoryContext();
  const factory = context.factory;
  const onboarding = factory && ["applied", "under_review", "trial"].includes(factory.status);
  const { contract, requests } = await partnerServerApis();
  const producing =
    factory && ["trial", "active", "suspended"].includes(factory.status) && canAt(context, "factory_jobs.read");
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
      ? attempt(() =>
          requests.call("GET /v1/partner/factories/{factoryId}/today", { path: { factoryId: context.factoryId } }),
        )
      : null,
  ]);
  const tFloor = await getTranslations("partnerToday.floor");

  const tasks: { key: string; href: string; icon: IconName; title: string; body: string }[] = [];
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

  return (
    <PartnerPage
      title={factory ? (factory.tradeName ?? factory.legalName) : t("title")}
      description={t("greeting", { name: context.actor.displayName })}
      meta={factory ? <StatusChip map={FACTORY_STATUS} value={factory.status} size="md" /> : null}
    >
      {onboarding && factory ? (
        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t(`stage.${factory.status}`)}</h2>
          <Meter
            label={t("progressLabel")}
            value={factory.onboarding.total ? (factory.onboarding.done / factory.onboarding.total) * 100 : 0}
            valueText={t("progress", { done: factory.onboarding.done, total: factory.onboarding.total })}
          />
          <Link
            href="/onboarding"
            className="bg-primary text-primary-fg hover:bg-primary-hover inline-flex h-14 items-center justify-center gap-2 rounded-md px-8 text-lg font-medium"
          >
            {t("continue")}
            <Icon name="arrow-right" size={20} />
          </Link>
        </Card>
      ) : null}

      {floor?.data ? (
        <>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label={tFloor("countersLabel")}>
            {(
              [
                ["toAccept", "/jobs?view=to_accept", "inbox", floor.data.counters.toAccept],
                ["dueToday", "/jobs?view=in_production", "calendar", floor.data.counters.dueToday],
                ["atRisk", "/jobs?view=late", "warning", floor.data.counters.atRisk],
                ["onHold", "/jobs?view=all", "pause", floor.data.counters.onHold],
              ] as const
            ).map(([key, href, icon, value]) => (
              <li key={key}>
                <Stat
                  href={href}
                  label={tFloor(`counters.${key}`)}
                  value={value}
                  icon={icon}
                  tone={
                    key === "atRisk" && value > 0 ? "danger" : key === "toAccept" && value > 0 ? "warning" : "neutral"
                  }
                />
              </li>
            ))}
          </ul>
          {floor.data.alerts.length ? (
            <ul className="flex flex-col gap-2">
              {floor.data.alerts.map((alert) => (
                <li key={`${alert.kind}-${alert.jobId}`}>
                  <Link href={`/jobs/${alert.jobId}`} className="block">
                    <Callout
                      tone={alert.kind === "accept_overdue" ? "danger" : "warning"}
                      icon="warning"
                      title={alert.jobNo}
                    >
                      {alert.text}
                    </Callout>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <PartnerSection
            title={tFloor("queue")}
            actions={
              <Link href="/jobs" className="text-primary inline-flex min-h-12 items-center underline">
                {tFloor("allJobs")}
              </Link>
            }
          >
            {floor.data.queue.length ? (
              <ul className="grid gap-2 md:grid-cols-2">
                {floor.data.queue.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{tFloor("queueEmpty")}</p>
            )}
          </PartnerSection>
        </>
      ) : null}

      <PartnerSection title={t("tasks.title")}>
        {tasks.length ? (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.key}>
                <Link
                  href={task.href}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 items-center gap-3 rounded-xl border p-3"
                >
                  <Icon name={task.icon} size={28} className="text-primary shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{task.title}</span>
                    <span className="text-muted text-sm">{task.body}</span>
                  </span>
                  <Icon name="chevron-right" size={24} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card padding="lg" className="flex items-center gap-3">
            <Icon name="success" size={28} className="text-success shrink-0" />
            <p>{t("tasks.none")}</p>
          </Card>
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
