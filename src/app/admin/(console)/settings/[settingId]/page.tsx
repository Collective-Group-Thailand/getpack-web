import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { SettingDetailView } from "@/features/admin/platform";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("platform.settings"))("detailTitle") };
}

export default async function SettingPage({ params }: { params: Promise<{ settingId: string }> }) {
  const { settingId } = await params;
  let initial = null;
  try {
    initial =
      (
        await (
          await adminServerApis()
        ).contract.GET("/v1/admin/settings/{settingId}", { params: { path: { settingId } } })
      ).data ?? null;
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage>
      <SettingDetailView settingId={settingId} initial={initial} />
    </ConsolePage>
  );
}
