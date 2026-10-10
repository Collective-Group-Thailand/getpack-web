import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.recipes"))("title") };
}

const PER_PAGE = 50;

/** The factory's recipes (D-339): how each product is made. */
export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const query = await searchParams;
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
          params: { path: { factoryId: context.factoryId }, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
        })
      ).data!,
  );
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/planning", label: tPlan("title") }}
      actions={
        canAt(context, "factory_planning.manage") ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/planning/recipes/new">{t("new")}</Link>
          </Button>
        ) : undefined
      }
    >
      <SearchBar
        id="recipe-q"
        action="/planning/recipes"
        q={q}
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        button={tCommon("search")}
      />
      {list.data ? (
        <>
          <PartnerTable
            caption={t("title")}
            rows={list.data.data}
            rowKey={(r) => r.id}
            rowHref={(r) => `/planning/recipes/${r.id}`}
            empty={<EmptyState icon="layers" title={t("empty")} description={t("emptyBody")} />}
            columns={[
              { key: "name", header: t("table.name"), primary: true, cell: (r) => r.name },
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
            hrefFor={(n) => `/planning/recipes${queryOf({ q, page: n > 1 ? n : undefined })}`}
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
