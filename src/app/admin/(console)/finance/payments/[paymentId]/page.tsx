import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PaymentDetail } from "@/features/admin/finance/payments";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.payments.detail"))("title") };
}

type Props = { params: Promise<{ paymentId: string }> };

/** One payment and what came of it. */
export default async function Page({ params }: Props) {
  const { paymentId } = await params;
  return (
    <ConsolePage>
      <PaymentDetail paymentId={paymentId} />
    </ConsolePage>
  );
}
