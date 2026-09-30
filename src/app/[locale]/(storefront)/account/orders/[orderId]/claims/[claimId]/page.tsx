import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyClaim } from "@/features/customer/fulfilment/api.server";
import { ClaimThread } from "@/features/customer/fulfilment/ClaimThread";
import { Link } from "@/i18n/navigation";

type Params = { orderId: string; claimId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { claimId } = await params;
  const [t, claim] = await Promise.all([
    getTranslations("fulfilment.claimView"),
    getMyClaim(claimId).catch(() => null),
  ]);
  return {
    title: claim ? t("title", { claim: claim.claimNo }) : t("fallback"),
    robots: { index: false, follow: false },
  };
}

/** One claim, followed by the customer (F3 3.6). */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId, claimId } = await params;
  const [t, claim] = await Promise.all([getTranslations("fulfilment.claimView"), getMyClaim(claimId)]);
  if (!claim) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href={`/account/orders/${orderId}`} className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back", { code: claim.orderCode })}
        </Link>
        <h1 className="text-2xl font-bold">{t("title", { claim: claim.claimNo })}</h1>
      </header>
      <ClaimThread initial={claim} />
    </div>
  );
}
