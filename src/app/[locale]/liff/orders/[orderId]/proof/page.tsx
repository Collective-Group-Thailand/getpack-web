import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyArtwork } from "@/features/customer/artwork/api.server";
import { ProofViewer } from "@/features/customer/artwork/ProofViewer";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("proof");
  return { title: t("title") };
}

/** Approving artwork in LINE (D-151): the same proof viewer as the site. */
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const { orderId } = await params;
  const [t, artwork] = await Promise.all([getTranslations("proof"), getMyArtwork(orderId)]);
  if (!artwork) notFound();
  return (
    <div className="flex flex-col gap-4">
      <LiffHeader
        back={{ href: `/liff/orders/${orderId}`, label: t("back") }}
        title={t("titleFor", { code: artwork.order.orderCode })}
      />
      {artwork.proofs.length === 0 ? (
        <p className="border-border bg-surface rounded-card text-muted border p-4">{t("noneHint")}</p>
      ) : (
        <ProofViewer initial={artwork} version={null} />
      )}
    </div>
  );
}
