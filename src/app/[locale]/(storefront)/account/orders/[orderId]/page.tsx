import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { formatTaxId } from "@/features/customer/account/tax-id";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { PayInstalmentButton } from "@/features/customer/checkout/PayInstalmentButton";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { DocumentLink } from "@/features/customer/orders/DocumentLink";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import {
  ARTWORK_STATUS,
  CLAIM_STATUS,
  DOCUMENT_STATUS,
  INSTALMENT_STATUS,
  ORDER_STATUS,
  SHIPMENT_STATUS,
} from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PriceSummary } from "@/ui/components/PriceSummary";
import { Timeline } from "@/ui/components/Timeline";
import type { IconName } from "@/ui/icons";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, order] = await Promise.all([getTranslations("myOrders"), getMyOrder(orderId).catch(() => null)]);
  return {
    title: order ? t("detail.title", { code: order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

const TIMELINE_ICON: Record<string, IconName> = {
  "order.placed": "cart",
  "payment.received": "wallet",
  "artwork.submitted": "upload",
  "proof.sent": "file-check",
  "proof.approved": "check",
  "proof.changes_requested": "edit",
  "milestone.completed": "factory",
  "shipment.picked_up": "truck",
  "shipment.delivered": "package-check",
  "order.receipt_confirmed": "check",
  "order.cancelled": "ban",
};

const SUCCESS = new Set(["payment.received", "proof.approved", "shipment.delivered", "order.receipt_confirmed"]);

/**
 * One order as the customer sees it (F3 3.4): where it stands and the next thing to do, then its
 * timeline (promised vs actual, with photos), instalments, documents, deliveries, claims and what
 * was ordered. Nothing here computes — every figure and date is the API's.
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, format, order] = await Promise.all([getTranslations("myOrders"), getFormat(), getMyOrder(orderId)]);
  if (!order) notFound();

  const due = order.instalments.find((instalment) => instalment.payable) ?? null;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link href="/account/orders" className="text-primary text-sm underline-offset-4 hover:underline">
          {t("detail.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{order.product.name}</h1>
          <StatusChip map={ORDER_STATUS} value={order.status} size="md" />
          <StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} size="md" />
        </div>
        <p className="text-muted text-sm">
          <span className="font-mono">{order.orderCode}</span>
          {" · "}
          {t("detail.placed", { date: format.dateTime(order.createdAt), group: order.group.groupCode })}
        </p>
        {order.nextActions.length > 0 ? (
          <OrderActions orderId={order.id} orderCode={order.orderCode} actions={order.nextActions} payable={due} />
        ) : null}
        {order.expiresAt && order.status === "waiting_payment" ? (
          <Callout tone="warning">{t("detail.expires", { date: format.dateTime(order.expiresAt) })}</Callout>
        ) : null}
        {order.cancelledAt ? (
          <Callout tone="neutral" title={t("detail.cancelled", { date: format.date(order.cancelledAt) })}>
            {order.cancelReason}
          </Callout>
        ) : null}
        {order.receipt?.autoCompleteAt && !order.receipt.confirmedAt && order.status !== "completed" ? (
          <Callout tone="info">
            {t("detail.autoComplete", {
              date: format.date(order.receipt.autoCompleteAt),
              claim: format.date(order.receipt.claimWindowEndsAt),
            })}
          </Callout>
        ) : null}
      </header>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="order-timeline">
            <h2 id="order-timeline" className="text-lg font-semibold">
              {t("detail.timeline")}
            </h2>
            <Timeline
              className="mt-4"
              label={t("detail.timeline")}
              items={order.timeline.map((entry) => ({
                id: entry.id,
                title: entry.title,
                icon: TIMELINE_ICON[entry.kind] ?? "circle",
                tone: SUCCESS.has(entry.kind) ? ("success" as const) : ("neutral" as const),
                time: (
                  <>
                    <time dateTime={entry.at}>{format.dateTime(entry.at)}</time>
                    {entry.promisedAt ? ` · ${t("detail.promised", { date: format.date(entry.promisedAt) })}` : null}
                  </>
                ),
                description:
                  entry.detail || entry.photos.length > 0 ? (
                    <>
                      {entry.detail}
                      {entry.photos.length > 0 ? (
                        <span className="mt-2 flex gap-2">
                          {entry.photos.map((photo) =>
                            photo.thumbnailUrl || photo.url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- evidence photo from the API
                              <img
                                key={photo.id}
                                src={photo.thumbnailUrl ?? photo.url!}
                                alt={t("detail.photo", { name: photo.originalName })}
                                className="size-16 rounded object-cover"
                              />
                            ) : null,
                          )}
                        </span>
                      ) : null}
                    </>
                  ) : undefined,
              }))}
            />
          </section>

          <section id="instalments" aria-labelledby="instalments-title">
            <h2 id="instalments-title" className="text-lg font-semibold">
              {t("detail.instalments")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {order.instalments.map((instalment) => (
                <li
                  key={instalment.id}
                  className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{instalment.label}</p>
                    <p className="text-muted text-xs">
                      {instalment.dueAt
                        ? t("detail.dueBy", { date: format.date(instalment.dueAt) })
                        : t(`detail.trigger.${instalment.requiredBefore}`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{format.thb(instalment.grossAmount)}</span>
                    <StatusChip map={INSTALMENT_STATUS} value={instalment.status} />
                    {instalment.payable ? (
                      <PayInstalmentButton size="sm" instalment={instalment} orderCode={order.orderCode}>
                        {instalment.activePaymentId ? t("detail.continuePay") : t("detail.pay")}
                        <span className="sr-only"> {instalment.label}</span>
                      </PayInstalmentButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {order.group.orderCount > 1 ? (
              <p className="text-muted mt-2 text-xs">{t("detail.groupShare", { count: order.group.orderCount })}</p>
            ) : null}
          </section>

          <section aria-labelledby="order-documents">
            <h2 id="order-documents" className="text-lg font-semibold">
              {t("detail.documents")}
            </h2>
            {order.documents.length === 0 ? (
              <p className="text-muted mt-2 text-sm">{t("detail.noDocuments")}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {order.documents.map((document) => (
                  <li
                    key={document.id}
                    className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {t(`documents.types.${document.type}`)}
                        {document.final ? ` · ${t("documents.final")}` : ""}
                        {document.instalmentSeq
                          ? ` · ${t("documents.forInstalment", { seq: document.instalmentSeq })}`
                          : ""}
                      </p>
                      <p className="text-muted text-xs">
                        {t("detail.documentMeta", {
                          number: document.number,
                          date: format.date(document.issuedAt),
                          amount: format.thb(document.grossAmount),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip map={DOCUMENT_STATUS} value={document.status} />
                      <DocumentLink orderId={order.id} documentId={document.id} number={document.number} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {order.shipments.length > 0 ? (
            <section aria-labelledby="order-shipments">
              <h2 id="order-shipments" className="text-lg font-semibold">
                {t("detail.shipments")}
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {order.shipments.map((shipment) => (
                  <li key={shipment.id} className="border-border rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {t("detail.shipmentTo", {
                          quantity: format.number(shipment.quantity),
                          unit: order.unit,
                          name: shipment.destination.recipientName,
                          province: shipment.destination.province,
                        })}
                      </p>
                      <StatusChip map={SHIPMENT_STATUS} value={shipment.status} />
                    </div>
                    <p className="text-muted mt-1 text-xs">
                      {t(shipment.trackingNo ? "detail.shipmentMetaTracking" : "detail.shipmentMeta", {
                        shipment: shipment.shipmentNo,
                        carrier: t(`detail.carrier.${shipment.carrier}`),
                        tracking: shipment.trackingNo ?? "",
                      })}
                    </p>
                    {shipment.pod ? (
                      <p className="mt-2 text-sm">
                        {t("detail.pod", {
                          name: shipment.pod.receiverName,
                          quantity: format.number(shipment.pod.deliveredQuantity),
                          date: format.dateTime(shipment.pod.capturedAt),
                        })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {order.trackingToken ? (
                <p className="mt-3 text-sm">
                  <Link
                    href={`/track/${order.trackingToken}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t("detail.publicTracking")}
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}

          {order.toleranceOutcome ? (
            <section aria-labelledby="order-tolerance">
              <h2 id="order-tolerance" className="text-lg font-semibold">
                {t("detail.tolerance")}
              </h2>
              <p className="mt-2 text-sm">
                {t(`tolerance.${order.toleranceOutcome.outcome}`, {
                  ordered: format.number(order.toleranceOutcome.orderedQuantity),
                  delivered: format.number(order.toleranceOutcome.deliveredQuantity),
                  credit: format.thb(order.toleranceOutcome.creditAmount),
                })}
              </p>
            </section>
          ) : null}

          {order.claims.length > 0 ? (
            <section aria-labelledby="order-claims">
              <h2 id="order-claims" className="text-lg font-semibold">
                {t("detail.claims")}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {order.claims.map((claim) => (
                  <li
                    key={claim.id}
                    className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <span>
                      {t("detail.claimLine", {
                        claim: claim.claimNo,
                        type: t(`claimTypes.${claim.type}`),
                        date: format.date(claim.submittedAt),
                      })}
                    </span>
                    <StatusChip map={CLAIM_STATUS} value={claim.status} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside aria-label={t("detail.what")} className="flex flex-col gap-6">
          <section aria-labelledby="order-what">
            <h2 id="order-what" className="text-lg font-semibold">
              {t("detail.what")}
            </h2>
            <DescriptionList
              className="mt-3"
              items={[
                ...order.specs.map((spec) => ({ term: spec.label, description: spec.value })),
                { term: t("detail.quantity"), description: `${format.number(order.quantity)} ${order.unit}` },
                { term: t("detail.design"), description: t(`detail.designOptions.${order.designOption}`) },
                {
                  term: t("detail.toleranceTerms"),
                  description: t("detail.toleranceValue", {
                    shortage: format.percent(order.tolerance.shortagePct, 1),
                    overage: format.percent(order.tolerance.overagePct, 1),
                  }),
                },
              ]}
            />
          </section>
          <section aria-labelledby="order-price">
            <h2 id="order-price" className="text-lg font-semibold">
              {t("detail.price")}
            </h2>
            <PriceSummary
              className="mt-3"
              rows={[
                ...order.lines.map((line) => ({
                  label: line.description,
                  value: format.thb(line.grossAmount),
                  hint: line.waivedReason ?? undefined,
                })),
                ...(order.discountAmount !== "0.00"
                  ? [
                      {
                        label: t("detail.discount"),
                        value: t("detail.minus", { amount: format.thb(order.discountAmount) }),
                        tone: "discount" as const,
                      },
                    ]
                  : []),
                { label: t("detail.vat"), value: format.thb(order.vatAmount), tone: "muted" as const },
              ]}
              total={{ label: t("detail.total"), value: format.thb(order.grossAmount) }}
            />
          </section>
          <section aria-labelledby="order-delivery">
            <h2 id="order-delivery" className="text-lg font-semibold">
              {t("detail.deliveryTo")}
            </h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {order.destinations.map((destination) => (
                <li key={destination.id}>
                  <p className="font-medium">
                    {t("detail.destinationLine", {
                      name: destination.recipientName,
                      quantity: format.number(destination.quantity),
                      unit: order.unit,
                    })}
                  </p>
                  <p className="text-muted">
                    {[
                      destination.line1,
                      destination.subdistrict,
                      destination.district,
                      destination.province,
                      destination.postcode,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </li>
              ))}
            </ul>
            {order.taxInvoice ? (
              <p className="text-muted mt-3 text-xs">
                {t("detail.taxInvoice", {
                  name: order.taxInvoice.name,
                  taxId: formatTaxId(order.taxInvoice.taxId),
                  branch: order.taxInvoice.branch,
                })}
              </p>
            ) : null}
            {order.poNumber ? (
              <p className="text-muted mt-1 text-xs">{t("detail.po", { po: order.poNumber })}</p>
            ) : null}
          </section>
          <p className="text-sm">
            <Link href="/help/contact" className="text-primary underline-offset-4 hover:underline">
              {t("detail.help")}
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
