import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { RecipeForm } from "@/features/partner/erp/RecipeForm";
import { erpItems } from "@/features/partner/erp/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SummaryRows } from "@/features/partner/form-layout";
import { PartnerTable } from "@/features/partner/table";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.recipes"))("title") };
}

/** One recipe (D-339): its materials and steps; edited in place by a planner. */
export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ recipeId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ recipeId }, { edit }, t, tCommon, tSales, locale, context] = await Promise.all([
    params,
    searchParams,
    getTranslations("partnerFactory.recipes"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerSales.common"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canEdit = canAt(context, "factory_planning.manage");
  const read = await attempt(async () => {
    const [{ data, response }, items, overview] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/recipes/{recipeId}", {
        params: { path: { ...path, recipeId } },
      }),
      canEdit ? erpItems(contract, context.factoryId) : Promise.resolve([]),
      canEdit
        ? contract.GET("/v1/partner/factories/{factoryId}/erp/planning/overview", { params: { path } })
        : Promise.resolve(null),
    ]);
    return {
      recipe: data!,
      etag: response.headers.get("etag"),
      items: items.filter((i) => i.status === "active"),
      machines: (overview?.data?.machines ?? []).map((m) => m.machine),
    };
  });
  const back = { href: "/planning/recipes", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { recipe } = read.data;
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const batch = tCommon("inUnit", { qty: formatQty(recipe.batchQty, locale), unit: unit(recipe.item.baseUnit) });
  const meta = (
    <>
      <span className="text-muted">{recipe.item.name}</span>
      {recipe.status === "archived" ? <Badge tone="neutral">{tCommon("archived")}</Badge> : null}
    </>
  );

  // Editing is its own view of the page (the same numbered form as a new recipe), not a fold under the tables.
  if (canEdit && edit)
    return (
      <PartnerPage
        full
        title={t("editTitle")}
        back={{ href: `/planning/recipes/${recipe.id}`, label: recipe.name }}
        meta={meta}
      >
        <RecipeForm recipe={recipe} etag={read.data.etag} items={read.data.items} machines={read.data.machines} />
      </PartnerPage>
    );

  return (
    <PartnerPage full title={recipe.name} back={back} meta={meta}>
      <PartnerDetail
        aside={
          <ActionPanel id="recipe-next" tone="neutral" title={tSales("nextSteps")}>
            <SummaryRows
              rows={[
                { key: "product", label: t("table.product"), value: recipe.item.name },
                { key: "batch", label: t("form.batch"), value: batch },
                { key: "materials", label: t("materials"), value: String(recipe.materials.length) },
                { key: "operations", label: t("operations"), value: String(recipe.operations.length) },
              ]}
            />
            {canEdit ? (
              <div data-fill="row" className="flex flex-col gap-2">
                {recipe.status === "active" ? (
                  <Button asChild size="lg" iconStart="plus">
                    <Link href={`/planning/orders/new?item=${recipe.item.id}`}>{t("plan")}</Link>
                  </Button>
                ) : null}
                <Button asChild size="lg" variant="secondary" iconStart="edit">
                  <Link href={`/planning/recipes/${recipe.id}?edit=1`}>{t("editTitle")}</Link>
                </Button>
              </div>
            ) : null}
          </ActionPanel>
        }
      >
        <PartnerSection
          title={t("materials")}
          description={t("perBatch", { qty: formatQty(recipe.batchQty, locale), unit: unit(recipe.item.baseUnit) })}
        >
          <PartnerTable
            caption={t("materials")}
            rows={recipe.materials}
            rowKey={(m) => String(m.lineNo)}
            columns={[
              { key: "item", header: tCommon("item"), primary: true, cell: (m) => m.item.name },
              {
                key: "qty",
                header: tCommon("quantity"),
                align: "end",
                cell: (m) => tCommon("inUnit", { qty: formatQty(m.quantity, locale), unit: unit(m.item.baseUnit) }),
              },
              { key: "scrap", header: t("scrap"), align: "end", cell: (m) => `${formatPlain(m.scrapPct, locale, 2)}%` },
            ]}
          />
        </PartnerSection>
        <PartnerSection title={t("operations")}>
          <PartnerTable
            caption={t("operations")}
            rows={recipe.operations}
            rowKey={(o) => String(o.seq)}
            columns={[
              { key: "step", header: t("step"), primary: true, cell: (o) => `${o.seq}. ${o.name}` },
              { key: "machine", header: t("machine"), cell: (o) => o.machine?.name ?? "—" },
              { key: "setup", header: t("setup"), align: "end", cell: (o) => t("minutes", { n: o.setupMinutes }) },
              {
                key: "rate",
                header: t("rate"),
                align: "end",
                cell: (o) => (o.runRatePerHour ? t("perHour", { qty: formatQty(o.runRatePerHour, locale) }) : "—"),
              },
            ]}
          />
        </PartnerSection>
      </PartnerDetail>
    </PartnerPage>
  );
}
