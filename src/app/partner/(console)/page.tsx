import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { FACTORY_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerPage, PartnerSection } from "@/features/partner/frame";
import { awaitsSignOff } from "@/features/partner/onboarding/steps";
import { loadPrices } from "@/features/partner/prices/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Card } from "@/ui/components/Card";
import { Meter } from "@/ui/components/Meter";
import { Icon, type IconName } from "@/ui/icons";

/**
 * The partner zone's landing screen: what is waiting for this factory today.
 *
 * While the factory is onboarding that is its progress and the steps Packio entered for it to
 * sign off; for every factory, the price items waiting for an answer (a rate card, prices to sign
 * off, counters). Production counters join when the jobs surface exists (F5 5.2).
 */
export default async function PartnerHomePage() {
  const t = await getTranslations("partnerToday");
  const context = await factoryContext();
  const factory = context.factory;
  const onboarding = factory && ["applied", "under_review", "trial"].includes(factory.status);
  const { contract } = await partnerServerApis();
  const [steps, prices] = await Promise.all([
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
  ]);

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
