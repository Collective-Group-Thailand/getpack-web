import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { FactoryWorkspace } from "@/features/admin/partners";
import { FACTORY_TABS, type FactoryTab } from "@/features/admin/partners/resources";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partners.detail"))("title") };
}

type Props = {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FactoryPage({ params, searchParams }: Props) {
  const [{ factoryId }, query] = await Promise.all([params, searchParams]);
  const tab = (FACTORY_TABS as readonly string[]).includes(String(query.tab))
    ? (query.tab as FactoryTab)
    : "onboarding";
  let initial = null;
  try {
    initial =
      (
        await (
          await adminServerApis()
        ).contract.GET("/v1/admin/factories/{factoryId}", { params: { path: { factoryId } } })
      ).data ?? null;
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <FactoryWorkspace factoryId={factoryId} initial={initial} tab={tab} />
    </ConsolePage>
  );
}
