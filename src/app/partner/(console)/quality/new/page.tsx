import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { CheckStartForm } from "@/features/partner/insight/QualityForms";
import { qualityPickers } from "@/features/partner/insight/server";
import type { Schemas } from "@/lib/api/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.checks.start"))("title") };
}

const KINDS = ["incoming", "in_process", "final", "other"];

/** Starts a quality check (D-372), from a production order, a goods receipt or an item. */
export default async function NewCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; productionOrderId?: string; goodsReceiptId?: string; itemId?: string; templateId?: string }>;
}) {
  const [query, t, context] = await Promise.all([searchParams, getTranslations("partnerInsight.checks.start"), factoryContext()]);
  const pickers = await qualityPickers(context.factoryId);
  const back = { href: "/quality", label: t("back") };
  return (
    <PartnerPage title={t("title")} description={t("body")} back={back}>
      {pickers.data ? (
        <CheckStartForm
          templates={pickers.data.templates}
          items={pickers.data.items}
          orders={pickers.data.orders}
          receipts={pickers.data.receipts}
          initial={{
            ...(KINDS.includes(query.kind ?? "") ? { kind: query.kind as Schemas["ErpCheckKind"] } : {}),
            ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
            ...(query.goodsReceiptId ? { goodsReceiptId: query.goodsReceiptId } : {}),
            ...(query.itemId ? { itemId: query.itemId } : {}),
            ...(query.templateId ? { templateId: query.templateId } : {}),
          }}
        />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
