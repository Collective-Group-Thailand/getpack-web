import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PROPOSAL_STATUS, SETTING_VERSION_STATUS } from "@/domain/status";
import { canAt, factoryContext, getFactoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { CreateProposal, VersionSignOff } from "@/features/partner/prices/actions";
import { lineLabeller } from "@/features/partner/prices/LineList";
import { loadPrices, loadRows, OPEN_PROPOSAL } from "@/features/partner/prices/server";
import { columnsOf, PRICE_GROUPS, type Values } from "@/features/partner/prices/values";
import { ChangeRequestForm } from "@/features/partner/requests/ChangeRequestForm";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { cn } from "@/ui/lib/cn";

type Props = {
  params: Promise<{ productType: string }>;
  searchParams: Promise<{ component?: string; version?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productType } = await params;
  const context = await getFactoryContext();
  const prices = context ? await loadPrices(context.factoryId) : null;
  return { title: prices?.typeName(productType) ?? (await getTranslations("partnerPrices"))("title") };
}

/**
 * One price list: what its tier means (D-043), the version in force read one component at a
 * time (a tier-A table is long; each component is one small read), versions to come, and what
 * the factory can do — propose changes in price-list mode (D-042 b), answer a rate card in
 * rate-card mode (D-042 a), or ask for a higher tier. Own prices only (D-044).
 */
export default async function PriceListPage({ params, searchParams }: Props) {
  const [{ productType }, query] = await Promise.all([params, searchParams]);
  const t = await getTranslations("partnerPrices");
  const tComponents = await getTranslations("partnerPrices.components");
  const tGroups = await getTranslations("partnerPrices.groups");
  const format = await getFormat();
  const context = await factoryContext();
  const prices = await loadPrices(context.factoryId);
  if (!prices.lists.data || !prices.config.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={prices.lists.error ?? prices.config.error} />
      </PartnerPage>
    );
  const participation = prices.config.data.participations.find((item) => item.productTypeCode === productType);
  const list = prices.lists.data.find((item) => item.productTypeCode === productType);
  if (!participation && !list) notFound();
  const productTypeId = (list?.productTypeId ?? participation?.productTypeId)!;
  const name = prices.typeName(productTypeId);
  const tier = prices.tierOf(productTypeId)?.tier ?? "C";
  const envelope = prices.tierOf(productTypeId)?.envelopeNote;
  const back = { href: "/prices", label: t("back") };
  const meta = (
    <Badge tone={tier === "A" ? "success" : tier === "B" ? "primary" : "neutral"}>{t("tier", { tier })}</Badge>
  );

  if (tier === "C" || !list) {
    return (
      <PartnerPage title={name} back={back} meta={meta}>
        <PartnerSection title={t("tierC.title")}>
          <Card padding="lg" className="flex flex-col gap-3">
            <p>{t("tierC.body")}</p>
            <ul className="list-disc ps-5">
              <li>{t("tierC.unlockInstant")}</li>
              <li>{t("tierC.unlockJobs")}</li>
              <li>{t("tierC.unlockRfq")}</li>
            </ul>
          </Card>
        </PartnerSection>
        <PartnerSection title={t("tierRequest.title")} description={t("tierRequest.bodyC")}>
          <Card padding="lg">
            <ChangeRequestForm
              topic="participation_tier"
              productTypeId={productTypeId}
              placeholder={t("tierRequest.placeholder")}
              submitLabel={t("tierRequest.submit")}
            />
          </Card>
        </PartnerSection>
      </PartnerPage>
    );
  }

  // The version being read: the one in force, or one to come named in `?version=`.
  const version =
    [list.current, ...list.upcoming].find((item) => item && item.id === query.version) ??
    list.current ??
    list.upcoming[0] ??
    null;
  const definitions = prices.components;
  const byGroup = PRICE_GROUPS.map((group) => ({
    group,
    items: definitions.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length);
  const component = (definitions.find((item) => item.component === query.component)?.component ??
    definitions[0]?.component) as Schemas["PriceComponent"] | undefined;
  const [rows] = version && component ? await loadRows(context.factoryId, version.id, [component]) : [];
  const label = await lineLabeller(definitions, prices.references);
  const columns = component ? columnsOf(definitions, component).all : [];
  const open = prices.proposals.find((item) => item.priceListId === list.id && OPEN_PROPOSAL.includes(item.status));
  const history = prices.proposals.filter((item) => item.priceListId === list.id);
  const href = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams(
      Object.entries({ version: version && version.id !== list.current?.id ? version.id : undefined, ...next }).filter(
        (entry): entry is [string, string] => !!entry[1],
      ),
    );
    return `/prices/${productType}${search.size ? `?${search}` : ""}`;
  };

  return (
    <PartnerPage title={name} back={back} meta={meta} description={t(`tiers.${tier}`)} wide>
      {tier === "B" && envelope ? (
        <Callout tone="info" title={t("envelopeTitle")}>
          {envelope}
        </Callout>
      ) : null}

      {version ? (
        <PartnerSection
          title={t("version.title", { version: version.versionNo })}
          description={t("version.meta", { date: format.date(version.effectiveFrom), lines: version.lineCount })}
          actions={<StatusChip map={SETTING_VERSION_STATUS} value={version.status} size="md" />}
        >
          <Card padding="md" className="flex flex-col gap-1 text-sm">
            <p>{t(`origin.${version.origin}`)}</p>
            {version.factoryAcceptedAt ? (
              <p>{t("version.accepted", { date: format.dateTime(version.factoryAcceptedAt) })}</p>
            ) : null}
            {version.factorySignedOffAt ? (
              <p>{t("version.signedOff", { date: format.dateTime(version.factorySignedOffAt) })}</p>
            ) : null}
            {version.contentSha256 ? (
              <p className="text-muted font-mono text-xs">
                {t("version.digest", { sha: version.contentSha256.slice(0, 12) })}
              </p>
            ) : null}
            {version.origin === "assisted_entry" && !version.factorySignedOffAt ? (
              <div className="mt-2">
                <VersionSignOff
                  versionId={version.id}
                  label={t("versionLabel", { type: name, version: version.versionNo })}
                />
              </div>
            ) : null}
          </Card>

          <nav aria-label={t("componentsNav")} className="flex flex-col gap-2">
            {byGroup.map((entry) => (
              <div key={entry.group}>
                <p className="text-muted text-sm font-medium">{tGroups(entry.group)}</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {entry.items.map((item) => (
                    <li key={item.component}>
                      <Link
                        href={href({ component: item.component })}
                        aria-current={item.component === component ? "page" : undefined}
                        className={cn(
                          "border-border inline-flex min-h-12 items-center rounded-control border px-4",
                          item.component === component
                            ? "bg-primary text-primary-fg border-primary"
                            : "bg-surface hover:bg-surface-subtle",
                        )}
                      >
                        {tComponents(item.component)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {component ? (
            rows?.error ? (
              <PageError error={rows.error} />
            ) : rows?.rows.length ? (
              <div
                className="border-border overflow-x-auto rounded-xl border"
                // Scrolls sideways on a phone: focusable, so a keyboard can scroll it too.
                tabIndex={0}
                role="region"
                aria-label={t("rowsCaption", { component: tComponents(component) })}
              >
                <table className="w-full text-sm tabular-nums">
                  <caption className="sr-only">{t("rowsCaption", { component: tComponents(component) })}</caption>
                  <thead className="bg-surface-subtle">
                    <tr>
                      {columns.map((column) => (
                        <th key={column.key} scope="col" className="px-3 py-2 text-start font-medium whitespace-nowrap">
                          {label.column(column.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.rows.map((row) => (
                      <tr key={row.lineKey} className="border-border border-t">
                        {columns.map((column) => (
                          <td key={column.key} className="px-3 py-2 whitespace-nowrap">
                            {label.cell(column, (row.values as Values)[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="spreadsheet" title={t("noRows", { component: tComponents(component) })} />
            )
          ) : null}
        </PartnerSection>
      ) : (
        <EmptyState icon="coins" title={t("noVersion")} description={t("noVersionBody")} />
      )}

      {prices.mode === "factory_price_list" ? (
        <PartnerSection title={t("propose.title")} description={t("propose.body")}>
          {open ? (
            <Link href={`/prices/proposals/${open.id}`} className="block">
              <Callout tone="info" title={t("propose.open")}>
                <span className="flex items-center gap-2">
                  <StatusChip map={PROPOSAL_STATUS} value={open.status} /> {t("propose.openLink")}
                </span>
              </Callout>
            </Link>
          ) : canAt(context, "factory_prices.propose") ? (
            <Card padding="lg">
              <CreateProposal productTypeId={productTypeId} typeName={name} />
            </Card>
          ) : (
            <p className="text-muted">{t("readOnly")}</p>
          )}
        </PartnerSection>
      ) : (
        <PartnerSection title={t("rateCardMode.title")}>
          <p>{t("rateCardMode.body")}</p>
        </PartnerSection>
      )}

      {tier === "B" ? (
        <PartnerSection title={t("tierRequest.title")} description={t("tierRequest.bodyB")}>
          <Card padding="lg">
            <ChangeRequestForm
              topic="participation_tier"
              productTypeId={productTypeId}
              placeholder={t("tierRequest.placeholder")}
              submitLabel={t("tierRequest.submitA")}
            />
          </Card>
        </PartnerSection>
      ) : null}

      {history.length ? (
        <PartnerSection title={t("history.title")}>
          <ul className="flex flex-col gap-2">
            {history.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/prices/proposals/${item.id}`}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 flex-wrap items-center gap-2 rounded-xl border p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(`history.${item.direction}`, { type: name })}</span>
                    <span className="text-muted text-sm">
                      {item.resultingVersion
                        ? t("history.resulting", { version: item.resultingVersion.versionNo })
                        : t("history.meta", {
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
    </PartnerPage>
  );
}
