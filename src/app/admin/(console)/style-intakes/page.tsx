import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StyleIntakes } from "@/features/admin/structural";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("catalogue.intakes"))("title") };
}

/** U3.6. packio-api's menu has no entry yet: reached from the catalogue (CONTRACT-REQUEST admin.menu-styles). */
export default async function Page() {
  const t = await getTranslations("catalogue.intakes");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <StyleIntakes />
    </ConsolePage>
  );
}
