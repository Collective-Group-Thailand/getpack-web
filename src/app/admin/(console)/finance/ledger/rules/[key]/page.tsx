import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { LedgerNav, PostingRuleDetail } from "@/features/admin/finance/ledger";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.ledger.pages"))("rule.title") };
}

type Props = { params: Promise<{ key: string }> };

/** One posting rule. */
export default async function Page({ params }: Props) {
  const { key } = await params;
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <LedgerNav />
      <PostingRuleDetail ruleKey={key} />
    </ConsolePage>
  );
}
