import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { erpItems } from "@/features/partner/erp/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage } from "@/features/partner/frame";
import { SummaryRows } from "@/features/partner/form-layout";
import { Button } from "@/ui/components/Button";
import { OpenPlanButton, PlanForm } from "@/features/partner/ops/MaintenanceForms";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.maintenance.plans"))("title") };
}

/** One preventive plan (D-355): its cycle and what is left, its open order, and — for a manager — its edit form. */
export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ planId }, { edit }, t, tForm, tMt, tCommon, tSales, format, locale, context] = await Promise.all([
    params,
    searchParams,
    getTranslations("partnerOps.maintenance.plans"),
    getTranslations("partnerOps.maintenance.planForm"),
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerSales.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/maintenance/plans/{planId}", {
      params: { path: { factoryId: context.factoryId, planId } },
    });
    return { plan: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/maintenance?view=plans", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { plan, etag } = read.data;
  const canManage = canAt(context, "factory_maintenance.manage");
  const editing =
    canManage && edit
      ? await attempt(async () => {
          const [machines, items] = await Promise.all([
            contract.GET("/v1/partner/factories/{factoryId}/erp/machines", {
              params: { path: { factoryId: context.factoryId } },
            }),
            erpItems(contract, context.factoryId),
          ]);
          return { machines: machines.data!, items: items.filter((i) => i.status === "active") };
        })
      : null;
  const cycle = [
    plan.everyDays ? t("everyDays", { n: plan.everyDays }) : null,
    plan.everyImpressions ? t("everyImpressions", { n: format.number(plan.everyImpressions) }) : null,
  ]
    .filter(Boolean)
    .join(t("or"));
  const left = [
    plan.daysLeft !== null ? t("everyDays", { n: plan.daysLeft }) : null,
    plan.impressionsLeft !== null ? t("everyImpressions", { n: format.number(plan.impressionsLeft) }) : null,
  ]
    .filter(Boolean)
    .join(t("or"));

  const status =
    plan.status !== "active" ? (
      <Badge tone="neutral">{t("archived")}</Badge>
    ) : plan.due ? (
      <Badge tone="warning">{t("due")}</Badge>
    ) : null;

  // Editing is its own view of the page (the numbered plan form), not a second form under the facts.
  if (editing)
    return (
      <PartnerPage
        full
        title={tForm("editTitle", { title: plan.title })}
        back={{ href: `/maintenance/plans/${plan.id}`, label: plan.title }}
      >
        {editing.data ? (
          <PlanForm
            machines={editing.data.machines.map((m) => ({ id: m.id, name: m.name }))}
            items={editing.data.items}
            locale={locale}
            plan={plan}
            etag={etag}
          />
        ) : (
          <PageError error={editing.error} />
        )}
      </PartnerPage>
    );

  return (
    <PartnerPage full title={plan.title} back={back} status={status}>
      <PartnerDetail
        aside={
          <ActionPanel id="plan-next" tone="neutral" title={tSales("nextSteps")}>
            <SummaryRows
              rows={[
                { key: "cycle", label: t("cycleHeader"), value: t("every", { what: cycle }) },
                {
                  key: "left",
                  label: t("leftHeader"),
                  value: plan.status !== "active" ? t("archived") : plan.due ? t("due") : t("left", { what: left }),
                },
                {
                  key: "last",
                  label: t("lastHeader"),
                  value: plan.lastDoneAt ? format.date(plan.lastDoneAt) : t("never"),
                },
              ]}
            />
            {canManage ? (
              <div data-fill="row" className="flex flex-col gap-2">
                {plan.openOrder ? (
                  <Button asChild size="lg" iconStart="wrench">
                    <Link href={`/maintenance/${plan.openOrder.id}`}>
                      {t("openOrder", { no: plan.openOrder.mtNo })}
                    </Link>
                  </Button>
                ) : plan.status === "active" ? (
                  <OpenPlanButton planId={plan.id} />
                ) : null}
                <Button asChild size="lg" variant="secondary" iconStart="edit">
                  <Link href={`/maintenance/plans/${plan.id}?edit=1`}>{t("edit")}</Link>
                </Button>
              </div>
            ) : null}
          </ActionPanel>
        }
      >
        <section aria-label={t("title")} className="rounded-card border-border bg-surface border p-4 sm:p-5">
          <DescriptionList
            columns={2}
            items={[
              {
                term: tMt("facts.machine"),
                description: (
                  <Link href={`/machines/${plan.machine.id}`} className="underline-offset-4 hover:underline">
                    {plan.machine.name}
                  </Link>
                ),
              },
              { term: tForm("duration"), description: tMt("facts.downtimeMinutes", { n: plan.durationMinutes }) },
              ...(plan.parts.length
                ? [
                    {
                      term: tForm("parts"),
                      description: plan.parts
                        .map(
                          (p) =>
                            `${p.item.name} ${tCommon("inUnit", { qty: formatQty(p.quantity, locale), unit: tCommon(`units.${p.item.baseUnit}` as never) })}`,
                        )
                        .join(", "),
                    },
                  ]
                : []),
              ...(plan.instructions ? [{ term: tForm("instructions"), description: plan.instructions }] : []),
            ]}
          />
        </section>
      </PartnerDetail>
    </PartnerPage>
  );
}
