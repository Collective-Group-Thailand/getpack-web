import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_PRODUCTION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { MrpTable } from "@/features/partner/erp/MrpTable";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.planning"))("title") };
}

const VIEWS = ["open", "mrp", "completed", "all"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/**
 * The planning board (D-340 – D-342): open production orders by priority and due date, what production is
 * short of (MRP), and the load on each machine — with the counts the API keeps.
 */
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, locale, context] = await Promise.all([
    getTranslations("partnerFactory.planning"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [overview, orders, mrp] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/planning/overview", { params: { path } })).data!,
    ),
    view === "mrp"
      ? null
      : attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders", {
                params: {
                  path,
                  query: { perPage: PER_PAGE, page, ...(view === "all" ? {} : { status: view }), ...(q ? { q } : {}) },
                },
              })
            ).data!,
        ),
    view === "mrp"
      ? attempt(
          async () =>
            (await contract.GET("/v1/partner/factories/{factoryId}/erp/planning/mrp", { params: { path } })).data!,
        )
      : null,
  ]);
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/planning${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;
  const o = overview.data;
  const canPlan = canAt(context, "factory_planning.manage");

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        <>
          {canPlan ? (
            <Button asChild size="lg" iconStart="plus">
              <Link href="/planning/orders/new">{t("newOrder")}</Link>
            </Button>
          ) : null}
          <Button asChild size="lg" variant="secondary" iconStart="layers">
            <Link href="/planning/recipes">{t("recipes")}</Link>
          </Button>
          {canAt(context, "factory_production.record") ? (
            <Button asChild size="lg" variant="secondary" iconStart="play">
              <Link href="/floor">{t("floor")}</Link>
            </Button>
          ) : null}
        </>
      }
    >
      {o ? (
        <StatStrip
          label={t("stats.label")}
          items={[
            { key: "planned", label: t("stats.planned"), value: o.planned },
            { key: "released", label: t("stats.released"), value: o.released },
            { key: "inProgress", label: t("stats.inProgress"), value: o.inProgress },
            { key: "late", label: t("stats.late"), value: o.late, tone: o.late ? "danger" : undefined },
            { key: "due", label: t("stats.dueThisWeek"), value: o.dueThisWeek },
            {
              key: "short",
              label: t("stats.short"),
              value: o.shortItems,
              tone: o.shortItems ? "warning" : undefined,
              href: href("mrp"),
            },
          ]}
        />
      ) : null}
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({
          key,
          href: href(key),
          label: t(`views.${key}`),
          ...(key === "mrp" && o ? { count: o.shortItems } : {}),
        }))}
      />
      {view === "mrp" ? (
        mrp?.data ? (
          <MrpTable rows={mrp.data} canRequest={canAt(context, "factory_procurement.request")} locale={locale} />
        ) : (
          <PageError error={mrp?.error} />
        )
      ) : (
        <>
          <SearchBar
            id="mo-q"
            action="/planning"
            hidden={{ view: view === "open" ? undefined : view }}
            q={q}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            button={tCommon("search")}
          />
          {orders?.data ? (
            <>
              <PartnerTable
                caption={t(`views.${view}`)}
                rows={orders.data.data}
                rowKey={(mo) => mo.id}
                rowHref={(mo) => `/planning/orders/${mo.id}`}
                rowTone={(mo) => (mo.late ? "danger" : mo.short ? "warning" : undefined)}
                empty={<EmptyState icon="factory" title={t("empty")} description={t("emptyBody")} />}
                columns={[
                  {
                    key: "no",
                    header: t("table.no"),
                    primary: true,
                    cell: (mo) => (
                      <span className="flex flex-col">
                        <span className="font-mono whitespace-nowrap">{mo.moNo}</span>
                        <span className="text-muted text-sm">{t(`sources.${mo.source}` as never)}</span>
                      </span>
                    ),
                  },
                  { key: "title", header: t("table.title"), cell: (mo) => mo.title },
                  {
                    key: "qty",
                    header: t("table.quantity"),
                    align: "end",
                    cell: (mo) =>
                      tCommon("inUnit", {
                        qty: formatQty(mo.quantity, locale),
                        unit: tCommon(`units.${mo.unit}` as never),
                      }),
                  },
                  {
                    key: "due",
                    header: t("table.due"),
                    className: "whitespace-nowrap",
                    cell: (mo) => (
                      <span className="flex flex-wrap items-center gap-1">
                        {format.date(mo.dueOn)}
                        {mo.late ? <Badge tone="danger">{t("late")}</Badge> : null}
                        {mo.short ? <Badge tone="warning">{t("short")}</Badge> : null}
                      </span>
                    ),
                  },
                  {
                    key: "progress",
                    header: t("table.progress"),
                    align: "end",
                    hideOnPhone: true,
                    cell: (mo) => `${formatPlain(mo.progressPct, locale, 0)}%`,
                  },
                  {
                    key: "status",
                    header: t("table.status"),
                    cell: (mo) => <StatusChip map={ERP_PRODUCTION_STATUS} value={mo.status} />,
                  },
                ]}
              />
              <Pager
                page={page}
                perPage={PER_PAGE}
                total={orders.data.meta.total}
                hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
                labels={{
                  nav: tCommon("pagination.nav"),
                  previous: tCommon("pagination.previous"),
                  next: tCommon("pagination.next"),
                  page: (n: number) => tCommon("pagination.page", { n }),
                }}
              />
            </>
          ) : (
            <PageError error={orders?.error} />
          )}
        </>
      )}
      {o?.machines.some((m) => m.operations > 0) ? (
        <PartnerSection title={t("machines")} description={t("machinesBody")}>
          <PartnerTable
            caption={t("machines")}
            rows={o.machines.filter((m) => m.operations > 0)}
            rowKey={(m) => m.machine.id}
            rowHref={(m) => `/floor?machine=${m.machine.id}`}
            columns={[
              { key: "name", header: t("table.machine"), primary: true, cell: (m) => m.machine.name },
              { key: "ops", header: t("table.operations"), align: "end", cell: (m) => m.operations },
              {
                key: "minutes",
                header: t("table.load"),
                align: "end",
                cell: (m) => t("hours", { h: formatPlain(String(m.plannedMinutes / 60), locale, 1) }),
              },
            ]}
          />
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
