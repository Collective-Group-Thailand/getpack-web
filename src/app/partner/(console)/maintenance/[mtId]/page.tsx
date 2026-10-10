import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_MAINTENANCE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { erpItems, erpWarehouses } from "@/features/partner/erp/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { MtActions } from "@/features/partner/ops/MaintenanceForms";
import { RelatedDocuments } from "@/features/partner/ops/RelatedDocuments";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { PhotoGrid } from "@/features/partner/viewer";
import { getFormat } from "@/features/shared/format/server";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.maintenance"))("title") };
}

/** One maintenance order (D-355): what broke or is due, its window, the parts it used, and what was done. */
export default async function MaintenanceOrderPage({ params }: { params: Promise<{ mtId: string }> }) {
  const [{ mtId }, t, tShared, tCommon, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerOps.shared"),
    getTranslations("partnerErp.common"),
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

  return (
    <PartnerPage
      wide
      title={`${mt.mtNo} · ${mt.title}`}
      back={back}
      actions={
        pickers?.data ? (
          <MtActions order={mt} items={pickers.data.items} warehouses={pickers.data.warehouses} locale={locale} />
        ) : undefined
      }
    >
      <DescriptionList
        items={[
          { term: t("table.status"), description: <StatusChip map={ERP_MAINTENANCE_STATUS} value={mt.status} /> },
          {
            term: t("facts.machine"),
            description: (
              <Link href={`/machines/${mt.machine.id}`} className="underline-offset-4 hover:underline">
                {mt.machine.name}
              </Link>
            ),
          },
          { term: t("facts.kind"), description: t(`kinds.${mt.kind}`) },
          { term: t("facts.priority"), description: t(`priorities.${mt.priority}`) },
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
          ...(mt.scheduledStart && mt.scheduledEnd
            ? [
                {
                  term: t("facts.window"),
                  description: `${format.dateTime(mt.scheduledStart)} – ${format.dateTime(mt.scheduledEnd)}`,
                },
              ]
            : []),
          ...(mt.startedAt ? [{ term: t("facts.started"), description: format.dateTime(mt.startedAt) }] : []),
          ...(mt.finishedAt ? [{ term: t("facts.finished"), description: format.dateTime(mt.finishedAt) }] : []),
          ...(mt.downtimeMinutes !== null
            ? [{ term: t("facts.downtime"), description: t("facts.downtimeMinutes", { n: mt.downtimeMinutes }) }]
            : []),
          ...(mt.description ? [{ term: t("facts.description"), description: mt.description }] : []),
          ...(mt.instructions ? [{ term: t("facts.instructions"), description: mt.instructions }] : []),
          ...(mt.resolution ? [{ term: t("facts.resolution"), description: mt.resolution }] : []),
          ...(mt.cancelReason ? [{ term: t("facts.cancelReason"), description: mt.cancelReason }] : []),
        ]}
      />
      {pickers && !pickers.data ? <PageError error={pickers.error} /> : null}

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
          empty={<p className="text-muted">{t("noParts")}</p>}
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
    </PartnerPage>
  );
}
