"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { adminShipmentActions } from "@/domain/next-actions/admin";
import { POD_REVIEW_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
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
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useActor,
  useCan,
} from "../console";
import { FileButton, FileList } from "./files";
import type { Shipment } from "./resources";
import { piecesOf } from "./ShipmentsList";

type Dialog = { kind: "split" | "book" | "exception" | "pod"; key: string; decision?: "accept" | "reject" };
type Carrier = Schemas["FallbackCarrier"];
type PodReview = "accepted" | "rejected" | "pending";

const FALLBACK_CARRIERS = ["flash_express", "deliveree"] as const satisfies readonly Carrier[];

async function readShipment(shipmentId: string) {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/shipments/{shipmentId}", {
    params: { path: { shipmentId } },
  });
  // CONTRACT-GAP admin.shipments — the shipment declares no ETag; one is passed on if it comes.
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
 * One shipment (F2 2.8): where it goes, what is in it, every event, the POD, the order's delivery
 * reconciliation (D-080), and the actions the desk takes — split, book a fallback carrier (D-114),
 * resolve an exception, review the POD that unlocks the factory's payout.
 *
 * Not on the published shipment (CONTRACT-GAP admin.shipments): `allowedActions` (offered from the
 * status, `adminShipmentActions`), the before-shipping payment hold (the API refuses a booking with
 * `shipments.payment_pending`), the carton list, the province and district of the destination, the
 * customer charge, the POD review state and file names.
 */
