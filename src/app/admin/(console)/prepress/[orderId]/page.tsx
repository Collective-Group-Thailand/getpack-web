import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PrepressWorkspace } from "@/features/admin/prepress";
import { PREPRESS_TABS, type PrepressTab } from "@/features/admin/prepress/resources";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("prepress.detail"))("title") };
}

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PrepressWorkspacePage({ params, searchParams }: Props) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const tab = (PREPRESS_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as PrepressTab) : "artwork";
  let initial = null;
  try {
    initial = await (await adminServerApis()).requests.call("GET /v1/admin/prepress/{orderId}", { path: { orderId } });
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PrepressWorkspace orderId={orderId} initial={initial} tab={tab} />
    </ConsolePage>
  );
}
