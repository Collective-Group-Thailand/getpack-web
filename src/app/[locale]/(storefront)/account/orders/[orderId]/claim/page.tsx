import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { TrackOnView } from "@/features/customer/analytics/TrackOnView";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getClaimForm } from "@/features/customer/fulfilment/api.server";
import { ClaimForm } from "@/features/customer/fulfilment/ClaimForm";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, detail] = await Promise.all([getTranslations("fulfilment.claim"), getMyOrder(orderId).catch(() => null)]);
  return {
    title: detail ? t("titleFor", { code: detail.order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/** Reporting a problem with a delivered order (F3 3.6, D-082). */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, detail, form] = await Promise.all([
    getTranslations("fulfilment.claim"),
    getMyOrder(orderId),
    getClaimForm(orderId),
  ]);
  if (!detail) notFound();
  const { order } = detail;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/account/orders/${order.id}`} className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back", { code: order.orderCode })}
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>
      {form?.open ? (
        <>
          <TrackOnView name="claim_started" properties={{ route: "/account/orders/[orderId]/claim" }} />
          <ClaimForm orderId={order.id} orderCode={order.orderCode} form={form} />
        </>
      ) : form ? (
        <ClaimForm orderId={order.id} orderCode={order.orderCode} form={form} />
      ) : (
        <Callout tone="info">{t("notYet")}</Callout>
      )}
    </div>
  );
}
