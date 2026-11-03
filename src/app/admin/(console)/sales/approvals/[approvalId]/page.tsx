import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { ApprovalDetail } from "@/features/admin/sales/approvals/ApprovalDetail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.approval"))("pageTitle") };
}

type Props = { params: Promise<{ approvalId: string }> };

export default async function ApprovalPage({ params }: Props) {
  const { approvalId } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <ApprovalDetail approvalId={approvalId} />
    </ConsolePage>
  );
}
