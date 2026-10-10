import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { RecipeForm } from "@/features/partner/erp/RecipeForm";
import { erpItems } from "@/features/partner/erp/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.recipes"))("title") };
}

/** One recipe (D-339): its materials and steps; edited in place by a planner. */
export default async function RecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
  const [{ recipeId }, t, tCommon, locale, context] = await Promise.all([
    params,
    getTranslations("partnerFactory.recipes"),
    getTranslations("partnerErp.common"),
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
  return (
    <PartnerPage
      wide
      title={recipe.name}
      back={back}
      meta={
        <>
          <span className="text-muted">{recipe.item.name}</span>
          {recipe.status === "archived" ? <Badge tone="neutral">{tCommon("archived")}</Badge> : null}
        </>
      }
      actions={
        canEdit && recipe.status === "active" ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href={`/planning/orders/new?item=${recipe.item.id}`}>{t("plan")}</Link>
          </Button>
        ) : undefined
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
      {canEdit ? (
        <details className="border-border bg-surface rounded-xl border p-4 md:p-5">
          <summary className="cursor-pointer text-lg font-semibold">{t("editTitle")}</summary>
          <div className="mt-4">
            <RecipeForm recipe={recipe} etag={read.data.etag} items={read.data.items} machines={read.data.machines} />
          </div>
        </details>
      ) : null}
    </PartnerPage>
  );
}
