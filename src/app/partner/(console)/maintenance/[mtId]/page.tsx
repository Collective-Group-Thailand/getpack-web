import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_MAINTENANCE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { erpItems, erpWarehouses } from "@/features/partner/erp/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SummaryRows } from "@/features/partner/form-layout";
import { MtActions } from "@/features/partner/ops/MaintenanceForms";
import { RelatedDocuments } from "@/features/partner/ops/RelatedDocuments";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { PhotoGrid } from "@/features/partner/viewer";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.maintenance"))("title") };
}

/** One maintenance order (D-355): what broke or is due, its window, the parts it used, and what was done. */
export default async function MaintenanceOrderPage({ params }: { params: Promise<{ mtId: string }> }) {
  const [{ mtId }, t, tShared, tCommon, tSales, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerOps.shared"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerSales.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}", {
          params: { path: { factoryId: context.factoryId, mtId } },
        })
      ).data!,
  );
  const back = { href: "/maintenance", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const mt = read.data;
  const canManage = canAt(context, "factory_maintenance.manage");
  const live = mt.status !== "done" && mt.status !== "cancelled";
  const pickers =
    canManage && live
      ? await attempt(async () => {
          const [items, warehouses] = await Promise.all([
            erpItems(contract, context.factoryId),
            erpWarehouses(contract, context.factoryId),
          ]);
          return {
            items: items.filter((i) => i.status === "active"),
            warehouses: warehouses.filter((w) => w.status === "active"),
          };
        })
      : null;
  const qty = (value: string, unit: string) =>
    tCommon("inUnit", { qty: formatQty(value, locale), unit: tCommon(`units.${unit}` as never) });

  const windowText =
    mt.scheduledStart && mt.scheduledEnd
      ? `${format.dateTime(mt.scheduledStart)} – ${format.dateTime(mt.scheduledEnd)}`
      : null;

  return (
    <PartnerPage
      full
      title={`${mt.mtNo} · ${mt.title}`}
      back={back}
      meta={
        <>
          <StatusChip map={ERP_MAINTENANCE_STATUS} value={mt.status} />
          <Badge tone={mt.kind === "breakdown" ? "danger" : "neutral"}>{t(`kinds.${mt.kind}`)}</Badge>
        </>
      }
    >
      {/* The order on the left; the machine, its window and the one next step in a panel that stays in view. */}
      <PartnerDetail
        aside={
          <ActionPanel id="mt-next" tone="neutral" title={tSales("nextSteps")}>
            <SummaryRows
              rows={[
                {
                  key: "machine",
                  label: t("facts.machine"),
                  value: (
                    <Link
                      href={`/machines/${mt.machine.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {mt.machine.name}
                    </Link>
                  ),
                },
                { key: "priority", label: t("facts.priority"), value: t(`priorities.${mt.priority}`) },
                { key: "window", label: t("facts.window"), value: windowText ?? "" },
                ...(mt.downtimeMinutes !== null
                  ? [
                      {
                        key: "downtime",
                        label: t("facts.downtime"),
                        value: t("facts.downtimeMinutes", { n: mt.downtimeMinutes }),
                      },
                    ]
                  : []),
              ]}
            />
            {pickers?.data ? (
              <MtActions
                order={mt}
                items={pickers.data.items}
                warehouses={pickers.data.warehouses}
                locale={locale}
                layout="panel"
              />
            ) : null}
            {pickers && !pickers.data ? <PageError error={pickers.error} /> : null}
          </ActionPanel>
        }
      >
        <section
          aria-label={t("facts.description")}
          className="rounded-card border-border bg-surface border p-4 sm:p-5"
        >
          <DescriptionList
            columns={2}
            items={[
              { term: t("facts.reported"), description: format.dateTime(mt.reportedAt) },
              ...(mt.reportedBy ? [{ term: t("facts.reportedBy"), description: mt.reportedBy }] : []),
              ...(mt.plan
                ? [
                    {
                      term: t("facts.plan"),
                      description: (
                        <Link href={`/maintenance/plans/${mt.plan.id}`} className="underline-offset-4 hover:underline">
                          {mt.plan.code}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(mt.startedAt ? [{ term: t("facts.started"), description: format.dateTime(mt.startedAt) }] : []),
              ...(mt.finishedAt ? [{ term: t("facts.finished"), description: format.dateTime(mt.finishedAt) }] : []),
              ...(mt.description ? [{ term: t("facts.description"), description: mt.description }] : []),
              ...(mt.instructions ? [{ term: t("facts.instructions"), description: mt.instructions }] : []),
              ...(mt.resolution ? [{ term: t("facts.resolution"), description: mt.resolution }] : []),
              ...(mt.cancelReason ? [{ term: t("facts.cancelReason"), description: mt.cancelReason }] : []),
            ]}
          />
        </section>

        {mt.photos.length ? (
          <PartnerSection title={t("photosTitle")}>
            <PhotoGrid items={mt.photos.map((p) => ({ title: p.name, fileId: p.fileId }))} />
          </PartnerSection>
        ) : null}

        <PartnerSection
          title={t("partsTitle")}
          description={mt.parts.length ? t("partsValue", { amount: format.thb(mt.partsValue) }) : t("partsBody")}
        >
          {mt.plannedParts.length ? (
            <p className="text-muted text-sm">
              {t("plannedParts", {
                list: mt.plannedParts.map((p) => `${p.item.name} ${qty(p.quantity, p.item.baseUnit)}`).join(", "),
              })}
            </p>
          ) : null}
          <PartnerTable
            caption={t("partsTitle")}
            rows={mt.parts}
            rowKey={(p) => p.id}
            empty={
              <p className="border-border text-muted rounded-xl border border-dashed px-4 py-5 text-sm">
                {t("noParts")}
              </p>
            }
            columns={[
              { key: "item", header: tCommon("item"), primary: true, cell: (p) => p.item.name },
              {
                key: "qty",
                header: tCommon("quantity"),
                align: "end",
                cell: (p) => qty(p.quantity, p.item.baseUnit),
              },
              { key: "warehouse", header: t("actions.warehouse"), hideOnPhone: true, cell: (p) => p.warehouse.code },
              { key: "value", header: tShared("value"), align: "end", cell: (p) => format.thb(p.value) },
              { key: "at", header: tShared("issuedAt"), hideOnPhone: true, cell: (p) => format.dateTime(p.at) },
            ]}
          />
        </PartnerSection>

        <RelatedDocuments type="maintenance_order" id={mt.id} label={mt.mtNo} />
      </PartnerDetail>
    </PartnerPage>
  );
}
