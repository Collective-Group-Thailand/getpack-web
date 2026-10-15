import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ProductionNav, Tooling } from "@/features/admin/production";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("production.tooling"))("title") };
}

/** D-414: the tooling register — plates and die blocks kept at the factories (D-205, D-289). */
export default async function ToolingPage() {
  const t = await getTranslations("production.tooling");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <ProductionNav />
      <Tooling />
    </ConsolePage>
  );
}