export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations("logistics.shipment");
  const tList = useTranslations("logistics.shipments");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  const key = queryKeys.detail("admin", "shipment", shipmentId);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [carrier, setCarrier] = useState<Carrier | "">("");
  const [resolution, setResolution] = useState<"retry" | "return" | "cancel">("retry");
  // The review answered in this session — the published shipment does not say (CONTRACT-GAP admin.shipments).
  const [podReview, setPodReview] = useState<PodReview | null>(null);

  const query = useQuery({ queryKey: key, queryFn: async () => (await readShipment(shipmentId)).shipment });
  const shipment = query.data;
  const itemOrders = useItemOrders(shipment);
  const firstOrderId = shipment?.items[0] ? itemOrders.get(shipment.items[0].jobId) : undefined;
  const reconciliation = useReconciliation(firstOrderId, shipment?.status === "delivered");
  const quotes = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/shipments/{shipmentId}/carrier-quotes", { path: { shipmentId } }),
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!shipment) return null;

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "shipment") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const open = (kind: Dialog["kind"], decision?: Dialog["decision"]) => {
    setQuantity("");
    setReason("");
    setCarrier("");
    setResolution("retry");
    setDialog({ kind, key: newIdempotencyKey(), decision });
    if (kind === "book") quotes.mutate();
  };
  const offered = new Set(
    adminShipmentActions(
      {
        status: shipment.status,
        carrier: shipment.carrier,
        hasPod: shipment.proofOfDelivery !== null,
        podReviewed: podReview !== null && podReview !== "pending",
      },
      (permission) => actor.permissions.includes(permission),
    ).map((action) => action.key),
  );
  const pieces = piecesOf(shipment);
  const orderCodes = [...new Set(shipment.items.map((item) => item.orderCode))];
  const pod = shipment.proofOfDelivery;
  const outcome = reconciliation.data?.outcome;
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
            {shipment.trackingNo ? <span className="text-muted font-mono text-sm">{shipment.trackingNo}</span> : null}
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
            {offered.has("shipment.split") ? (
              <Button variant="secondary" onClick={() => open("split")}>
                {t("split")}
              </Button>
            ) : null}
            {offered.has("shipment.book_carrier") ? <Button onClick={() => open("book")}>{t("book")}</Button> : null}
            {offered.has("shipment.resolve_exception") ? (
              <Button onClick={() => open("exception")}>{t("resolve")}</Button>
            ) : null}
          </>
        }
      />

      {shipment.note ? <Callout tone="warning" title={shipment.note} /> : null}
      {shipment.cancelReason ? <Callout tone="neutral" title={shipment.cancelReason} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          {pod ? (
            <Section
              title={
                <>
                  {t("pod")}
                  {podReview ? <StatusChip map={POD_REVIEW_STATUS} value={podReview} /> : null}
                </>
              }
              description={t("podNote")}
              actions={
                offered.has("shipment.accept_pod") ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => open("pod", "reject")}>
                      {t("rejectPod")}
                    </Button>
                    <Button size="sm" onClick={() => open("pod", "accept")}>
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
                {[shipment.destination.line1, shipment.destination.line2, shipment.destination.postcode]
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
                        <Link href={`/orders/${orderId}`} className="text-primary font-mono hover:underline">
                          {item.orderCode}
                        </Link>
                      ) : (
                        <span className="font-mono">{item.orderCode}</span>
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
          </Section>
          {costs.length > 0 ? (
            <Section title={t("economics")} description={t("economicsNote")}>
              <DescriptionList items={costs} />
            </Section>
          ) : null}
        </div>
      </div>

      {dialog?.kind === "split" ? (
        <FormDialog
          title={t("splitTitle")}
          description={t("splitBody", { no: shipment.shipmentNo, quantity: format.number(pieces) })}
          submitLabel={t("split")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!quantity || Number(quantity) <= 0) throw new FormError(t("needQuantity"));
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const { etag } = await readShipment(shipmentId);
              const result = await browserRequests().call("POST /v1/admin/shipments/{shipmentId}/actions/split", {
                path: { shipmentId },
                body: { quantity: Math.trunc(Number(quantity)), reason: reason.trim() },
                etag: etag ?? undefined,
                idempotencyKey: dialog.key,
              });
              settle();
              toast.success(t("splitDone", { no: result.created.shipmentNo }));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          <Field label={t("splitQuantity")} hint={t("splitHint", { quantity: format.number(pieces) })} required>
            <NumberInput
              min={1}
              max={pieces - 1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label={t("reason")} required>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog?.kind === "book" ? (
        <FormDialog
          title={t("bookTitle")}
          description={t("bookBody", { no: shipment.shipmentNo })}
          submitLabel={t("book")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!carrier) throw new FormError(t("needCarrier"));
            try {
              // admin.shipments.bookCarrier takes the carrier; its price at booking is Packio's cost
              // (D-114). No reason is recorded (CONTRACT-GAP admin.shipments).
              const updated = (
                await adminBrowserApis().contract.POST("/v1/admin/shipments/{shipmentId}/actions/book-carrier", {
                  params: { path: { shipmentId }, header: { "Idempotency-Key": dialog.key } },
                  body: { carrier },
                })
              ).data!;
              queryClient.setQueryData(key, updated);
              settle();
              toast.success(t("booked", { tracking: updated.trackingNo ?? "" }));
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
                label: quote ? `${tList(`carriers.${value}`)} · ${quote.service}` : tList(`carriers.${value}`),
                description: quote
                  ? t("quote", { amount: format.thb(quote.amount), days: quote.etaDays })
                  : t("pricedAtBooking"),
              };
            })}
          />
        </FormDialog>
      ) : null}

      {dialog?.kind === "exception" ? (
        <FormDialog
          title={t("resolveTitle")}
          description={t("resolveBody", { no: shipment.shipmentNo })}
          submitLabel={t("resolve")}
          destructive={resolution === "cancel"}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const { etag } = await readShipment(shipmentId);
              await browserRequests().call("POST /v1/admin/shipments/{shipmentId}/actions/resolve-exception", {
                path: { shipmentId },
                body: { resolution, reason: reason.trim() },
                etag: etag ?? undefined,
              });
              settle();
              toast.success(t("resolved"));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          <SegmentedControl
            label={t("resolution")}
            value={resolution}
            onValueChange={(value) => setResolution(value as typeof resolution)}
            options={(["retry", "return", "cancel"] as const).map((value) => ({
              value,
              label: t(`resolutions.${value}`),
            }))}
          />
          <Field label={t("reason")} required>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog?.kind === "pod" && dialog.decision ? (
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
            if (dialog.decision === "reject" && reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const reviewed = await browserRequests().call(
                "POST /v1/admin/shipments/{shipmentId}/pod/actions/{decision}",
                {
                  path: { shipmentId, decision: dialog.decision! },
                  body: { note: reason.trim() || null },
                },
              );
              setPodReview(reviewed.pod?.review ?? null);
              settle();
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
    </div>
  );
}
