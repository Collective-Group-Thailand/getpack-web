import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { pick } from "@/features/customer/catalog/localize";
import { PayInstalmentButton } from "@/features/customer/checkout/PayInstalmentButton";
import { ShipmentCard } from "@/features/customer/fulfilment/ShipmentCard";
import { AskAbout } from "@/features/customer/messages/StartThread";
import { findLockedDesignOf, getMyOrder } from "@/features/customer/orders/api.server";
import { OrderJourney } from "@/features/customer/orders/detail/OrderJourney";
import { OrderViewTracker, TrackClicks } from "@/features/customer/orders/detail/OrderTracking";
import { DocumentLink } from "@/features/customer/orders/DocumentLink";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import {
  artworkNoteOf,
  artworkNoteTextOf,
  deliveryDatesOf,
  isHeldByClaim,
  isPaymentOverdue,
  paymentShareOf,
  showAutoComplete,
  visibleActions,
} from "@/features/customer/orders/order-state";
import { RequoteButton } from "@/features/customer/orders/RequoteButton";
import { SpecSheet } from "@/features/customer/orders/SpecSheet";
import { productNameOf, specLinesOf } from "@/features/customer/orders/summary";
import { timelineTitle } from "@/features/customer/orders/timeline";
import { TrackingLinkButton } from "@/features/customer/orders/TrackingLinkButton";
import { listMySamples } from "@/features/customer/samples/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import {
  ARTWORK_STATUS,
  CLAIM_STATUS,
  CUSTOMER_ORDER_STATUS,
  DOCUMENT_STATUS,
  INSTALMENT_STATUS,
  SAMPLE_STATUS,
} from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PriceSummary } from "@/ui/components/PriceSummary";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Timeline } from "@/ui/components/Timeline";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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
  "production.milestone_reached": "layers",
  "shipment.picked_up": "truck",
  "shipment.delivered": "package-check",
  "order.receipt_confirmed": "check",
  "order.cancelled": "ban",
};

const SUCCESS = new Set(["payment.received", "proof.approved", "shipment.delivered", "order.receipt_confirmed"]);

