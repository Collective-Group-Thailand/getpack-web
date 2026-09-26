import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ApprovalDetail } from "@/features/admin/approvals";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { adminServerApis } from "@/features/admin/console/api.server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("approvals"))("detailTitle") };
}

export default async function ApprovalPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  let initial = null;
  try {
    initial =
      (
        await (
          await adminServerApis()
        ).contract.GET("/v1/admin/approvals/{requestId}", { params: { path: { requestId } } })
      ).data ?? null;
  } catch {
    // The client asks again and renders the answer — a 404 or 403 as itself, with a request id.
  }
  return (
    <ConsolePage>
      <ApprovalDetail requestId={requestId} initial={initial} />
    </ConsolePage>
  );
}
