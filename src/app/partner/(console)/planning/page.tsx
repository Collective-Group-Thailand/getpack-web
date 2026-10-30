import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_PRODUCTION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { MrpTable } from "@/features/partner/erp/MrpTable";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { ListToolbar, Row, RowList, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

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
  const [t, tSchedule, tCommon, format, locale, context] = await Promise.all([
    getTranslations("partnerFactory.planning"),
    getTranslations("partnerOps.schedule"),
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
  // Every tab's count with the same search, so a tab says exactly how many rows it opens (MRP: its shortage rows).
  const counts = await viewTotals(VIEWS, async (key) =>
    key === "mrp"
      ? mrp?.data
        ? { meta: { total: mrp.data.length } }
        : await contract
            .GET("/v1/partner/factories/{factoryId}/erp/planning/mrp", { params: { path } })
            .then((r) => (r.data ? { meta: { total: r.data.length } } : undefined))
      : (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders", {
            params: { path, query: { perPage: 1, ...(key === "all" ? {} : { status: key }), ...(q ? { q } : {}) } },
          })
        ).data,
  );
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/planning${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;
  const o = overview.data;
  const canPlan = canAt(context, "factory_planning.manage");

  const link =
    "text-primary inline-flex min-h-11 items-center gap-1.5 font-medium underline-offset-4 hover:underline md:min-h-8";
  const loaded = o?.machines.filter((m) => m.operations > 0) ?? [];
  const list =
    view === "mrp" ? (
      mrp?.data ? (
        <MrpTable rows={mrp.data} canRequest={canAt(context, "factory_procurement.request")} locale={locale} />
      ) : (
        <PageError error={mrp?.error} />
      )
    ) : orders?.data ? (
      <>
        <PartnerTable
          caption={t(`views.${view}`)}
          rows={orders.data.data}
          rowKey={(mo) => mo.id}
          rowHref={(mo) => `/planning/orders/${mo.id}`}
          rowTone={(mo) => (mo.late ? "danger" : mo.short ? "warning" : undefined)}
          empty={
            <EmptyState
              icon="factory"
              title={t("empty")}
              description={t("emptyBody")}
              action={
                canPlan ? (
                  <Button asChild iconStart="plus">
                    <Link href="/planning/orders/new">{t("newOrder")}</Link>
                  </Button>
                ) : view !== "all" ? (
                  <Button asChild variant="secondary" iconEnd="arrow-right">
                    <Link href={href("all")}>{t("views.all")}</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: "no",
              header: t("table.no"),
              primary: true,
              cell: (mo) => (
                <span className="flex flex-col">
                  <span className="whitespace-nowrap tabular-nums">{mo.moNo}</span>
                  <span className="text-muted text-sm font-normal">{t(`sources.${mo.source}` as never)}</span>
                </span>
              ),
            },
            { key: "title", header: t("table.title"), cell: (mo) => mo.title },
            {
              key: "qty",
              header: t("table.quantity"),
              align: "end",
              className: "whitespace-nowrap",
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
    );

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      // Recipes, the machine timeline and the floor are their own screens, one link away — not three more buttons.
      meta={
        <nav aria-label={t("views.label")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className={link} href="/planning/schedule">
            <Icon name="gantt" size={16} aria-hidden />
            {tSchedule("title")}
          </Link>
          <Link className={link} href="/planning/recipes">
            <Icon name="layers" size={16} aria-hidden />
            {t("recipes")}
          </Link>
          {canAt(context, "factory_production.record") ? (
            <Link className={link} href="/floor">
              <Icon name="play" size={16} aria-hidden />
              {t("floor")}
            </Link>
          ) : null}
        </nav>
      }
      actions={
        canPlan ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/planning/orders/new">{t("newOrder")}</Link>
          </Button>
        ) : undefined
      }
    >
      {o ? (
        <PartnerStats
          label={t("stats.label")}
          columns={6}
          items={[
            { key: "planned", label: t("stats.planned"), value: o.planned },
            { key: "released", label: t("stats.released"), value: o.released },
            { key: "inProgress", label: t("stats.inProgress"), value: o.inProgress },
            { key: "late", label: t("stats.late"), value: o.late, ...(o.late ? { tone: "danger" as const } : {}) },
            { key: "due", label: t("stats.dueThisWeek"), value: o.dueThisWeek },
            {
              key: "short",
              label: t("stats.short"),
              value: o.shortItems,
              href: href("mrp"),
              ...(o.shortItems ? { tone: "warning" as const } : {}),
            },
          ]}
        />
      ) : null}
      {/* The orders (or the shortages) on the left; the load waiting on each machine beside them on a desk. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          <ListToolbar>
            <ViewTabs
              label={t("views.label")}
              current={view}
              items={VIEWS.map((key) => ({
                key,
                href: href(key, key === "mrp" ? {} : { q }),
                label: t(`views.${key}`),
                count: counts[key],
              }))}
            />
            {view === "mrp" ? null : (
              <SearchBar
                id="mo-q"
                action="/planning"
                hidden={{ view: view === "open" ? undefined : view }}
                q={q}
                label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                button={tCommon("search")}
              />
            )}
          </ListToolbar>
          {list}
        </div>
        {loaded.length ? (
          <aside className="flex min-w-0 flex-col xl:sticky xl:top-20">
            <PartnerSection title={t("machines")} description={t("machinesBody")}>
              <RowList label={t("machines")}>
                {loaded.map((m) => (
                  <Row
                    key={m.machine.id}
                    href={`/floor?machine=${m.machine.id}`}
                    title={m.machine.name}
                    meta={`${t("table.operations")} ${m.operations}`}
                    aside={
                      <span className="font-semibold">
                        {t("hours", { h: formatPlain(String(m.plannedMinutes / 60), locale, 1) })}
                      </span>
                    }
                  />
                ))}
              </RowList>
            </PartnerSection>
          </aside>
        ) : null}
      </div>
    </PartnerPage>
  );
}
