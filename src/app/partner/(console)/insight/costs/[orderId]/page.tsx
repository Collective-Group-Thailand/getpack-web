import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatStrip } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.costs"))("orderTitle") };
}

/** One production order's cost (D-376), operation by operation. */
export default async function JobCostPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [{ orderId }, t, format, context] = await Promise.all([
    params,
    getTranslations("partnerInsight.costs"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders/{orderId}/cost", {
          params: { path: { factoryId: context.factoryId, orderId } },
        })
      ).data!,
  );
  const back = { href: "/insight/costs", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("orderTitle")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const c = read.data;
  return (
    <PartnerPage
      full
      title={`${c.productionOrder.number} · ${c.title}`}
      back={back}
      description={t("orderBody", {
        good: formatQty(c.goodQty, format.locale),
        scrap: formatQty(c.scrapQty, format.locale),
      })}
      meta={
        <Link className="text-link text-sm underline" href={`/planning/orders/${c.productionOrder.id}`}>
          {t("openOrder")}
        </Link>
      }
    >
      <StatStrip
        label={t("totals")}
        items={[
          { key: "m", label: t("material"), value: format.thb(c.material) },
          { key: "mc", label: t("machine"), value: format.thb(c.machine) },
          { key: "l", label: t("labour"), value: format.thb(c.labour) },
          { key: "o", label: t("overhead"), value: format.thb(c.overhead) },
          {
            key: "t",
            label: t("total"),
            value: format.thb(c.total),
            hint: c.unitCost ? t("perUnit", { cost: format.thb(Number(c.unitCost).toFixed(4)) }) : undefined,
            tone: "success",
          },
        ]}
      />
      <PartnerSection
        title={t("operations")}
        description={t("minutes", { run: c.runMinutes, planned: c.plannedMinutes })}
      >
        <PartnerTable
          caption={t("operations")}
          rows={c.operations}
          rowKey={(row) => String(row.seq)}
          columns={[
            { key: "n", header: t("operation"), primary: true, cell: (row) => `${row.seq}. ${row.name}` },
            { key: "m", header: t("machineName"), cell: (row) => row.machine?.name ?? "—" },
            { key: "p", header: t("planned"), align: "end", cell: (row) => format.number(row.plannedMinutes) },
            { key: "r", header: t("run"), align: "end", cell: (row) => format.number(row.runMinutes) },
            {
              key: "rate",
              header: t("rate"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => (row.machineRate ? format.thb(row.machineRate) : t("noRate")),
            },
            { key: "c", header: t("machine"), align: "end", cell: (row) => format.thb(row.machineCost) },
          ]}
        />
      </PartnerSection>
    </PartnerPage>
  );
}
