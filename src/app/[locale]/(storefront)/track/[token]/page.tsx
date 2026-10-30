import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getTracking } from "@/features/customer/catalog/api.server";
import { OrderStages } from "@/features/customer/fulfilment/OrderStages";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ORDER_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";

type Params = { token: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fulfilment.track");
  // A tracking link is shared, not published: never indexed.
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

/** The order statuses a tracking page names (`PublicTrackingDto.status` is the order's, as a string). */
const ORDER_STATUSES = new Set<string>(Object.keys(ORDER_STATUS));

/**
 * The public tracking page (F3 3.6, `store.tracking.get`): for whoever holds the link or the
 * carton's QR — the order's stages with their planned dates, the expected arrival and each
 * delivery's progress. By decision it names no order code, product, quantity or location, and no
 * name, address, amount or photo (D-224).
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const [t, shipmentT, format, tracking] = await Promise.all([
    getTranslations("fulfilment.track"),
    getTranslations("fulfilment.shipment"),
    getFormat(),
    getTracking(token),
  ]);
  if (!tracking) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20">
      {/* Project A: the status as one card — title, status chip and the dates that matter — then the stages and
          each shipment's timeline as cards. */}
      <header className="border-border bg-surface rounded-panel flex flex-col gap-2 border p-5 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight md:text-[2.25rem]">{t("title")}</h1>
          {ORDER_STATUSES.has(tracking.status) ? (
            <StatusChip map={ORDER_STATUS} value={tracking.status as keyof typeof ORDER_STATUS} size="md" />
          ) : null}
        </div>
        {tracking.promisedShipDate && !tracking.shippedAt ? (
          <p className="text-sm">{t("shipBy", { date: format.date(tracking.promisedShipDate) })}</p>
        ) : null}
        {tracking.deliveredAt ? (
          <p className="text-sm">{t("delivered", { date: format.dateTime(tracking.deliveredAt) })}</p>
        ) : tracking.estimatedDeliveryDate ? (
          <p className="text-sm">{t("arrivesBy", { date: format.date(tracking.estimatedDeliveryDate) })}</p>
        ) : null}
      </header>

      <section aria-labelledby="track-stages" className="border-border bg-surface rounded-panel border p-5 md:p-7">
        <h2 id="track-stages" className="sr-only">
          {t("stages")}
        </h2>
        <OrderStages steps={tracking.steps} />
      </section>

      {tracking.shipments.length > 0 ? (
        <section aria-labelledby="track-shipments" className="flex flex-col gap-3">
          <h2 id="track-shipments" className="text-lg font-semibold">
            {t("shipments")}
          </h2>
          {tracking.shipments.map((shipment) => (
            <article key={shipment.shipmentNo} className="bg-surface border-border rounded-panel border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{t("shipmentNo", { shipment: shipment.shipmentNo })}</h3>
                <StatusChip map={SHIPMENT_STATUS} value={shipment.status} />
              </div>
              <p className="text-muted mt-1 text-xs">
                {shipmentT(shipment.trackingNo ? "metaTracking" : "meta", {
                  shipment: shipment.shipmentNo,
                  carrier: shipmentT(`carrier.${shipment.carrier}`),
                  cartons: format.number(shipment.cartonsCount),
                  tracking: shipment.trackingNo ?? "",
                })}
              </p>
              {shipment.trackingUrl ? (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm underline underline-offset-4"
                >
                  {shipmentT("carrierPage")}
                </a>
              ) : null}
              {/* A timeline, newest first: a dot on a rule, the newest in green. */}
              <ol className="border-border ms-1.5 mt-4 flex flex-col gap-3 border-s ps-5 text-sm">
                {[...shipment.steps].reverse().map((step, index) => (
                  <li key={`${step.occurredAt}-${step.status}`} className="relative flex flex-col gap-0.5">
                    <span
                      aria-hidden="true"
                      className={
                        index === 0
                          ? "bg-primary absolute -start-[1.6875rem] top-1 size-3 rounded-full"
                          : "bg-border-strong absolute -start-[1.625rem] top-1.5 size-2 rounded-full"
                      }
                    />
                    <span className={index === 0 ? "font-semibold" : undefined}>
                      {shipmentT(`eventStatus.${step.status}`)}
                    </span>
                    <time dateTime={step.occurredAt} className="text-muted text-xs tabular-nums">
                      {format.dateTime(step.occurredAt)}
                    </time>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      ) : null}

      <p className="text-muted text-xs">
        <Link href="/account/orders" className="text-primary underline underline-offset-4">
          {t("owner")}
        </Link>
      </p>
    </div>
  );
}
