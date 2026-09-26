import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { SettingsList } from "@/features/admin/platform";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("platform.settings"))("title") };
}

export default async function Page() {
  const t = await getTranslations("platform.settings");
  let initial = null;
  try {
    initial = (await (await adminServerApis()).contract.GET("/v1/admin/settings")).data ?? null;
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsList initial={initial} />
    </ConsolePage>
  );
}
