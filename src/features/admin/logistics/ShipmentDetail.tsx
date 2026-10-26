"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { POD_REVIEW_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Timeline } from "@/ui/components/Timeline";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  NextActionBar,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useCan,
} from "../console";
import { FileButton, FileList } from "./files";
import type { Shipment } from "./resources";
import { piecesOf } from "./ShipmentsList";
import { PodDialog, StatusDialog } from "./ShipmentUpdates";

type Verb = "split" | "book_carrier" | "resolve_exception" | "review_pod" | "cancel" | "update_status" | "record_pod";
type Dialog = { kind: Verb; key: string; decision?: "accept" | "reject" };
type Carrier = Schemas["FallbackCarrier"];
type Resolution = Schemas["ShipmentExceptionResolution"];

const SUPPORTED = new Set<string>([
  "split",
  "book_carrier",
  "resolve_exception",
  "review_pod",
  "cancel",
  "update_status",
  "record_pod",
]);
const FALLBACK_CARRIERS = ["flash_express", "deliveree"] as const satisfies readonly Carrier[];

async function readShipment(shipmentId: string) {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/shipments/{shipmentId}", {
    params: { path: { shipmentId } },
  });
  return { shipment: data!, etag: response.headers.get("ETag") };
}

/**
 * The orders a shipment carries. Its items name the order by code and the job by id, so each
 * order's id comes from its job (`admin.production.get`) — for the link and the delivery
 * reconciliation (CONTRACT-GAP admin.shipments: no order id on the item).
 */
function useItemOrders(shipment: Shipment | undefined) {
  const allowed = useCan("production.read");
  const jobIds = [...new Set((shipment?.items ?? []).map((item) => item.jobId))];
  const jobs = useQueries({
    queries: jobIds.map((jobId) => ({
      queryKey: queryKeys.detail("admin", "production_job", jobId),
      enabled: allowed,
      queryFn: async () =>
        (await adminBrowserApis().contract.GET("/v1/admin/production-jobs/{jobId}", { params: { path: { jobId } } }))
          .data!,
    })),
  });
  return new Map(jobs.flatMap((job) => (job.data ? [[job.data.id, job.data.orderId] as const] : [])));
}

/** Delivered against ordered for the order (`admin.shipments.reconciliation`, D-021, D-080); none until delivered. */
function useReconciliation(orderId: string | undefined, delivered: boolean) {
  return useQuery({
    queryKey: queryKeys.related("admin", "order", orderId ?? "", "delivery-reconciliation"),
    enabled: Boolean(orderId) && delivered,
    queryFn: async () => {
      try {
        return (
          await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/delivery-reconciliation", {
            params: { path: { orderId: orderId! } },
          })
        ).data!;
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
  });
}

/**
 * One shipment (F2 2.8, `admin.shipments.*`): where it goes, what is in it and its cartons, every
 * event, the POD and its review (D-229), the order's delivery reconciliation (D-080), a failed or
 * returned trip and its resolution (D-230), the before-shipping hold, the factory's carrier
 * request, and the actions the API offers on it (`nextActions`): split a draft, book a fallback
 * carrier from the carriers' quotes (D-114), resolve an exception, review the POD that unlocks the
 * factory's payout, cancel. Each action sends the ETag it read (`If-Match`).
 *
 * CONTRACT-GAP admin.shipments — no per-trip customer charge (left out by the API).
 */
