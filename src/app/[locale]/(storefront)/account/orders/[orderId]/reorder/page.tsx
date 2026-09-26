import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getReorder } from "@/features/customer/fulfilment/api.server";
import { ReorderView } from "@/features/customer/fulfilment/ReorderView";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, order] = await Promise.all([getTranslations("fulfilment.reorder"), getMyOrder(orderId).catch(() => null)]);
  return {
    title: order ? t("titleFor", { code: order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/** Ordering the same again (F3 3.6, D-153). */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, order, preview] = await Promise.all([
    getTranslations("fulfilment.reorder"),
    getMyOrder(orderId),
    getReorder(orderId),
  ]);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/account/orders/${order.id}`} className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back", { code: order.orderCode })}
        </Link>
        <h1 className="text-2xl font-bold">{t("titleFor", { code: order.orderCode })}</h1>
        {preview ? <p className="text-muted text-sm">{t("intro", { product: preview.product.name })}</p> : null}
      </header>
      {preview ? <ReorderView initial={preview} /> : <Callout tone="info">{t("notAllowed")}</Callout>}
    </div>
  );
}
