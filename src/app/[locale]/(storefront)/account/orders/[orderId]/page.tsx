import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { pick } from "@/features/customer/catalog/localize";
import { PayInstalmentButton } from "@/features/customer/checkout/PayInstalmentButton";
import { OrderStages } from "@/features/customer/fulfilment/OrderStages";
import { ShipmentCard } from "@/features/customer/fulfilment/ShipmentCard";
import { findLockedDesignOf, getMyOrder } from "@/features/customer/orders/api.server";
import { AskAbout } from "@/features/customer/messages/StartThread";
import { DocumentLink } from "@/features/customer/orders/DocumentLink";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { SpecSheet } from "@/features/customer/orders/SpecSheet";
import { listMySamples } from "@/features/customer/samples/api.server";
import { ToleranceOutcome } from "@/features/customer/orders/ToleranceOutcome";
import { productNameOf, specLinesOf } from "@/features/customer/orders/summary";
import { journeySteps } from "@/features/customer/fulfilment/journey";
import { timelineTitle } from "@/features/customer/orders/timeline";
import { TrackingLinkButton } from "@/features/customer/orders/TrackingLinkButton";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CLAIM_STATUS, DOCUMENT_STATUS, SAMPLE_STATUS, INSTALMENT_STATUS, ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PriceSummary } from "@/ui/components/PriceSummary";
import { Timeline } from "@/ui/components/Timeline";
import type { IconName } from "@/ui/icons";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, detail] = await Promise.all([getTranslations("myOrders"), getMyOrder(orderId).catch(() => null)]);
  return {
    title: detail ? t("detail.title", { code: detail.order.orderCode }) : t("title"),
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
  "production.milestone_reached": "factory",
  "shipment.picked_up": "truck",
  "shipment.delivered": "package-check",
  "order.receipt_confirmed": "check",
  "order.cancelled": "ban",
};

const SUCCESS = new Set(["payment.received", "proof.approved", "shipment.delivered", "order.receipt_confirmed"]);

