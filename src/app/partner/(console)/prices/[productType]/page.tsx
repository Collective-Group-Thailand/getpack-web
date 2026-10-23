import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PROPOSAL_STATUS, SETTING_VERSION_STATUS } from "@/domain/status";
import { canAt, factoryContext, getFactoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { CreateProposal, VersionSignOff } from "@/features/partner/prices/actions";
import { componentsFor } from "@/features/partner/prices/components-by-type";
import { PriceTable } from "@/features/partner/prices/PriceTable";
import { loadCounts, loadPrices, loadRows, OPEN_PROPOSAL } from "@/features/partner/prices/server";
import { PRICE_GROUPS } from "@/features/partner/prices/values";
import { ChangeRequestForm } from "@/features/partner/requests/ChangeRequestForm";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

type Props = {
  params: Promise<{ productType: string }>;
  searchParams: Promise<{ component?: string; version?: string; q?: string }>;
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
  const tHelp = await getTranslations("partnerPrices.componentHelp");
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
          <Card padding="md" className="flex flex-col gap-3">
            <p>{t("tierC.body")}</p>
            <ul className="list-disc ps-5">
              <li>{t("tierC.unlockInstant")}</li>
              <li>{t("tierC.unlockJobs")}</li>
              <li>{t("tierC.unlockRfq")}</li>
            </ul>
          </Card>
        </PartnerSection>
        <PartnerSection title={t("tierRequest.title")} description={t("tierRequest.bodyC")}>
          <Card padding="md">
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
  // Only the components this product type's calculator reads (a folding carton has no pouch film).
  const definitions = componentsFor(prices.components, list.productTypeCode ?? productType);
  const byGroup = PRICE_GROUPS.map((group) => ({
    group,
    items: definitions.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length);
  const counts = version ? await loadCounts(context.factoryId, version.id) : new Map<string, number>();
  const countOf = (component: string) => counts.get(component);
  // Open on the part asked for, else the first that holds prices — never an empty one when another has lines.
  const component = (definitions.find((item) => item.component === query.component)?.component ??
    definitions.find((item) => (countOf(item.component) ?? 0) > 0)?.component ??
    definitions[0]?.component) as Schemas["PriceComponent"] | undefined;
  const filled = definitions.filter((item) => (countOf(item.component) ?? 0) > 0).length;
  const [rows] = version && component ? await loadRows(context.factoryId, version.id, [component]) : [];
  const open = prices.proposals.find((item) => item.priceListId === list.id && OPEN_PROPOSAL.includes(item.status));
  const history = prices.proposals.filter((item) => item.priceListId === list.id);
  const canPropose = prices.mode === "factory_price_list" && canAt(context, "factory_prices.propose");
  const href = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams(
      Object.entries({ version: version && version.id !== list.current?.id ? version.id : undefined, ...next }).filter(
        (entry): entry is [string, string] => !!entry[1],
      ),
    );
    return `/prices/${productType}${search.size ? `?${search}` : ""}`;
  };
  const versions = [list.current, ...list.upcoming].filter((item): item is NonNullable<typeof item> => !!item);

  // The one thing to do next, in the header: carry on with the draft, read what was sent, or start one.
  // The one thing to do next, in the header — only when no proposal is open (an open one has its own box below).
  const primary =
    prices.mode === "factory_price_list" && !open && canPropose ? (
      <Button asChild size="lg" iconStart="edit">
        <a href="#propose">{t("cta.propose")}</a>
      </Button>
    ) : null;
  const openHref = open
    ? `/prices/proposals/${open.id}${open.status === "draft" && component ? `?component=${component}` : ""}`
    : "";

  return (
    <PartnerPage
      title={name}
      back={back}
      meta={
        <>
          {meta}
          {version ? <StatusChip map={SETTING_VERSION_STATUS} value={version.status} /> : null}
        </>
      }
      description={t(`tiers.${tier}`)}
      actions={primary}
      full
    >
      {tier === "B" && envelope ? (
        <Callout tone="info" title={t("envelopeTitle")}>
          {envelope}
        </Callout>
      ) : null}

      {open ? (
        <Callout
          tone={open.status === "draft" ? "warning" : "info"}
          title={t(`openNotice.${open.status === "draft" ? "draft" : "sent"}`)}
        >
          <span className="flex flex-col gap-2">
            <span className="flex flex-wrap items-center gap-2">
              <StatusChip map={PROPOSAL_STATUS} value={open.status} />
              {t("openNotice.meta", { date: format.date(open.proposedEffectiveFrom), lines: open.lineCounts.total })}
            </span>
            <span>{t(`openNotice.${open.status === "draft" ? "draftNext" : "sentNext"}`)}</span>
            <span>
              <Button
                asChild
                size="md"
                variant={open.status === "draft" ? "primary" : "secondary"}
                iconStart={open.status === "draft" ? "edit" : "eye"}
              >
                <Link href={openHref}>{open.status === "draft" ? t("cta.continueDraft") : t("cta.viewOpen")}</Link>
              </Button>
            </span>
          </span>
        </Callout>
      ) : null}

      {version ? (
        <>
          <Card padding="md" className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-semibold">
                {version.id === list.current?.id
                  ? t("version.inForce", { version: version.versionNo })
                  : t("version.coming", { version: version.versionNo })}
              </p>
              <p className="text-muted">
                {t("version.meta", { date: format.date(version.effectiveFrom), lines: version.lineCount })}
              </p>
              <p className="text-muted">{t(`origin.${version.origin}`)}</p>
              {versions.length > 1 ? (
                <nav aria-label={t("version.switch")} className="ms-auto flex flex-wrap gap-1">
                  {versions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/prices/${productType}?${new URLSearchParams({
                        ...(item.id !== list.current?.id ? { version: item.id } : {}),
                        ...(component ? { component } : {}),
                      })}`}
                      aria-current={item.id === version.id ? "page" : undefined}
                      className={cn(
                        "rounded-control border-border inline-flex min-h-10 items-center border px-3",
                        item.id === version.id
                          ? "bg-primary text-primary-fg border-primary font-medium"
                          : "hover:bg-surface-subtle",
                      )}
                    >
                      {item.id === list.current?.id
                        ? t("version.current", { version: item.versionNo })
                        : t("version.upcoming", { version: item.versionNo, date: format.date(item.effectiveFrom) })}
                    </Link>
                  ))}
                </nav>
              ) : null}
            </div>
            <p className="text-muted">{t("version.parts", { filled, total: definitions.length })}</p>
            {version.factoryAcceptedAt ? (
              <p>{t("version.accepted", { date: format.dateTime(version.factoryAcceptedAt) })}</p>
            ) : null}
            {version.factorySignedOffAt ? (
              <p>{t("version.signedOff", { date: format.dateTime(version.factorySignedOffAt) })}</p>
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

          <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)] xl:items-start">
            <nav
              aria-label={t("componentsNav")}
              className="border-border flex flex-col gap-3 border-b pb-3 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:border-b-0 xl:pb-0"
            >
              {byGroup.map((entry) => (
                <div key={entry.group}>
                  <p className="text-muted px-1 text-xs font-semibold">{tGroups(entry.group)}</p>
                  <ul className="mt-1 flex flex-wrap gap-1 xl:flex-col xl:flex-nowrap">
                    {entry.items.map((item) => {
                      const lines = countOf(item.component);
                      const current = item.component === component;
                      return (
                        <li key={item.component}>
                          <Link
                            href={href({ component: item.component })}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "rounded-control border-border flex min-h-10 items-center justify-between gap-2 border px-3 text-sm xl:border-0",
                              current
                                ? "bg-primary text-primary-fg border-primary font-medium"
                                : lines === 0
                                  ? "text-muted hover:bg-surface-subtle"
                                  : "hover:bg-surface-subtle",
                            )}
                          >
                            <span>{tComponents(item.component)}</span>
                            {lines !== undefined ? (
                              <span className={cn("text-xs tabular-nums", current ? "text-primary-fg" : "text-muted")}>
                                {lines}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <p className="text-muted px-1 text-xs">{t("componentsHint")}</p>
            </nav>

            {component ? (
              <section aria-labelledby="component-title" className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[min(100%,14rem)] flex-1">
                    <h2 id="component-title" className="text-lg font-semibold">
                      {tComponents(component)}
                    </h2>
                    {tHelp.has(component) ? <p className="text-muted text-sm">{tHelp(component)}</p> : null}
                  </div>
                  <form
                    method="get"
                    action={`/prices/${productType}`}
                    className="flex w-full gap-2 sm:w-auto"
                    role="search"
                  >
                    <input type="hidden" name="component" value={component} />
                    {version.id !== list.current?.id ? <input type="hidden" name="version" value={version.id} /> : null}
                    <Input
                      type="search"
                      name="q"
                      defaultValue={query.q ?? ""}
                      placeholder={t("table.searchPlaceholder")}
                      aria-label={t("table.search")}
                      inputSize="md"
                      className="w-full sm:w-56"
                    />
                    <Button type="submit" variant="secondary" size="md" iconStart="search">
                      {t("table.search")}
                    </Button>
                  </form>
                </div>
                {rows?.error ? (
                  <PageError error={rows.error} />
                ) : (
                  <PriceTable
                    component={component}
                    rows={rows?.rows ?? []}
                    definitions={prices.components}
                    references={prices.references}
                    query={query.q}
                  />
                )}
              </section>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState icon="coins" title={t("noVersion")} description={t("noVersionBody")} />
      )}

      {prices.mode === "factory_price_list" ? (
        open ? null : (
          <PartnerSection id="propose" title={t("propose.title")} description={t("propose.body")}>
            {canPropose ? (
              <Card padding="md">
                <CreateProposal productTypeId={productTypeId} typeName={name} />
              </Card>
            ) : (
              <p className="text-muted">{t("readOnly")}</p>
            )}
          </PartnerSection>
        )
      ) : (
        <PartnerSection title={t("rateCardMode.title")}>
          <p>{t("rateCardMode.body")}</p>
        </PartnerSection>
      )}

      {tier === "B" ? (
        <PartnerSection title={t("tierRequest.title")} description={t("tierRequest.bodyB")}>
          <Card padding="md">
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
