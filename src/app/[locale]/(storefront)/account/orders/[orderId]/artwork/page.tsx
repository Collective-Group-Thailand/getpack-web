import type { Metadata } from "next";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyArtwork } from "@/features/customer/artwork/api.server";
import { ArtworkWorkspace } from "@/features/customer/artwork/ArtworkWorkspace";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { findLockedDesignOf } from "@/features/customer/orders/api.server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ARTWORK_STATUS } from "@/domain/status";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, artwork] = await Promise.all([getTranslations("artwork"), getMyArtwork(orderId).catch(() => null)]);
  return {
    title: artwork ? t("titleFor", { code: artwork.order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/**
 * An order's artwork (F3 3.5): the dieline template, the upload, preflight results per version,
 * the proofs to review — or, for hired design, the brief and the rounds.
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, artwork, design] = await Promise.all([
    getTranslations("artwork"),
    getMyArtwork(orderId),
    // The studio design the order was placed with, if any: a convenience the page never fails over.
    findLockedDesignOf(orderId).catch(() => null),
  ]);
  if (!artwork) notFound();

  return (
    <div className="flex flex-col gap-8">
      <AccountHeader
        back={{ href: `/account/orders/${orderId}`, label: t("back", { code: artwork.order.orderCode }) }}
        title={t("title")}
        status={<StatusChip map={ARTWORK_STATUS} value={artwork.order.artworkStatus} size="md" />}
      />
      <ArtworkWorkspace initial={artwork} design={design} />
    </div>
  );
}
