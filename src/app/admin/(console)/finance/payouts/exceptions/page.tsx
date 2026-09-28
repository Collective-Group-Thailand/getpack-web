import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PayoutExceptions } from "@/features/admin/finance/payouts";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payouts.exceptionsPage"))("title") };
}

/** Payout exceptions (§8). */
export default async function Page() {
  const t = await getTranslations("finance.payouts.exceptionsPage");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PayoutExceptions />
    </ConsolePage>
  );
}