export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations("logistics.shipment");
  const tList = useTranslations("logistics.shipments");
  const tStatus = useTranslations("status");
  const tProblems = useTranslations("problems");
  const format = useFormat();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const key = queryKeys.detail("admin", "shipment", shipmentId);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [cartons, setCartons] = useState("1");
  const [weight, setWeight] = useState("");
  const [reason, setReason] = useState("");
  const [carrier, setCarrier] = useState<Carrier | "">("");
  const [resolution, setResolution] = useState<Resolution>("retry");

  const query = useQuery({ queryKey: key, queryFn: () => readShipment(shipmentId) });
  const shipment = query.data?.shipment;
  const etag = query.data?.etag ?? undefined;
  const itemOrders = useItemOrders(shipment);
  const firstOrderId = shipment?.items[0] ? itemOrders.get(shipment.items[0].jobId) : undefined;
  const reconciliation = useReconciliation(firstOrderId, shipment?.status === "delivered");
  const quotes = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/shipments/{shipmentId}/carrier-quotes", {
          params: { path: { shipmentId } },
        })
      ).data!,
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!shipment) return null;

  const settle = (updated?: Shipment, nextEtag?: string | null) => {
    if (updated) queryClient.setQueryData(key, { shipment: updated, etag: nextEtag ?? null });
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "shipment") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const open = (kind: Verb, decision?: Dialog["decision"]) => {
    setQuantities({});
    setCartons("1");
    setWeight("");
    setReason("");
    setCarrier("");
    setResolution(shipment.status === "returned" ? "retry" : "retry");
    setDialog({ kind, key: newIdempotencyKey(), decision });
    if (kind === "book_carrier") quotes.mutate();
  };
  // A blocked action says why in words: its reason is a problem code when the API has one.
  const actions = shipment.nextActions.map((action) => ({
    ...action,
    disabledReason: action.disabledReason
      ? tProblems.has(action.disabledReason)
        ? tProblems(action.disabledReason)
        : action.disabledReason
      : null,
  }));
  const reviewable = actions.some((action) => action.key === "shipment.review_pod" && !action.disabledReason);
  const pieces = piecesOf(shipment);
  const orderCodes = [...new Set(shipment.items.map((item) => item.orderCode))];
  const pod = shipment.proofOfDelivery;
  const outcome = reconciliation.data?.outcome;
  const resolutions: Resolution[] = shipment.status === "returned" ? ["retry", "cancel"] : ["retry", "return"];
  const province = locale === "en" ? shipment.destination.province.nameEn : shipment.destination.province.nameTh;
  const costs = [
    ...(shipment.payoutAmount !== null
      ? [{ term: t("factoryPayout"), description: format.thb(shipment.payoutAmount) }]
      : []),
    ...(shipment.carrierCostAmount !== null
      ? [{ term: t("carrierCost"), description: format.thb(shipment.carrierCostAmount) }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("shipments"), href: "/shipments" }, { label: shipment.shipmentNo }]}
          />
        }
        title={shipment.shipmentNo}
        meta={
          <>
            <StatusChip map={SHIPMENT_STATUS} value={shipment.status} size="md" />
            <Badge tone={shipment.carrier === "factory_fleet" ? "neutral" : "info"}>
              {tList(`carriers.${shipment.carrier}`)}
            </Badge>
            {shipment.trackingNo ? (
              <span className="text-muted text-sm tabular-nums">{shipment.trackingNo}</span>
            ) : null}
          </>
        }
        description={t("summary", {
          order: orderCodes.join(", "),
          factory: shipment.factoryCode,
          quantity: format.number(pieces),
          cartons: shipment.cartonsCount,
        })}
        actions={
          <>
            <FileButton variant="ghost" iconStart="document" fileId={shipment.packingListFileId}>
              {t("packingList")}
            </FileButton>
            <FileButton variant="secondary" iconStart="tag" fileId={shipment.labelFileId}>
              {t("labels")}
            </FileButton>
            <NextActionBar
              actions={actions}
              supported={SUPPORTED}
              labelOf={(verb) => (t.has(`verbs.${verb}`) ? t(`verbs.${verb}`) : undefined)}
              onAction={(verb) => open(verb as Verb, verb === "review_pod" ? "accept" : undefined)}
            />
          </>
        }
      />

      {shipment.blockedByPayment ? (
        <Callout tone="warning" icon="hourglass" title={t("paymentHoldTitle")}>
          {t("paymentHoldBody")}
        </Callout>
      ) : null}
      {shipment.carrierRequest ? (
        <Callout tone="info" icon="route" title={t("carrierRequestTitle")}>
          {t("carrierRequestBody", {
            reason: shipment.carrierRequest.reason,
            at: format.dateTime(shipment.carrierRequest.requestedAt),
          })}
        </Callout>
      ) : null}
      {shipment.exception ? (
        <Callout
          tone={shipment.exception.resolution ? "neutral" : "danger"}
          title={tStatus(SHIPMENT_STATUS[shipment.exception.status].labelKey)}
        >
          {[
            shipment.exception.note,
            format.dateTime(shipment.exception.occurredAt),
            shipment.exception.resolution
              ? t("resolvedAs", {
                  resolution: t(`resolutions.${shipment.exception.resolution}`),
                  name: shipment.exception.resolvedBy?.displayName ?? "",
                  note: shipment.exception.resolutionNote ?? "",
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Callout>
      ) : shipment.note ? (
        <Callout tone="warning" title={shipment.note} />
      ) : null}
      {shipment.cancelReason ? <Callout tone="neutral" title={shipment.cancelReason} /> : null}
      {shipment.splitFrom ? (
        <p className="text-sm">
          {t("splitFromLabel")}{" "}
          <Link href={`/shipments/${shipment.splitFrom.id}`} className="text-primary tabular-nums hover:underline">
            {shipment.splitFrom.shipmentNo}
          </Link>
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          {pod ? (
            <Section
              title={
                <>
                  {t("pod")}
                  {shipment.podReview ? <StatusChip map={POD_REVIEW_STATUS} value={shipment.podReview.state} /> : null}
                </>
              }
              description={t("podNote")}
              actions={
                reviewable ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => open("review_pod", "reject")}>
                      {t("rejectPod")}
                    </Button>
                    <Button size="sm" onClick={() => open("review_pod", "accept")}>
                      {t("acceptPod")}
                    </Button>
                  </div>
                ) : null
              }
            >
              <DescriptionList
                columns={3}
                items={[
                  { term: t("receiver"), description: pod.receiverName },
                  { term: t("deliveredQuantity"), description: format.number(pod.deliveredQuantity) },
                  { term: t("capturedAt"), description: <When at={pod.capturedAt} /> },
                  { term: t("podKind"), description: t(`podKinds.${pod.kind}`) },
                  ...(pod.carrierPodRef ? [{ term: t("carrierPodRef"), description: pod.carrierPodRef }] : []),
                  ...(shipment.podReview?.reviewedBy
                    ? [
                        {
                          term: t("reviewedBy"),
                          description: [
                            shipment.podReview.reviewedBy.displayName,
                            shipment.podReview.reviewedAt ? format.dateTime(shipment.podReview.reviewedAt) : null,
                            shipment.podReview.note,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        },
                      ]
                    : []),
                ]}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FileList fileIds={pod.photoFileIds} label={t("podPhotos")} />
                <FileList
                  fileIds={pod.signatureFileId ? [pod.signatureFileId] : []}
                  label={t("podSignature")}
                  empty={t("noSignature")}
                />
              </div>
            </Section>
          ) : null}

          {reconciliation.data && outcome ? (
            <Section title={t("tolerance")} description={t("toleranceNote")}>
              <Callout
                tone={outcome === "exact" ? "success" : outcome.endsWith("outside") ? "danger" : "info"}
                title={t(`outcomes.${outcome}`, {
                  delivered: format.number(reconciliation.data.deliveredQuantity),
                  ordered: format.number(reconciliation.data.orderedQuantity),
                })}
              >
                {t("toleranceBand", {
                  shortage: format.percent(reconciliation.data.toleranceShortagePct),
                  overage: format.percent(reconciliation.data.toleranceOveragePct),
                })}
                {reconciliation.data.creditAmount
                  ? ` · ${t("credit", { amount: format.thb(reconciliation.data.creditAmount) })}`
                  : null}
              </Callout>
            </Section>
          ) : null}

          <Section title={t("events")}>
            <Timeline
              label={t("events")}
              items={[...shipment.events].reverse().map((event, at) => ({
                id: `${event.occurredAt}-${at}`,
                title: tStatus(SHIPMENT_STATUS[event.status].labelKey),
                time: <When at={event.occurredAt} />,
                actor: t(`sources.${event.source}`),
                description: [event.location, event.note].filter(Boolean).join(" · ") || undefined,
                icon: SHIPMENT_STATUS[event.status].icon,
                tone: event.status === "failed" ? "danger" : event.status === "delivered" ? "success" : "neutral",
              }))}
            />
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title={t("destination")}>
            <address className="text-sm not-italic">
              <p className="font-medium">{shipment.destination.recipientName}</p>
              <p>{shipment.destination.phone}</p>
              <p className="text-muted">
                {[shipment.destination.line1, shipment.destination.line2, province, shipment.destination.postcode]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </address>
          </Section>
          <Section title={t("contents")}>
            <ul className="text-sm">
              {shipment.items.map((item) => {
                const orderId = itemOrders.get(item.jobId);
                return (
                  <li key={`${item.jobId}-${item.destinationId}`} className="flex justify-between gap-2 py-1">
                    <span>
                      {orderId ? (
                        <Link href={`/orders/${orderId}`} className="text-primary tabular-nums hover:underline">
                          {item.orderCode}
                        </Link>
                      ) : (
                        <span className="tabular-nums">{item.orderCode}</span>
                      )}
                      <span className="text-muted block text-xs">{item.jobNo}</span>
                    </span>
                    <span className="text-end tabular-nums">
                      {format.number(item.quantity)}
                      {item.deliveredQuantity !== null ? (
                        <span className="text-muted block text-xs">
                          {t("deliveredOf", { quantity: format.number(item.deliveredQuantity) })}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted mt-2 text-xs">
              {t("cartons", {
                count: shipment.cartonsCount,
                weight: format.number(Math.round(shipment.weightG / 1000)),
              })}
            </p>
            {shipment.cartons.length ? (
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {shipment.cartons.map((carton) => (
                  <li key={carton.seq} className="flex justify-between gap-2">
                    <span className="tabular-nums">{carton.labelCode}</span>
                    {carton.weightG ? (
                      <span className="text-muted tabular-nums">
                        {t("cartonWeight", { kg: format.number(carton.weightG / 1000) })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
          {costs.length > 0 ? (
            <Section title={t("economics")} description={t("economicsNote")}>
              <DescriptionList items={costs} />
            </Section>
          ) : null}
        </div>
      </div>

      {dialog?.kind === "update_status" ? (
        <StatusDialog
          shipment={shipment}
          idempotencyKey={dialog.key}
          onClose={() => setDialog(null)}
          onDone={(updated, nextEtag) => {
            toast.success(t("statusUpdate.done"));
            settle(updated, nextEtag);
          }}
        />
      ) : null}
      {dialog?.kind === "record_pod" ? (
        <PodDialog
          shipment={shipment}
          idempotencyKey={dialog.key}
          onClose={() => setDialog(null)}
          onDone={(updated, nextEtag) => {
            toast.success(t("podRecord.done"));
            settle(updated, nextEtag);
          }}
        />
      ) : null}
      {dialog?.kind === "split" ? (
        <FormDialog
          title={t("splitTitle")}
          description={t("splitBody", { no: shipment.shipmentNo, quantity: format.number(pieces) })}
          submitLabel={t("verbs.split")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            const items = shipment.items
              .map((item) => ({
                destinationId: item.destinationId,
                quantity: Math.trunc(Number(quantities[item.destinationId])),
              }))
              .filter((item) => item.quantity > 0);
            if (items.length === 0) throw new FormError(t("needQuantity"));
            const grams = Math.round(Number(weight) * 1000);
            if (!(Number(cartons) >= 1) || !(grams >= 1)) throw new FormError(t("needCartons"));
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const { data, response } = await adminBrowserApis().contract.POST(
                "/v1/admin/shipments/{shipmentId}/actions/split",
                {
                  params: {
                    path: { shipmentId },
                    header: { "Idempotency-Key": dialog.key, ...(etag ? { "If-Match": etag } : {}) },
                  },
                  body: { items, cartonsCount: Math.trunc(Number(cartons)), weightG: grams, reason: reason.trim() },
                },
              );
              settle(data!.shipment, response.headers.get("ETag"));
              toast.success(t("splitDone", { no: data!.created.shipmentNo }));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          {shipment.items.map((item) => (
            <Field
              key={item.destinationId}
              label={shipment.items.length > 1 ? t("splitQuantityFor", { jobNo: item.jobNo }) : t("splitQuantity")}
              hint={t("splitHint", { quantity: format.number(item.quantity) })}
              required
            >
              <NumberInput
                min={1}
                max={item.quantity - 1}
                value={quantities[item.destinationId] ?? ""}
                onChange={(event) => setQuantities({ ...quantities, [item.destinationId]: event.target.value })}
              />
            </Field>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("splitCartons")} required>
              <NumberInput min={1} value={cartons} onChange={(event) => setCartons(event.target.value)} />
            </Field>
            <Field label={t("splitWeight")} required>
              <NumberInput min={0} value={weight} onChange={(event) => setWeight(event.target.value)} />
            </Field>
          </div>
          <Field label={t("reason")} required>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog?.kind === "book_carrier" ? (
        <FormDialog
          title={t("bookTitle")}
          description={t("bookBody", { no: shipment.shipmentNo })}
          submitLabel={t("verbs.book_carrier")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!carrier) throw new FormError(t("needCarrier"));
            try {
              // The carrier's price at booking is getpack's cost (D-114).
              const { data, response } = await adminBrowserApis().contract.POST(
                "/v1/admin/shipments/{shipmentId}/actions/book-carrier",
                {
                  params: {
                    path: { shipmentId },
                    header: { "Idempotency-Key": dialog.key, ...(etag ? { "If-Match": etag } : {}) },
                  },
                  body: { carrier, ...(reason.trim() ? { reason: reason.trim() } : {}) },
                },
              );
              settle(data!, response.headers.get("ETag"));
              toast.success(t("booked", { tracking: data!.trackingNo ?? "" }));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          {quotes.isPending ? <p className="text-muted text-sm">{t("quoting")}</p> : null}
          <RadioCards
            aria-label={t("quotes")}
            columns={1}
            value={carrier}
            onValueChange={(value) => setCarrier(value as Carrier)}
            options={FALLBACK_CARRIERS.map((value) => {
              const quote = quotes.data?.find((candidate) => candidate.carrier === value);
              return {
                value,
                label: tList(`carriers.${value}`),
                disabled: quote ? !quote.available : false,
                description: quote
                  ? !quote.available
                    ? (quote.reason ?? t("unavailable"))
                    : [
                        quote.amount ? format.thb(quote.amount) : t("pricedAtBooking"),
                        quote.transitDays !== null ? t("transitDays", { days: quote.transitDays }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                  : t("pricedAtBooking"),
              };
            })}
          />
          <Field label={t("bookReason")} hint={t("optional")}>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog?.kind === "resolve_exception" ? (
        <FormDialog
          title={t("resolveTitle")}
          description={t("resolveBody", { no: shipment.shipmentNo })}
          submitLabel={t("verbs.resolve_exception")}
          destructive={resolution === "cancel"}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const { data, response } = await adminBrowserApis().contract.POST(
                "/v1/admin/shipments/{shipmentId}/actions/resolve-exception",
                {
                  params: {
                    path: { shipmentId },
                    header: { "Idempotency-Key": dialog.key, ...(etag ? { "If-Match": etag } : {}) },
                  },
                  body: { resolution, reason: reason.trim() },
                },
              );
              settle(data!, response.headers.get("ETag"));
              toast.success(t("resolved"));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          <SegmentedControl
            label={t("resolution")}
            value={resolution}
            onValueChange={(value) => setResolution(value as Resolution)}
            options={resolutions.map((value) => ({ value, label: t(`resolutions.${value}`) }))}
          />
          <Field label={t("reason")} required>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog?.kind === "review_pod" && dialog.decision ? (
        <FormDialog
          title={t(dialog.decision === "accept" ? "acceptTitle" : "rejectTitle")}
          description={t(dialog.decision === "accept" ? "acceptBody" : "rejectBody", {
            no: shipment.shipmentNo,
            factory: shipment.factoryCode,
          })}
          submitLabel={t(dialog.decision === "accept" ? "acceptPod" : "rejectPod")}
          destructive={dialog.decision === "reject"}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            // D-229: a rejection says why; the factory sees it.
            if (dialog.decision === "reject" && reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const { data, response } = await adminBrowserApis().contract.POST(
                "/v1/admin/shipments/{shipmentId}/pod/actions/{decision}",
                {
                  params: {
                    path: { shipmentId, decision: dialog.decision! },
                    header: etag ? { "If-Match": etag } : {},
                  },
                  body: reason.trim() ? { note: reason.trim() } : {},
                },
              );
              settle(data!, response.headers.get("ETag"));
              toast.success(t(dialog.decision === "accept" ? "podAccepted" : "podRejected"));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          <Field label={t("reviewNote")} hint={dialog.decision === "reject" ? t("rejectHint") : t("optional")}>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      <ConfirmAction
        open={dialog?.kind === "cancel"}
        onOpenChange={(next) => (next ? undefined : setDialog(null))}
        tone="destructive"
        title={t("cancelTitle", { no: shipment.shipmentNo })}
        description={t("cancelBody", { no: shipment.shipmentNo, factory: shipment.factoryCode })}
        confirmLabel={t("verbs.cancel")}
        confirmationPhrase={shipment.shipmentNo}
        reason={{ label: t("reason"), required: true, minLength: 3 }}
        onConfirm={async ({ idempotencyKey, reason: why }) => {
          try {
            const { data, response } = await adminBrowserApis().contract.POST(
              "/v1/admin/shipments/{shipmentId}/actions/cancel",
              {
                params: { path: { shipmentId }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason: why },
              },
            );
            settle(data!, response.headers.get("ETag"));
            toast.success(t("cancelled", { no: shipment.shipmentNo }));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
