import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { MaintenanceTable } from "@/features/partner/ops/MaintenanceTable";
import { ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.maintenance"))("title") };
}

const VIEWS = ["open", "all", "plans"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** Maintenance (D-355): open work first, every order, and the preventive plans. */
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canManage = canAt(context, "factory_maintenance.manage");
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/maintenance${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;

  const orders =
    view === "plans"
      ? null
      : await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/maintenance/orders", {
                params: {
                  path,
                  query: {
                    perPage: PER_PAGE,
                    page,
                    ...(view === "open" ? { status: "open_all" } : {}),
                    ...(q ? { q } : {}),
                  },
                },
              })
            ).data!,
        );
  const plans =
    view === "plans"
      ? await attempt(
          async () =>
            (await contract.GET("/v1/partner/factories/{factoryId}/erp/maintenance/plans", { params: { path } })).data!,
        )
      : null;
  const every = (p: { everyDays: number | null; everyImpressions: number | null }) =>
    t("plans.every", {
      what: [
        p.everyDays ? t("plans.everyDays", { n: p.everyDays }) : null,
        p.everyImpressions ? t("plans.everyImpressions", { n: format.number(p.everyImpressions) }) : null,
      ]
        .filter(Boolean)
        .join(t("plans.or")),
    });

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button asChild variant="secondary" iconStart="calendar">
              <Link href="/maintenance/plans/new">{t("newPlan")}</Link>
            </Button>
          ) : null}
          {canAt(context, "factory_maintenance.report") ? (
            <Button asChild size="lg" variant="destructive-solid" iconStart="wrench">
              <Link href="/maintenance/new">{t("report")}</Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
      />
      {orders ? (
        <>
          <SearchBar
            id="mt-q"
            action="/maintenance"
            hidden={{ view: view === "open" ? undefined : view }}
            q={q}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            button={tCommon("search")}
          />
          {orders.data ? (
            <>
              <MaintenanceTable
                rows={orders.data.data}
                caption={t(`views.${view}`)}
                empty={<EmptyState icon="wrench" title={t("empty")} description={t("emptyBody")} />}
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
            <PageError error={orders.error} />
          )}
        </>
      ) : null}
      {plans ? (
        plans.data ? (
          <PartnerTable
            caption={t("plans.title")}
            rows={plans.data}
            rowKey={(p) => p.id}
            rowHref={(p) => `/maintenance/plans/${p.id}`}
            rowTone={(p) => (p.due && p.status === "active" ? "warning" : undefined)}
            empty={<EmptyState icon="calendar" title={t("plans.empty")} description={t("plans.emptyBody")} />}
            columns={[
              { key: "title", header: t("planForm.title"), primary: true, cell: (p) => p.title },
              { key: "machine", header: t("table.machine"), cell: (p) => p.machine.name },
              { key: "every", header: t("plans.cycleHeader"), hideOnPhone: true, cell: every },
              {
                key: "left",
                header: t("plans.leftHeader"),
                cell: (p) =>
                  p.status !== "active" ? (
                    <Badge tone="neutral">{t("plans.archived")}</Badge>
                  ) : p.due ? (
                    <Badge tone="warning">{t("plans.due")}</Badge>
                  ) : (
                    t("plans.left", {
                      what: [
                        p.daysLeft !== null ? t("plans.everyDays", { n: p.daysLeft }) : null,
                        p.impressionsLeft !== null
                          ? t("plans.everyImpressions", { n: format.number(p.impressionsLeft) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(t("plans.or")),
                    })
                  ),
              },
              {
                key: "last",
                header: t("plans.lastHeader"),
                hideOnPhone: true,
                cell: (p) => (p.lastDoneAt ? format.date(p.lastDoneAt) : t("plans.never")),
              },
              {
                key: "open",
                header: t("plans.openHeader"),
                cell: (p) => (p.openOrder ? t("plans.openOrder", { no: p.openOrder.mtNo }) : "—"),
              },
            ]}
          />
        ) : (
          <PageError error={plans.error} />
        )
      ) : null}
    </PartnerPage>
  );
}
