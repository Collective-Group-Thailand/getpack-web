import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getReorder } from "@/features/customer/fulfilment/api.server";
import { ReorderView } from "@/features/customer/fulfilment/ReorderView";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fulfilment.reorder");
  return { title: t("title") };
}

/** Reorder in LINE (D-151), then checkout on the site. */
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const { orderId } = await params;
  const [t, preview] = await Promise.all([getTranslations("fulfilment.reorder"), getReorder(orderId)]);
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/liff/orders/${orderId}`} className="text-primary text-sm">
        {preview ? t("back", { code: preview.source.orderCode }) : t("title")}
      </Link>
      <h1 className="text-xl font-bold">{preview ? t("titleFor", { code: preview.source.orderCode }) : t("title")}</h1>
      {preview ? <ReorderView initial={preview} /> : <Callout tone="info">{t("notAllowed")}</Callout>}
    </div>
  );
}