/** One panel of the order page: a rounded card with its heading. */
function Box({
  id,
  title,
  aside,
  children,
  className,
}: {
  id: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "border-border bg-surface rounded-panel flex scroll-mt-28 flex-col gap-3.5 border p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <h2 id={`${id}-title`} className="text-[1.0625rem] font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * One order as the customer sees it (account pack Phase 3): the status, product, code, date, quantity and payment
 * group with the action of the moment; then its progress — six stages with times, the production steps and the
 * photos the team shared, the shipment and what arrived — the claim, the spec and design, the payment (VAT
 * included, instalments, this order's share against the group, "ตรวจราคาใหม่และชำระ" past the deadline, D-436),
 * the documents issued by getpack, reordering and the messages about it. Every figure and date is the API's
 * (`getMyOrder`); nothing here computes.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ payment?: string; requote?: string }>;
}) {
  await requireCustomer();
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const [t, tList, tCatalog, format, locale, detail, design, samples] = await Promise.all([
    getTranslations("myOrders"),
    getTranslations("myOrders.list"),
    getTranslations("catalog"),
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
  // D-436: past the deadline the customer re-quotes before paying, so no pay button until then.
  const overdue = isPaymentOverdue(order);
  const due = instalments.find((instalment) => instalment.payable) ?? null;
  const payable = due && !overdue ? payableOf(due) : null;
  const actions = visibleActions(order, detail.actions);
  const reorder = actions.find((action) => action.key === "order.reorder" && !action.disabledReason);
  const headerActions = actions.filter((action) => action.key !== "order.reorder");
  const share = paymentShareOf(order);
  const heldByClaim = isHeldByClaim(order);
  const artworkNote = artworkNoteOf(order);
  const artworkApiNote = artworkNoteTextOf(locale, order);
  const afterPayment = deliveryDatesOf(order) === "after_payment";
  const { receipt } = order;
  const cancelReason = order.cancelReasonNameTh
    ? pick(locale, order.cancelReasonNameTh, order.cancelReasonNameEn)
    : null;
  const placedAt = group?.placedAt ?? order.createdAt;
  const claimOpenUntil =
    receipt.claimWindowEndsAt && !heldByClaim && actions.some((action) => action.key === "order.open_claim")
      ? receipt.claimWindowEndsAt
      : null;

  const history = detail.timeline
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
      description: entry.photoFileIds.length > 0 ? t("detail.photos", { count: entry.photoFileIds.length }) : undefined,
    }));

  return (
    <div className="flex flex-col gap-5">
      <OrderViewTracker status={order.customerStatus} />
      <div>
        <Link
          href="/account/orders"
          className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
        >
          <Icon name="arrow-left" size={16} aria-hidden="true" />
          {t("detail.back")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* One status (D-437): the API's `customerStatus`. */}
            <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
            {overdue ? (
              <Badge size="sm" tone="danger" icon="clock">
                {t("detail.overdue.badge")}
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-1.5 text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] font-bold tracking-[-0.02em]">{name}</h1>
          <p className="text-muted mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.84375rem]">
            <span className="text-fg/80 tabular-nums">{order.orderCode}</span>
            <span>{tList("placedOn", { date: format.date(placedAt) })}</span>
            <span className="tabular-nums">
              {t("detail.quantityUnit", { quantity: format.number(order.quantityOrdered), unit })}
            </span>
            {share.shared ? (
              <span className="tabular-nums">{t("detail.head.group", { code: share.groupCode })}</span>
            ) : null}
          </p>
        </div>
        {headerActions.length > 0 || payable || overdue || reorder ? (
          <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto">
            {overdue ? (
              <RequoteButton
                groupId={order.payment.groupId}
                payHref={`/account/orders/${order.id}#payment`}
                autoOpen={query.requote === "1"}
              />
            ) : null}
            {headerActions.length > 0 || payable ? (
              <OrderActions orderId={order.id} orderCode={order.orderCode} actions={headerActions} payable={payable} />
            ) : null}
            {reorder ? (
              <TrackClicks event="order_reorder" properties={{ status: order.customerStatus }}>
                <OrderActions
                  orderId={order.id}
                  orderCode={order.orderCode}
                  actions={[reorder]}
                  // The reorder leads only when nothing else is asked of the customer.
                  size="md"
                />
              </TrackClicks>
            ) : null}
          </div>
        ) : null}
      </header>

      {query.payment === "not_started" && payable ? (
        // Checkout placed the order but could not start its payment (round 2, B1).
        <Callout tone="warning" live title={t("detail.paymentNotStarted.title")}>
          {t("detail.paymentNotStarted.body")}
        </Callout>
      ) : null}
      {group?.status === "pending_company_approval" ? (
        // CONTRACT-REQUEST store.order-group-company-approval — the group does not name its approvers yet.
        <Callout tone="info" icon="stamp" title={t("detail.companyApproval.title")}>
          {t("detail.companyApproval.body", { date: format.dateTime(group.placedAt) })}
        </Callout>
      ) : null}
      {overdue ? (
        // D-436: never cancelled for being late — the customer re-quotes, then pays.
        <Callout
          tone="warning"
          icon="clock"
          title={t("detail.overdue.title", { date: format.dateTime(order.payment.dueAt ?? placedAt) })}
        >
          {t("detail.overdue.body")}
        </Callout>
      ) : null}
      {order.cancelledAt ? (
        <Callout tone="neutral" title={t("detail.cancelled", { date: format.date(order.cancelledAt) })}>
          {cancelReason ? t("detail.cancelReason", { reason: cancelReason }) : null}
        </Callout>
      ) : null}
      {showAutoComplete(order) ? (
        <Callout tone="info">
          {t("detail.autoComplete", {
            date: format.date(receipt.autoCompleteAt),
            claim: format.date(receipt.claimWindowEndsAt),
          })}
        </Callout>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21.25rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Box id="progress" title={t("detail.timeline")}>
            <OrderJourney detail={detail} />
            {/* Who has the artwork step and what happens next (D-438): "ส่งไฟล์งาน" only when it is the customer's. */}
            {order.artworkOwner !== null && !order.cancelledAt ? (
              <p className="bg-bg-subtle flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-[0.84375rem]">
                <span className="text-muted">{t("detail.artworkStep")}</span>
                <StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} />
                {artworkNote ? (
                  <span className="text-muted">
                    {t(`detail.artworkNote.${artworkNote === "team_dieline" ? "team" : "customer"}`)}
                  </span>
                ) : null}
                {artworkApiNote ? <span className="text-muted">{artworkApiNote}</span> : null}
              </p>
            ) : null}
            {history.length > 0 ? (
              <details className="group border-border border-t pt-3">
                <summary className="text-primary cursor-pointer list-none text-sm font-medium underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">{t("detail.history.show", { count: history.length })}</span>
                  <span className="hidden group-open:inline">{t("detail.history.hide")}</span>
                </summary>
                <Timeline className="mt-4" label={t("detail.history.label")} items={history} />
              </details>
            ) : null}
          </Box>

          {detail.claims.map((claim) => {
            const credit = claim.resolutions.find(
              (resolution) =>
                resolution.amount && (resolution.action === "credit_note" || resolution.action === "store_credit"),
            );
            const creditNote = detail.documents.find((document) => document.docType === "cn");
            const open = order.openClaims.some((entry) => entry.id === claim.id);
            return (
              <Box
                key={claim.id}
                id={`claim-${claim.id}`}
                className={open ? "border-warning" : undefined}
                title={<span className="tabular-nums">{t("detail.claim.title", { claim: claim.claimNo })}</span>}
                aside={<StatusChip map={CLAIM_STATUS} value={claim.status} />}
              >
                <DescriptionList
                  items={[
                    { term: t("detail.claim.submitted"), description: format.dateTime(claim.submittedAt) },
                    { term: t("detail.claim.type"), description: t(`claimTypes.${claim.type}`) },
                    ...(order.toleranceOutcome
                      ? [
                          {
                            term: t("detail.claim.received"),
                            description: t("detail.claim.receivedValue", {
                              received: format.number(order.toleranceOutcome.deliveredQuantity),
                              ordered: format.number(order.toleranceOutcome.orderedQuantity),
                              unit,
                            }),
                          },
                        ]
                      : []),
                    ...(credit?.amount
                      ? [
                          {
                            term: t("detail.claim.credit"),
                            description: creditNote
                              ? t("detail.claim.creditWithNote", {
                                  amount: format.thb(credit.amount),
                                  note: creditNote.docNumber,
                                })
                              : format.thb(credit.amount),
                          },
                        ]
                      : []),
                  ]}
                />
                {open ? (
                  <p className="bg-bg-subtle flex gap-2.5 rounded-xl p-3 text-[0.84375rem]">
                    <Icon name="flag" size={18} aria-hidden="true" className="text-muted mt-0.5 shrink-0" />
                    {t("detail.claim.howResults")}
                  </p>
                ) : null}
                <TrackClicks
                  event="order_claim_add"
                  properties={{ status: claim.status }}
                  className="flex flex-wrap gap-2"
                >
                  <Button asChild variant="secondary" size="sm" iconStart={open ? "plus" : "eye"}>
                    <Link href={`/account/orders/${order.id}/claims/${claim.id}`}>
                      {open ? t("detail.claim.add") : t("detail.claim.view")}
                    </Link>
                  </Button>
                </TrackClicks>
              </Box>
            );
          })}

          {detail.shipments.length > 0 ? (
            <Box id="shipments" title={t("detail.shipments")}>
              <div className="flex flex-col gap-3">
                {detail.shipments.map((shipment) => (
                  <ShipmentCard key={shipment.id} shipment={shipment} orderCode={order.orderCode} />
                ))}
              </div>
              {claimOpenUntil ? (
                <p className="text-muted text-[0.84375rem]">
                  {t("detail.claimWindow", { date: format.date(claimOpenUntil) })}
                </p>
              ) : null}
              <p className="text-sm">
                <TrackingLinkButton orderId={order.id} />
              </p>
            </Box>
          ) : null}

          <Box id="spec" title={t("detail.spec.title")}>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
              <ProductThumb
                family={productFamilyOf(order.summary.productTypeCode)}
                className="h-[5.5rem] w-full rounded-xl sm:h-[6.875rem]"
              />
              <DescriptionList
                items={[
                  ...specLinesOf(locale, order.summary),
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
                  // D-439: an unpaid order's dates are the plan made at placement and may be past — say so instead.
                  ...(afterPayment
                    ? [{ term: t("detail.shipByTerm"), description: t("detail.afterPayment") }]
                    : [
                        ...(order.promisedShipDate && !receipt.deliveredAt
                          ? [{ term: t("detail.shipByTerm"), description: format.date(order.promisedShipDate) }]
                          : []),
                        ...(order.estimatedDeliveryDate && !receipt.deliveredAt
                          ? [{ term: t("detail.arrivesByTerm"), description: format.date(order.estimatedDeliveryDate) }]
                          : []),
                      ]),
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
            </div>
            <div className="flex flex-wrap gap-2">
              {design ? (
                <Button asChild variant="secondary" size="sm" iconStart="palette">
                  <Link href={`/studio/${design.designId}?step=design`}>
                    {t("detail.spec.design", { title: design.title, versionNo: design.versionNo })}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary" size="sm" iconStart="images">
                <Link href={`/account/orders/${order.id}/artwork`}>{t("detail.artworkLink")}</Link>
              </Button>
            </div>
            {/* The spec document (TH / EN, view + PDF) once the artwork is approved. */}
            {order.artworkStatus === "approved" ? <SpecSheet orderId={order.id} /> : null}
          </Box>

          {samples.length > 0 ? (
            <Box id="samples" title={t("detail.samples")}>
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
            </Box>
          ) : null}

          <Box id="messages" title={t("detail.messages.title")}>
            <p className="text-muted text-[0.84375rem]">{t("detail.messages.body")}</p>
            <TrackClicks event="order_message_send" properties={{ status: order.customerStatus }}>
              <AskAbout subject={{ type: "order", id: order.id, label: order.orderCode }} variant="secondary" />
            </TrackClicks>
          </Box>
        </div>

        <aside aria-label={t("detail.asideLabel")} className="flex min-w-0 flex-col gap-4">
          <Box id="payment" title={t("detail.paymentShare.title")}>
            <PriceSummary
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
            {share.shared ? (
              <div className="bg-bg-subtle rounded-xl p-3 text-[0.8125rem]">
                <DescriptionList
                  items={[
                    { term: t("detail.paymentShare.thisOrder"), description: format.thb(share.orderGross) },
                    { term: t("detail.paymentShare.group"), description: format.thb(share.groupGross) },
                  ]}
                />
                <p className="text-muted mt-1.5 text-xs">
                  {t("detail.paymentShare.groupNote", { code: share.groupCode, count: share.groupOrderCount })}
                </p>
              </div>
            ) : null}
            {order.payment.dueAt && order.customerStatus === "awaiting_payment" ? (
              <p className={cn("text-[0.84375rem]", overdue ? "text-danger font-semibold" : "text-muted")}>
                {overdue
                  ? t("detail.paymentShare.overdue", { date: format.dateTime(order.payment.dueAt) })
                  : t("detail.paymentShare.due", { date: format.dateTime(order.payment.dueAt) })}
              </p>
            ) : null}
            {instalments.length > 0 ? (
              <ul aria-label={t("detail.instalments")} className="flex flex-col gap-2">
                {instalments.map((instalment) => {
                  const dueNow = instalment.status === "due" || instalment.status === "overdue";
                  return (
                    <li
                      key={instalment.id}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 rounded-xl border px-3 py-2.5 text-[0.84375rem]",
                        dueNow && !overdue ? "border-danger bg-danger-subtle/40" : "border-border",
                      )}
                    >
                      <span className="font-semibold">{pick(locale, instalment.labelTh, instalment.labelEn)}</span>
                      <span className="text-end font-bold tabular-nums">{format.thb(instalment.grossAmount)}</span>
                      <span className="text-muted text-xs">
                        {instalment.dueAt
                          ? t("detail.dueBy", { date: format.date(instalment.dueAt) })
                          : t(`detail.trigger.${instalment.requiredBefore}`)}
                      </span>
                      <span className="justify-self-end">
                        <StatusChip map={INSTALMENT_STATUS} value={instalment.status} />
                      </span>
                      {instalment.payable && !overdue ? (
                        <PayInstalmentButton
                          size="sm"
                          className="col-span-2 mt-1 w-full"
                          variant={dueNow || instalment.activePaymentId ? "primary" : "secondary"}
                          instalment={payableOf(instalment)}
                          orderCode={order.orderCode}
                        >
                          {instalment.activePaymentId
                            ? t("detail.continuePay")
                            : dueNow
                              ? t("detail.pay")
                              : t("detail.payEarly")}
                          <span className="sr-only"> {pick(locale, instalment.labelTh, instalment.labelEn)}</span>
                        </PayInstalmentButton>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {overdue ? (
              <RequoteButton
                className="w-full"
                groupId={order.payment.groupId}
                payHref={`/account/orders/${order.id}#payment`}
              />
            ) : null}
          </Box>

          <Box id="documents" title={t("detail.documents")}>
            {detail.documents.length === 0 ? (
              <p className="text-muted text-sm">{t("detail.noDocuments")}</p>
            ) : (
              <ul className="divide-border flex flex-col divide-y">
                {detail.documents.map((document) => (
                  <li
                    key={document.id}
                    className="grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-2.5 gap-y-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="bg-bg-subtle text-muted rounded-control grid size-[2.125rem] place-items-center">
                      <Icon name="document" size={17} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 text-[0.84375rem]">
                      <p className="font-semibold">
                        {t(`documents.types.${document.docType}`)}
                        {document.docKind === "final" ? ` · ${t("documents.final")}` : ""}
                      </p>
                      <p className="text-muted text-xs tabular-nums">
                        {document.docNumber} · {format.thb(document.grossAmount)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {document.status !== "issued" ? (
                          <StatusChip map={DOCUMENT_STATUS} value={document.status} />
                        ) : null}
                        {document.pdfReady ? (
                          <DocumentLink
                            documentId={document.id}
                            number={document.docNumber}
                            docType={document.docType}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/account/documents"
              className="text-primary text-[0.84375rem] underline-offset-4 hover:underline"
            >
              {t("detail.allDocuments")}
            </Link>
          </Box>

          {reorder ? (
            <Box id="reorder" title={t("detail.reorder.title")}>
              <p className="text-muted text-[0.84375rem]">{t("detail.reorder.body")}</p>
              <TrackClicks event="order_reorder" properties={{ status: order.customerStatus }}>
                <Button asChild className="w-full" iconStart="refresh">
                  <Link href={`/account/orders/${order.id}/reorder`}>
                    {t("detail.reorder.action", { quantity: format.number(order.quantityOrdered) })}
                  </Link>
                </Button>
              </TrackClicks>
            </Box>
          ) : null}

          <Box id="delivery" title={t("detail.deliveryTo")}>
            <ul className="flex flex-col gap-2 text-sm">
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
            {group?.poNumber ? <p className="text-muted text-xs">{t("detail.po", { po: group.poNumber })}</p> : null}
          </Box>
        </aside>
      </div>
    </div>
  );
}
