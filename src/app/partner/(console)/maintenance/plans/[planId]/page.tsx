import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { erpItems } from "@/features/partner/erp/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { OpenPlanButton, PlanForm } from "@/features/partner/ops/MaintenanceForms";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.maintenance.plans"))("title") };
}

/** One preventive plan (D-355): its cycle and what is left, its open order, and — for a manager — its edit form. */
export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const [{ planId }, t, tForm, tMt, tCommon, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerOps.maintenance.plans"),
    getTranslations("partnerOps.maintenance.planForm"),
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerErp.common"),
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
  const editing = canManage
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

  return (
    <PartnerPage
      title={plan.title}
      back={back}
      actions={
        canManage && plan.status === "active" && !plan.openOrder ? <OpenPlanButton planId={plan.id} /> : undefined
      }
    >
      <DescriptionList
        items={[
          {
            term: tMt("facts.machine"),
            description: (
              <Link href={`/machines/${plan.machine.id}`} className="underline-offset-4 hover:underline">
                {plan.machine.name}
              </Link>
            ),
          },
          { term: t("cycleHeader"), description: t("every", { what: cycle }) },
          {
            term: t("leftHeader"),
            description:
              plan.status !== "active" ? (
                <Badge tone="neutral">{t("archived")}</Badge>
              ) : plan.due ? (
                <Badge tone="warning">{t("due")}</Badge>
              ) : (
                t("left", { what: left })
              ),
          },
          {
            term: t("lastHeader"),
            description: plan.lastDoneAt ? format.date(plan.lastDoneAt) : t("never"),
          },
          { term: tForm("duration"), description: tMt("facts.downtimeMinutes", { n: plan.durationMinutes }) },
          ...(plan.openOrder
            ? [
                {
                  term: t("openHeader"),
                  description: (
                    <Link href={`/maintenance/${plan.openOrder.id}`} className="underline-offset-4 hover:underline">
                      {t("openOrder", { no: plan.openOrder.mtNo })}
                    </Link>
                  ),
                },
              ]
            : []),
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
      {editing ? (
        <PartnerSection title={t("edit")}>
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
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
