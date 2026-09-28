import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PaymentsList } from "@/features/admin/finance/payments";
import { paymentsList } from "@/features/admin/finance/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payments"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Every payment the books know (B5.2). */
export default async function Page({ searchParams }: Props) {
  const t = await getTranslations("finance.payments");
  const initial = await prefetchList(paymentsList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <PaymentsList initial={initial} />
    </ConsolePage>
  );
}
