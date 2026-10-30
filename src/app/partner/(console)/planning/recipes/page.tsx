import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.recipes"))("title") };
}

const PER_PAGE = 50;
const VIEWS = ["active", "archived", "all"] as const;
type View = (typeof VIEWS)[number];

/** The factory's recipes (D-339): how each product is made. */
export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "active";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tPlan, tCommon, context] = await Promise.all([
    getTranslations("partnerFactory.recipes"),
    getTranslations("partnerFactory.planning"),
    getTranslations("partnerErp.common"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/recipes", {
          params: {
            path: { factoryId: context.factoryId },
            query: { perPage: PER_PAGE, page, ...(view === "all" ? {} : { status: view }), ...(q ? { q } : {}) },
          },
        })
      ).data!,
  );
  const counts = await viewTotals(
    VIEWS,
    async (key) =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/recipes", {
          params: {
            path: { factoryId: context.factoryId },
            query: { perPage: 1, ...(key === "all" ? {} : { status: key }), ...(q ? { q } : {}) },
          },
        })
      ).data,
  );
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/planning/recipes${queryOf({ view: next === "active" ? undefined : next, ...extra })}`;
  const canPlan = canAt(context, "factory_planning.manage");
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/planning", label: tPlan("title") }}
      actions={
        canPlan ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/planning/recipes/new">{t("new")}</Link>
          </Button>
        ) : undefined
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("title")}
          current={view}
          items={VIEWS.map((key) => ({
            key,
            href: href(key, { q }),
            label: key === "all" ? tPlan("views.all") : tCommon(key),
            count: counts[key],
          }))}
        />
        <SearchBar
          id="recipe-q"
          action="/planning/recipes"
          hidden={{ view: view === "active" ? undefined : view }}
          q={q}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          button={tCommon("search")}
        />
      </ListToolbar>
      {list.data ? (
        <>
          <PartnerTable
            caption={t("title")}
            rows={list.data.data}
            rowKey={(r) => r.id}
            rowHref={(r) => `/planning/recipes/${r.id}`}
            empty={
              <EmptyState
                icon="layers"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  canPlan ? (
                    <Button asChild iconStart="plus">
                      <Link href="/planning/recipes/new">{t("new")}</Link>
                    </Button>
                  ) : view !== "all" ? (
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href={href("all")}>{tPlan("views.all")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "name",
                header: t("table.name"),
                primary: true,
                cell: (r) => <span className="[overflow-wrap:anywhere] break-keep">{r.name}</span>,
              },
              {
                key: "product",
                header: t("table.product"),
                cell: (r) => (
                  <span className="flex flex-col">
                    {r.item.name}
                    <span className="text-muted text-sm">{r.item.sku}</span>
                  </span>
                ),
              },
              { key: "materials", header: t("table.materials"), align: "end", cell: (r) => r.materials.length },
              {
                key: "operations",
                header: t("table.operations"),
                align: "end",
                hideOnPhone: true,
                cell: (r) => r.operations.length,
              },
              {
                key: "status",
                header: t("table.status"),
                cell: (r) =>
                  r.status === "archived" ? (
                    <Badge tone="neutral">{tCommon("archived")}</Badge>
                  ) : (
                    <Badge tone="success">{tCommon("active")}</Badge>
                  ),
              },
            ]}
          />
          <Pager
            page={page}
            perPage={PER_PAGE}
            total={list.data.meta.total}
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
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
