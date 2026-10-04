import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyArtwork } from "@/features/customer/artwork/api.server";
import { ProofViewer } from "@/features/customer/artwork/ProofViewer";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/ui/components/EmptyState";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, artwork] = await Promise.all([getTranslations("proof"), getMyArtwork(orderId).catch(() => null)]);
  return {
    title: artwork ? t("titleFor", { code: artwork.order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/** Reviewing a proof (F3 3.5): `?version=N` opens that version, the latest otherwise. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ version?: string }>;
}) {
  await requireCustomer();
  const [{ orderId }, { version }] = await Promise.all([params, searchParams]);
  const [t, artwork] = await Promise.all([getTranslations("proof"), getMyArtwork(orderId)]);
  if (!artwork) notFound();
  const requested = Number(version);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={`/account/orders/${orderId}/artwork`}
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-bold">{t("titleFor", { code: artwork.order.orderCode })}</h1>
        {artwork.rules?.dieline?.styleCode ? (
          // D-184: the style code rides on the proof, as on the quote, order and job.
          <p className="text-muted text-sm">{t("styleCode", { code: artwork.rules.dieline.styleCode })}</p>
        ) : null}
      </header>
      {artwork.proofs.length === 0 ? (
        <EmptyState icon="file-check" title={t("none")} description={t("noneHint")} />
      ) : (
        <ProofViewer
          initial={artwork}
          version={
            Number.isInteger(requested) && artwork.proofs.some((proof) => proof.versionNo === requested)
              ? requested
              : null
          }
        />
      )}
    </div>
  );
}
