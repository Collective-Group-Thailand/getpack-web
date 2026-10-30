import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyPayment } from "@/features/customer/checkout/api.server";
import { PaymentPanel } from "@/features/customer/checkout/PaymentPanel";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payment");
  return { title: t("title") };
}

/** Paying — a QR, or a bank-transfer slip uploaded from the phone — in LINE (D-151). */
export default async function Page({ params }: { params: Promise<{ paymentId: string }> }) {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const { paymentId } = await params;
  const [t, payment] = await Promise.all([getTranslations("payment"), getMyPayment(paymentId)]);
  if (!payment) notFound();
  return (
    <div className="flex flex-col gap-4">
      <LiffHeader title={t("title")} />
      <PaymentPanel initial={payment} />
    </div>
  );
}
