import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { viewTotals } from "@/features/partner/erp/server";
import { PartnerTable } from "@/features/partner/table";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.templates"))("title") };
}

/** Inspection templates (D-373): the checklists a check copies, by kind. */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams;
  const archived = query.view === "archived";
  const [t, tKind, context] = await Promise.all([
    getTranslations("partnerInsight.templates"),
    getTranslations("partnerInsight.kinds"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/inspection-templates", {
          params: {
            path: { factoryId: context.factoryId },
            query: { perPage: 100, status: archived ? "archived" : "active" },
          },
        })
      ).data!,
  );
  // Each tab's count, so a tab says exactly how many templates it opens.
  const counts = await viewTotals(
    ["active", "archived"] as const,
    async (status) =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/inspection-templates", {
          params: { path: { factoryId: context.factoryId }, query: { perPage: 1, status } },
        })
      ).data,
  );
  const canManage = canAt(context, "factory_quality.manage");
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canManage ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/quality/templates/new">{t("new")}</Link>
          </Button>
        ) : null
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("title")}
          current={archived ? "archived" : "active"}
          items={[
            { key: "active", href: "/quality/templates", label: t("active"), count: counts.active },
            {
              key: "archived",
              href: `/quality/templates${queryOf({ view: "archived" })}`,
              label: t("archived"),
              count: counts.archived,
            },
          ]}
        />
      </ListToolbar>
      {list.data ? (
        <PartnerTable
          caption={t("title")}
          rows={list.data.data}
          rowKey={(row) => row.id}
          rowHref={(row) =>
            canManage ? `/quality/templates/${row.id}` : `/quality/new?kind=${row.kind}&templateId=${row.id}`
          }
          empty={
            <EmptyState
              icon="checklist"
              title={t("empty")}
              description={t("emptyBody")}
              action={
                canManage ? (
                  <Button asChild iconStart="plus">
                    <Link href="/quality/templates/new">{t("new")}</Link>
                  </Button>
                ) : archived ? (
                  <Button asChild variant="secondary" iconEnd="arrow-right">
                    <Link href="/quality/templates">{t("active")}</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: "n",
              header: t("name"),
              primary: true,
              cell: (row) => <span className="[overflow-wrap:anywhere] break-keep">{row.name}</span>,
            },
            { key: "k", header: t("kind"), cell: (row) => tKind(row.kind) },
            { key: "i", header: t("item"), cell: (row) => row.item?.name ?? t("anyItem") },
            { key: "p", header: t("points"), align: "end", cell: (row) => row.checkpoints.length },
            { key: "c", header: t("checks"), align: "end", hideOnPhone: true, cell: (row) => row.checks },
          ]}
        />
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
