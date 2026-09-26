import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyArtwork, designerHrefOf } from "@/features/customer/artwork/api.server";
import { ArtworkWorkspace } from "@/features/customer/artwork/ArtworkWorkspace";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ARTWORK_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, artwork] = await Promise.all([getTranslations("artwork"), getMyArtwork(orderId).catch(() => null)]);
  return {
    title: artwork ? t("titleFor", { code: artwork.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/**
 * An order's artwork (F3 3.5): upload with the rules in words, the dieline template, preflight
 * results per version, the proofs to review — or, for hired design, the brief and the rounds.
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, artwork] = await Promise.all([getTranslations("artwork"), getMyArtwork(orderId)]);
  if (!artwork) notFound();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/account/orders/${orderId}`} className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back", { code: artwork.orderCode })}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <StatusChip map={ARTWORK_STATUS} value={artwork.artworkStatus} size="md" />
        </div>
      </header>
      <ArtworkWorkspace initial={artwork} designerHref={designerHrefOf(artwork)} />
    </div>
  );
}
