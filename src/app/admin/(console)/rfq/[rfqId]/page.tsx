import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { RfqDetail } from "@/features/admin/rfq";
import { RFQ_TABS, type RfqTab } from "@/features/admin/rfq/resources";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("rfq.detail"))("title") };
}

type Props = {
  params: Promise<{ rfqId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RfqDetailPage({ params, searchParams }: Props) {
  const [{ rfqId }, query] = await Promise.all([params, searchParams]);
  const tab = (RFQ_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as RfqTab) : "request";
  let initial = null;
  try {
    initial = await (await adminServerApis()).requests.call("GET /v1/admin/rfqs/{rfqId}", { path: { rfqId } });
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <RfqDetail rfqId={rfqId} initial={initial} tab={tab} />
    </ConsolePage>
  );
}
