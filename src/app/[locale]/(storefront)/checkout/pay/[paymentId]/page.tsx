import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyPayment } from "@/features/customer/checkout/api.server";
import { PaymentPanel } from "@/features/customer/checkout/PaymentPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payment");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Paying one instalment (F3 3.3). */
export default async function Page({ params }: { params: Promise<{ paymentId: string }> }) {
  await requireCustomer();
  const { paymentId } = await params;
  const [t, payment] = await Promise.all([getTranslations("payment"), getMyPayment(paymentId)]);
  if (!payment) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="mt-6">
        <PaymentPanel initial={payment} />
      </div>
    </div>
  );
}