/**
 * One order as the customer sees it (F3 3.4): where it stands and the next thing to do, then its
 * timeline, instalments, documents, deliveries, claims and what was ordered — its product, spec
 * lines and unit, the receipt stamps, how much arrived against what was ordered, the estimated
 * delivery and why it was cancelled — each from its own published read (`getMyOrder`). Nothing here
 * computes; every figure and date is the API's.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ payment?: string }>;
}) {
  await requireCustomer();
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const [t, tCatalog, tJourney, format, locale, detail, design, samples] = await Promise.all([
    getTranslations("myOrders"),
    getTranslations("catalog"),
    getTranslations("fulfilment.journey"),
    getFormat(),
    getLocale(),
    getMyOrder(orderId),
    // A link to the studio design is a convenience: the order page never fails over it.
    findLockedDesignOf(orderId).catch(() => null),
    // The order's sample, if it has one (U2.F3): production waits for its approval (D-256).
    listMySamples()
      .then((list) => list.filter((sample) => sample.orderId === orderId))
      .catch(() => []),
  ]);
  if (!detail) notFound();
  const { order, group, instalments } = detail;
  const name = productNameOf(locale, order.summary);
  const unit = tCatalog(`stock.units.${order.summary.unit}`);
  const payableOf = (instalment: (typeof instalments)[number]) => ({
    id: instalment.id,
    groupId: instalment.groupId,
    label: pick(locale, instalment.labelTh, instalment.labelEn),
    grossAmount: instalment.openAmount,
    activePaymentId: instalment.activePaymentId,
  });
  const due = instalments.find((instalment) => instalment.payable) ?? null;
  const payable = due ? payableOf(due) : null;
  const { receipt } = order;
  const cancelReason = order.cancelReasonNameTh
    ? pick(locale, order.cancelReasonNameTh, order.cancelReasonNameEn)
    : null;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link href="/account/orders" className="text-primary text-sm underline-offset-4 hover:underline">
          {t("detail.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title leading-tight">{name}</h1>
          {/* One chip (UX audit step 12): the artwork's state is in the card below and on its page. */}
          <StatusChip map={ORDER_STATUS} value={order.status} size="md" />
        </div>
        <p className="text-muted flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
          <span className="font-mono">{order.orderCode}</span>
          {group ? (
            <>
              {" · "}
              {t("detail.placed", { date: format.dateTime(group.placedAt), group: group.groupCode })}
            </>
          ) : null}
          <span className="ms-2">
            <AskAbout subject={{ type: "order", id: order.id, label: order.orderCode }} variant="ghost" />
          </span>
        </p>
        {detail.actions.length > 0 || payable ? (
          // What the customer has to do now, with its deadline (the "AccountOrder" board).
          <div className="border-border bg-surface rounded-card flex flex-wrap items-center justify-between gap-4 border border-s-4 border-s-[var(--color-accent)] px-5 py-4.5">
            <div className="min-w-0">
              <p className="font-semibold">
                {payable
                  ? t("detail.todoPay", { label: payable.label })
                  : order.status === "completed"
                    ? t("detail.todoDone")
                    : // A delivered order's actions (claim, reorder) are options, not a duty.
                      receipt.deliveredAt
                      ? t("detail.todoOptional")
                      : t("detail.todo")}
              </p>
              {due ? (
                <p className="text-muted mt-1 text-sm">
                  {t(`detail.todoPurpose.${due.requiredBefore}`)}
                  {group?.expiresAt && order.status === "waiting_payment"
                    ? ` · ${t("detail.todoBy", { date: format.dateTime(group.expiresAt) })}`
                    : null}
                </p>
              ) : null}
            </div>
            <OrderActions orderId={order.id} orderCode={order.orderCode} actions={detail.actions} payable={payable} />
          </div>
        ) : null}
        {/* The artwork workspace is a destination, not a footnote: a button, beside the design link. */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button asChild variant="secondary" size="sm" iconStart="images">
            <Link href={`/account/orders/${order.id}/artwork`}>{t("detail.artworkLink")}</Link>
          </Button>
          {design ? (
            <Link
              href={`/studio/${design.designId}?step=design`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("detail.designLink", { title: design.title, versionNo: design.versionNo })}
            </Link>
          ) : null}
        </div>
        {query.payment === "not_started" && payable ? (
          // Checkout placed the order but could not start its payment (round 2, B1): the order is
          // safe and the pay button above starts it again.
          <Callout tone="warning" live title={t("detail.paymentNotStarted.title")}>
            {t("detail.paymentNotStarted.body")}
          </Callout>
        ) : null}
        {group?.status === "pending_company_approval" ? (
          // CONTRACT-REQUEST store.order-group-company-approval — the group does not name its
          // approvers yet, so the buyer reads "the company's approver" until it does (round 2, B2).
          <Callout tone="info" icon="stamp" title={t("detail.companyApproval.title")}>
            {t("detail.companyApproval.body", { date: format.dateTime(group.placedAt) })}
          </Callout>
        ) : null}
        {group?.expiresAt && order.status === "waiting_payment" && !payable ? (
          <Callout tone="warning">{t("detail.expires", { date: format.dateTime(group.expiresAt) })}</Callout>
        ) : null}
        {order.cancelledAt ? (
          <Callout tone="neutral" title={t("detail.cancelled", { date: format.date(order.cancelledAt) })}>
            {cancelReason ? t("detail.cancelReason", { reason: cancelReason }) : null}
          </Callout>
        ) : null}
        {receipt.deliveredAt && !receipt.completedAt && receipt.autoCompleteAt ? (
          <Callout tone="info">
            {t("detail.autoComplete", {
              date: format.date(receipt.autoCompleteAt),
              claim: format.date(receipt.claimWindowEndsAt),
            })}
          </Callout>
        ) : null}
        {order.toleranceOutcome ? <ToleranceOutcome outcome={order.toleranceOutcome} unit={unit} /> : null}
      </header>

      {detail.progress ? (
        <section aria-labelledby="order-stages" className="border-border bg-surface rounded-card border px-6 py-6">
          <h2 id="order-stages" className="sr-only">
            {t("detail.stages")}
          </h2>
          <OrderStages
            steps={journeySteps(detail.progress, group?.placedAt ?? order.createdAt, (key) => tJourney(key))}
          />
          {detail.progress.steps.length > 0 ? (
            // The factory's own steps, under the journey they are the "production" stage of.
            <div className="border-border mt-6 border-t pt-5">
              <h3 className="text-muted mb-3 text-xs font-semibold">{t("detail.factorySteps")}</h3>
              <OrderStages steps={detail.progress.steps} />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="order-timeline" className="border-border bg-surface rounded-card border px-5 py-5">
            <h2 id="order-timeline" className="text-base font-bold">
              {t("detail.timeline")}
            </h2>
            {(() => {
              const items = detail.timeline
                .flatMap((entry) => {
                  // An entry the storefront has no words for is left out, never a bare date (round 2, B13).
                  const title = timelineTitle(t, locale, entry);
                  return title ? [{ entry, title }] : [];
                })
                .map(({ entry, title }) => ({
                  id: entry.id,
                  title,
                  icon: TIMELINE_ICON[entry.type] ?? "circle",
                  tone: SUCCESS.has(entry.type) ? ("success" as const) : ("neutral" as const),
                  time: <time dateTime={entry.occurredAt}>{format.dateTime(entry.occurredAt)}</time>,
                  description:
                    entry.photoFileIds.length > 0
                      ? t("detail.photos", { count: entry.photoFileIds.length })
                      : undefined,
                }));
              // A finished order has twenty-odd entries: the latest few stay in view, the rest fold
              // above them (customer walkthrough 2026-10-16).
              const RECENT = 6;
              const earlier = items.length > RECENT + 2 ? items.slice(0, items.length - RECENT) : [];
              const recent = earlier.length > 0 ? items.slice(items.length - RECENT) : items;
              return (
                <>
                  {earlier.length > 0 ? (
                    <details className="group mt-4">
                      <summary className="text-primary cursor-pointer list-none text-sm underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">
                          {t("detail.timelineEarlier", { count: earlier.length })}
                        </span>
                        <span className="hidden group-open:inline">{t("detail.timelineEarlierHide")}</span>
                      </summary>
                      <Timeline className="mt-4" label={t("detail.timeline")} items={earlier} />
                    </details>
                  ) : null}
                  <Timeline className="mt-4" label={t("detail.timeline")} items={recent} />
                </>
              );
            })()}
          </section>

          {instalments.length > 0 ? (
            <section
              id="instalments"
              aria-labelledby="instalments-title"
              className="border-border bg-surface rounded-card border px-5 py-5"
            >
              <h2 id="instalments-title" className="text-base font-bold">
                {t("detail.instalments")}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {instalments.map((instalment) => (
                  <li
                    key={instalment.id}
                    className="bg-surface border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{pick(locale, instalment.labelTh, instalment.labelEn)}</p>
                      <p className="text-muted text-xs">
                        {instalment.dueAt
                          ? t("detail.dueBy", { date: format.date(instalment.dueAt) })
                          : t(`detail.trigger.${instalment.requiredBefore}`)}
                      </p>
                    </div>
                    {/* On a phone the amount and status share a line and the button takes its own, full
                        width — the three side by side were wider than the card at 390 px. */}
                    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
                      <span className="tabular-nums">{format.thb(instalment.grossAmount)}</span>
                      <StatusChip map={INSTALMENT_STATUS} value={instalment.status} />
                      {instalment.payable ? (
                        // The instalment that is due is the one to press; a later one can be paid
                        // early, but reads as the quieter choice (customer walk, round 8: two identical
                        // "ชำระงวดนี้" buttons left the customer unsure which one the factory waits for).
                        <PayInstalmentButton
                          size="sm"
                          className="w-full sm:ms-auto sm:w-auto"
                          variant={
                            instalment.status === "due" || instalment.status === "overdue" || instalment.activePaymentId
                              ? "primary"
                              : "secondary"
                          }
                          instalment={payableOf(instalment)}
                          orderCode={order.orderCode}
                        >
                          {instalment.activePaymentId
                            ? t("detail.continuePay")
                            : instalment.status === "due" || instalment.status === "overdue"
                              ? t("detail.pay")
                              : t("detail.payEarly")}
                          <span className="sr-only"> {pick(locale, instalment.labelTh, instalment.labelEn)}</span>
                        </PayInstalmentButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {group && group.orders.length > 1 ? (
                <p className="text-muted mt-2 text-xs">{t("detail.groupShare", { count: group.orders.length })}</p>
              ) : null}
            </section>
          ) : null}

          {samples.length > 0 ? (
            <section
              aria-labelledby="order-samples"
              className="border-border bg-surface rounded-card flex flex-col gap-2 border px-5 py-5"
            >
              <h2 id="order-samples" className="text-base font-bold">
                {t("detail.samples")}
              </h2>
              <ul className="flex flex-col gap-2">
                {samples.map((sample) => (
                  <li key={sample.id} className="flex flex-wrap items-center gap-3 text-sm">
                    <StatusChip map={SAMPLE_STATUS} value={sample.status} />
                    <Link href={`/account/samples/${sample.id}`} className="text-primary underline underline-offset-4">
                      {t("detail.sampleOpen", { date: format.date(sample.createdAt) })}
                    </Link>
                  </li>
                ))}
              </ul>
              {samples.some((sample) => !["approved", "cancelled", "rejected", "expired"].includes(sample.status)) ? (
                <p className="text-muted text-sm">{t("detail.sampleHold")}</p>
              ) : null}
            </section>
          ) : null}
          {order.artworkStatus === "approved" ? <SpecSheet orderId={order.id} /> : null}
          <section aria-labelledby="order-documents" className="border-border bg-surface rounded-card border px-5 py-5">
            <h2 id="order-documents" className="text-base font-bold">
              {t("detail.documents")}
            </h2>
            {detail.documents.length === 0 ? (
              <p className="text-muted mt-2 text-sm">{t("detail.noDocuments")}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {detail.documents.map((document) => (
                  <li
                    key={document.id}
                    className="bg-surface border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {t(`documents.types.${document.docType}`)}
                        {document.docKind === "final" ? ` · ${t("documents.final")}` : ""}
                      </p>
                      <p className="text-muted text-xs">
                        {t("detail.documentMeta", {
                          number: document.docNumber,
                          date: format.date(document.issuedAt),
                          amount: format.thb(document.grossAmount),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip map={DOCUMENT_STATUS} value={document.status} />
                      {document.pdfReady ? <DocumentLink documentId={document.id} number={document.docNumber} /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {detail.shipments.length > 0 ? (
            <section
              aria-labelledby="order-shipments"
              className="border-border bg-surface rounded-card border px-5 py-5"
            >
              <h2 id="order-shipments" className="text-base font-bold">
                {t("detail.shipments")}
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                {detail.shipments.map((shipment) => (
                  <ShipmentCard key={shipment.id} shipment={shipment} orderCode={order.orderCode} />
                ))}
              </div>
              <p className="mt-3 text-sm">
                <TrackingLinkButton orderId={order.id} />
              </p>
            </section>
          ) : null}

          {detail.claims.length > 0 ? (
            <section aria-labelledby="order-claims" className="border-border bg-surface rounded-card border px-5 py-5">
              <h2 id="order-claims" className="text-base font-bold">
                {t("detail.claims")}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {detail.claims.map((claim) => (
                  <li
                    key={claim.id}
                    className="bg-surface border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <Link
                      href={`/account/orders/${order.id}/claims/${claim.id}`}
                      className="text-primary underline underline-offset-4"
                    >
                      {t("detail.claimLine", {
                        claim: claim.claimNo,
                        type: t(`claimTypes.${claim.type}`),
                        date: format.date(claim.submittedAt),
                      })}
                    </Link>
                    <StatusChip map={CLAIM_STATUS} value={claim.status} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside aria-label={t("detail.what")} className="flex flex-col gap-5">
          <section aria-labelledby="order-what" className="border-border bg-surface rounded-card border px-5 py-5">
            <h2 id="order-what" className="text-base font-bold">
              {t("detail.what")}
            </h2>
            <DescriptionList
              className="mt-3"
              items={[
                ...specLinesOf(locale, order.summary),
                {
                  term: t("detail.quantity"),
                  description: t("detail.quantityUnit", { quantity: format.number(order.quantityOrdered), unit }),
                },
                { term: t("detail.design"), description: t(`detail.designOptions.${order.designOption}`) },
                ...(order.toleranceShortagePct && order.toleranceOveragePct
                  ? [
                      {
                        term: t("detail.toleranceTerms"),
                        description: (
                          <>
                            {t("detail.toleranceValue", {
                              shortage: format.percent(order.toleranceShortagePct, 1),
                              overage: format.percent(order.toleranceOveragePct, 1),
                            })}{" "}
                            <Link href="/guarantee" className="text-primary underline underline-offset-4">
                              {t("detail.guarantee")}
                            </Link>
                          </>
                        ),
                      },
                    ]
                  : []),
                ...(order.promisedShipDate
                  ? [{ term: t("detail.shipByTerm"), description: format.date(order.promisedShipDate) }]
                  : []),
                ...(order.estimatedDeliveryDate
                  ? [{ term: t("detail.arrivesByTerm"), description: format.date(order.estimatedDeliveryDate) }]
                  : []),
                ...(receipt.deliveredAt
                  ? [{ term: t("detail.deliveredTerm"), description: format.dateTime(receipt.deliveredAt) }]
                  : []),
                ...(receipt.completedAt
                  ? [
                      {
                        term: t("detail.completedTerm"),
                        description: t(
                          receipt.completionMode === "customer_confirmed"
                            ? "detail.completedByYou"
                            : "detail.completedAuto",
                          { date: format.dateTime(receipt.completedAt) },
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </section>
          <section aria-labelledby="order-price" className="border-border bg-surface rounded-card border px-5 py-5">
            <h2 id="order-price" className="text-base font-bold">
              {t("detail.price")}
            </h2>
            <PriceSummary
              className="mt-3"
              rows={[
                ...order.lines.map((line) => ({
                  label: pick(locale, line.descriptionTh, line.descriptionEn),
                  value: format.thb(line.grossAmount),
                })),
                ...(order.totals.discountAmount !== "0.00"
                  ? [
                      {
                        label: t("detail.discount"),
                        value: t("detail.minus", { amount: format.thb(order.totals.discountAmount) }),
                        tone: "discount" as const,
                      },
                    ]
                  : []),
                { label: t("detail.vat"), value: format.thb(order.totals.vatAmount), tone: "muted" as const },
              ]}
              total={{ label: t("detail.total"), value: format.thb(order.totals.grossAmount) }}
            />
          </section>
          <section aria-labelledby="order-delivery" className="border-border bg-surface rounded-card border px-5 py-5">
            <h2 id="order-delivery" className="text-base font-bold">
              {t("detail.deliveryTo")}
            </h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {order.destinations.map((destination) => (
                <li key={destination.id}>
                  <p className="font-medium">
                    {t("detail.destinationLine", {
                      name: destination.address.recipientName,
                      quantity: format.number(destination.quantity),
                      unit,
                    })}
                  </p>
                  <p className="text-muted">
                    {[
                      destination.address.line1,
                      destination.address.line2,
                      destination.address.subdistrictNameTh,
                      destination.address.districtNameTh,
                      destination.address.provinceNameTh,
                      destination.address.postcode,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </li>
              ))}
            </ul>
            {group?.poNumber ? (
              <p className="text-muted mt-3 text-xs">{t("detail.po", { po: group.poNumber })}</p>
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
