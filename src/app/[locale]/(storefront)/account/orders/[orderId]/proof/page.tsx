import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { NextStep } from "@/features/customer/shell/NextStep";
import { getMyArtwork } from "@/features/customer/artwork/api.server";
import { ProofViewer } from "@/features/customer/artwork/ProofViewer";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { findLockedDesignOf, getDesignVersion } from "@/features/customer/orders/api.server";
import { DesignViewer } from "@/features/designer/components/DesignViewer";
import { readDesign } from "@/features/designer/document";
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
  const [t, artwork, locked] = await Promise.all([
    getTranslations("proof"),
    getMyArtwork(orderId),
    findLockedDesignOf(orderId).catch(() => null),
  ]);
  if (!artwork) notFound();
  // A studio order (U4.6): the version it locked, drawn as the studio drew it, beside the proof.
  const ordered = locked ? await getDesignVersion(locked.designId, locked.versionNo).catch(() => null) : null;
  const design = ordered ? readDesign(ordered.spec, ordered.content) : null;
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
      {locked && design ? (
        <section aria-labelledby="studio-version" className="flex flex-col gap-2">
          <h2 id="studio-version" className="font-semibold">
            {t("studio.title", { versionNo: locked.versionNo })}
          </h2>
          <p className="text-muted text-sm">{t("studio.hint")}</p>
          <div className="border-border bg-surface aspect-[4/3] max-h-96 rounded-lg border p-2">
            <DesignViewer
              {...design}
              label={t("studio.label", { title: locked.title, versionNo: locked.versionNo })}
              idPrefix="studio-version"
            />
          </div>
          <Link
            href={`/studio/${locked.designId}?step=design`}
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            {t("studio.open")}
          </Link>
        </section>
      ) : null}
      {artwork.proofs.length === 0 ? (
        <EmptyState
          icon="file-check"
          title={t("none")}
          description={t("noneHint")}
          action={<NextStep to="messages" variant="secondary" />}
        />
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
