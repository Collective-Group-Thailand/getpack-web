import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PROPOSAL_STATUS } from "@/domain/status";
import { canAt, factoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { VersionSignOff } from "@/features/partner/prices/actions";
import { loadPrices, OPEN_PROPOSAL } from "@/features/partner/prices/server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerPrices"))("title") };
}

/**
 * The factory's own prices (D-040, D-042, D-043): which ownership mode it is in, each price list
 * with its tier and the version in force, and anything waiting for the factory — a rate card to
 * answer, prices Packio entered to sign off, counters to take or leave. Never another factory's
 * price, a suggestion or a benchmark (D-044).
 */
export default async function PricesPage() {
  const t = await getTranslations("partnerPrices");
  const format = await getFormat();
  const context = await factoryContext();
  const prices = await loadPrices(context.factoryId);
  if (!prices.lists.data || !prices.config.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={prices.lists.error ?? prices.config.error} />
      </PartnerPage>
    );

  const rateCards = prices.proposals.filter(
    (item) => item.direction === "packio_to_factory" && ["submitted", "under_review"].includes(item.status),
  );
  const countered = prices.proposals.filter(
    (item) => item.direction === "factory_to_packio" && item.status === "countered",
  );
  const toSignOff = prices.lists.data.flatMap((list) =>
    list.upcoming
      .filter((version) => version.origin === "assisted_entry" && !version.factorySignedOffAt)
      .map((version) => ({ list, version })),
  );
  const listed = new Set(prices.lists.data.map((list) => list.productTypeId));
  const quoteOnly = prices.config.data.participations.filter((item) => !listed.has(item.productTypeId));

  return (
    <PartnerPage
      title={t("title")}
      description={prices.mode ? t(`mode.${prices.mode}`) : t("mode.none")}
      actions={
        <Link href="/prices/shipping" className="text-primary inline-flex min-h-12 items-center gap-1 underline">
          <Icon name="truck" size={20} />
          {t("shippingLink")}
        </Link>
      }
    >
      {rateCards.length || countered.length || toSignOff.length ? (
        <PartnerSection title={t("attention.title")}>
          <ul className="flex flex-col gap-2">
            {rateCards.map((item) => (
              <li key={item.id}>
                <Link href={`/prices/proposals/${item.id}`} className="block">
                  <Callout
                    tone="warning"
                    icon="handshake"
                    title={t("attention.rateCard", { type: prices.typeName(item.productTypeId) })}
                  >
                    {t("attention.rateCardBody", {
                      count: item.lineCounts.pending,
                      date: format.date(item.proposedEffectiveFrom),
                    })}
                  </Callout>
                </Link>
              </li>
            ))}
            {countered.map((item) => (
              <li key={item.id}>
                <Link href={`/prices/proposals/${item.id}`} className="block">
                  <Callout
                    tone="warning"
                    icon="scale"
                    title={t("attention.countered", { type: prices.typeName(item.productTypeId) })}
                  >
                    {t("attention.counteredBody", { count: item.lineCounts.countered })}
                  </Callout>
                </Link>
              </li>
            ))}
            {toSignOff.map(({ list, version }) => (
              <li key={version.id}>
                <Callout
                  tone="warning"
                  icon="stamp"
                  title={t("attention.signOff", { type: prices.typeName(list.productTypeId) })}
                >
                  <p>
                    {t("attention.signOffBody", {
                      version: version.versionNo,
                      lines: version.lineCount,
                      date: format.date(version.effectiveFrom),
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/prices/${list.productTypeCode}?version=${version.id}`}
                      className="text-primary inline-flex min-h-12 items-center underline"
                    >
                      {t("attention.review")}
                    </Link>
                    <VersionSignOff
                      versionId={version.id}
                      label={t("versionLabel", {
                        type: prices.typeName(list.productTypeId),
                        version: version.versionNo,
                      })}
                    />
                  </div>
                </Callout>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("lists.title")}>
        <ul className="grid gap-2 md:grid-cols-2">
          {prices.lists.data.map((list) => {
            const tier = prices.tierOf(list.productTypeId)?.tier;
            const open = prices.proposals.find(
              (item) => item.priceListId === list.id && OPEN_PROPOSAL.includes(item.status),
            );
            return (
              <li key={list.id}>
                <Link href={`/prices/${list.productTypeCode}`} className="block h-full">
                  <Card padding="md" className="hover:bg-surface-subtle flex h-full flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1 font-medium">{prices.typeName(list.productTypeId)}</span>
                      {tier ? (
                        <Badge tone={tier === "A" ? "success" : tier === "B" ? "primary" : "neutral"}>
                          {t("tier", { tier })}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted text-sm">
                      {list.current
                        ? t("lists.current", {
                            version: list.current.versionNo,
                            date: format.date(list.current.effectiveFrom),
                            lines: list.current.lineCount,
                          })
                        : t("lists.noCurrent")}
                    </p>
                    {list.upcoming.map((version) => (
                      <p key={version.id} className="text-sm">
                        {t("lists.upcoming", { version: version.versionNo, date: format.date(version.effectiveFrom) })}
                      </p>
                    ))}
                    {open ? (
                      <span className="flex items-center gap-2 text-sm">
                        {t("lists.open")} <StatusChip map={PROPOSAL_STATUS} value={open.status} />
                      </span>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
          {quoteOnly.map((item) => (
            <li key={item.productTypeId}>
              <Link href={`/prices/${item.productTypeCode}`} className="block h-full">
                <Card padding="md" className="hover:bg-surface-subtle flex h-full flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-medium">{prices.typeName(item.productTypeId)}</span>
                    <Badge>{t("tier", { tier: item.current?.tier ?? "C" })}</Badge>
                  </div>
                  <p className="text-muted text-sm">{t("lists.quoteOnly")}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </PartnerSection>

      {prices.proposals.length ? (
        <PartnerSection title={t("history.title")} description={t("history.body")}>
          <ul className="flex flex-col gap-2">
            {prices.proposals.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/prices/proposals/${item.id}`}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 flex-wrap items-center gap-2 rounded-xl border p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {t(`history.${item.direction}`, { type: prices.typeName(item.productTypeId) })}
                    </span>
                    <span className="text-muted text-sm">
                      {t("history.meta", {
                        date: format.date(item.createdAt),
                        from: format.date(item.proposedEffectiveFrom),
                        lines: item.lineCounts.total,
                      })}
                    </span>
                  </span>
                  <StatusChip map={PROPOSAL_STATUS} value={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      {!canAt(context, "factory_prices.propose") ? <p className="text-muted text-sm">{t("readOnly")}</p> : null}
    </PartnerPage>
  );
}
