import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PROPOSAL_STATUS } from "@/domain/status";
import { canAt, factoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { VersionSignOff } from "@/features/partner/prices/actions";
import { loadPrices, OPEN_PROPOSAL } from "@/features/partner/prices/server";
import { termsFrom, TermsHelp } from "@/features/partner/terms";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

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
  const tTerms = await getTranslations("partner.terms");
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
      wide
      title={t("title")}
      description={prices.mode ? t(`mode.${prices.mode}`) : t("mode.none")}
      actions={
        <Button asChild variant="secondary" size="md" iconStart="truck">
          <Link href="/prices/shipping">{t("shippingLink")}</Link>
        </Button>
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
                      className="text-primary inline-flex min-h-11 items-center underline md:min-h-10"
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

      <TermsHelp
        title={tTerms("title")}
        terms={termsFrom(tTerms.raw, ["priceVersion", "effectiveDate", "tier", "proposal"])}
      />
      <PartnerSection title={t("lists.title")}>
        <PartnerTable
          caption={t("lists.title")}
          rows={[
            ...prices.lists.data.map((list) => ({
              kind: "list" as const,
              list,
              typeId: list.productTypeId,
              code: list.productTypeCode,
            })),
            ...quoteOnly.map((item) => ({
              kind: "quote" as const,
              item,
              typeId: item.productTypeId,
              code: item.productTypeCode,
            })),
          ]}
          rowKey={(row) => row.typeId}
          rowHref={(row) => `/prices/${row.code}`}
          columns={[
            {
              key: "type",
              header: t("table.type"),
              primary: true,
              cell: (row) => prices.typeName(row.typeId),
            },
            {
              key: "tier",
              header: t("table.tier"),
              cell: (row) => {
                const tier = row.kind === "list" ? prices.tierOf(row.typeId)?.tier : (row.item.current?.tier ?? "C");
                return tier ? (
                  <span className="flex flex-col">
                    <span className="font-medium">{t("tier", { tier })}</span>
                    <span className="text-muted text-sm">{t(`tierShort.${tier}`)}</span>
                  </span>
                ) : (
                  "—"
                );
              },
            },
            {
              key: "version",
              header: t("table.version"),
              cell: (row) =>
                row.kind === "list" && row.list.current ? (
                  <span className="flex flex-col">
                    <span>{t("table.versionNo", { version: row.list.current.versionNo })}</span>
                    <span className="text-muted text-sm whitespace-nowrap">
                      {t("table.from", { date: format.date(row.list.current.effectiveFrom) })}
                    </span>
                  </span>
                ) : row.kind === "list" ? (
                  t("lists.noCurrent")
                ) : (
                  <span className="text-muted">{t("lists.quoteOnly")}</span>
                ),
            },
            {
              key: "lines",
              header: t("table.lines"),
              align: "end",
              cell: (row) =>
                row.kind === "list" && row.list.current ? format.number(row.list.current.lineCount) : "—",
            },
            {
              key: "open",
              header: t("table.open"),
              cell: (row) => {
                if (row.kind !== "list") return "—";
                const open = prices.proposals.find(
                  (item) => item.priceListId === row.list.id && OPEN_PROPOSAL.includes(item.status),
                );
                const upcoming = row.list.upcoming[0];
                return open ? (
                  <StatusChip map={PROPOSAL_STATUS} value={open.status} />
                ) : upcoming ? (
                  <span className="text-sm">
                    {t("lists.upcoming", { version: upcoming.versionNo, date: format.date(upcoming.effectiveFrom) })}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                );
              },
            },
          ]}
        />
      </PartnerSection>

      {prices.proposals.length ? (
        <PartnerSection title={t("history.title")} description={t("history.body")}>
          <PartnerTable
            caption={t("history.title")}
            rows={prices.proposals}
            rowKey={(item) => item.id}
            rowHref={(item) => `/prices/proposals/${item.id}`}
            rowTone={(item) =>
              item.direction === "packio_to_factory" && ["submitted", "under_review"].includes(item.status)
                ? "warning"
                : undefined
            }
            columns={[
              {
                key: "what",
                header: t("history.table.what"),
                primary: true,
                cell: (item) => t(`history.${item.direction}`, { type: prices.typeName(item.productTypeId) }),
              },
              {
                key: "created",
                header: t("history.table.created"),
                cell: (item) => format.date(item.createdAt),
                className: "whitespace-nowrap",
              },
              {
                key: "from",
                header: t("history.table.from"),
                cell: (item) => format.date(item.proposedEffectiveFrom),
                className: "whitespace-nowrap",
              },
              { key: "lines", header: t("history.table.lines"), align: "end", cell: (item) => item.lineCounts.total },
              {
                key: "status",
                header: t("history.table.status"),
                cell: (item) => <StatusChip map={PROPOSAL_STATUS} value={item.status} />,
              },
            ]}
          />
        </PartnerSection>
      ) : null}
      {!canAt(context, "factory_prices.propose") ? <p className="text-muted text-sm">{t("readOnly")}</p> : null}
    </PartnerPage>
  );
}
