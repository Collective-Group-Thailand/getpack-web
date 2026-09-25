import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ProductionBoard, ProductionNav } from "@/features/admin/production";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("production.board"))("title") };
}

export default async function ProductionPage() {
  const t = await getTranslations("production.board");
  return (
    <ConsolePage width="full" className="max-w-[110rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ProductionNav />
      <ProductionBoard />
    </ConsolePage>
  );
}
