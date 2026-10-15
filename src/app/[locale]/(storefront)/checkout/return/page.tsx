import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyPayment } from "@/features/customer/checkout/api.server";
import { PaymentPanel } from "@/features/customer/checkout/PaymentPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payment");
  return { title: t("returnTitle"), robots: { index: false, follow: false } };
}

/**
 * Where 2C2P sends the customer back (F3 3.3). What the gateway puts in the URL is not trusted:
 * the page asks the API for the payment, whose status the gateway's webhook has settled.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  await requireCustomer();
  const { payment: paymentId } = await searchParams;
  if (!paymentId) notFound();
  const [t, payment] = await Promise.all([getTranslations("payment"), getMyPayment(paymentId)]);
  if (!payment) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-title leading-tight">{t("returnTitle")}</h1>
      <div className="mt-6">
        <PaymentPanel initial={payment} />
      </div>
    </div>
  );
}
