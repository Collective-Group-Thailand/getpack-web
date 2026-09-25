"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { POD_REVIEW_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
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

import { download, FormDialog, FormError, problemMessage, QueryError, Section, StatusChip, useCan } from "../console";
import type { CarrierQuote, Shipment } from "./resources";

type Dialog = { kind: "split" | "book" | "exception" | "pod"; key: string; decision?: "accept" | "reject" };

async function readShipment(shipmentId: string) {
  return browserRequests().read("GET /v1/admin/shipments/{shipmentId}", { path: { shipmentId } });
}

/**
 * One shipment (F2 2.8): where it goes, what is in it, every event, the POD with the tolerance
 * result the API computed (D-080), and the actions the desk takes — split, book a fallback
 * carrier (D-114), resolve an exception, review the POD that unlocks the factory's payout.
 */
export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations("logistics.shipment");
  const tList = useTranslations("logistics.shipments");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("shipments.manage");
  const key = queryKeys.detail("admin", "shipment", shipmentId);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [resolution, setResolution] = useState<"retry" | "return" | "cancel">("retry");

  const query = useQuery({ queryKey: key, queryFn: async () => (await readShipment(shipmentId)).data });
  const quotes = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/shipments/{shipmentId}/carrier-quotes", { path: { shipmentId } }),
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  const documents = useMutation({
    mutationFn: (kind: "labels" | "packing_list") =>
      browserRequests().call("POST /v1/admin/shipments/{shipmentId}/documents", {
        path: { shipmentId },
        body: { kind },
      }),
    onSuccess: (file) => download(file.url),
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const shipment = query.data;
  if (!shipment) return null;

  const settle = (updated: Shipment) => {
    queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "shipment") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const open = (kind: Dialog["kind"], decision?: Dialog["decision"]) => {
    setQuantity("");
    setReason("");
    setQuoteId("");
    setResolution("retry");
    setDialog({ kind, key: newIdempotencyKey(), decision });
    if (kind === "book") quotes.mutate();
  };
  const can = (action: Shipment["allowedActions"][number]) => shipment.allowedActions.includes(action);
  const tolerance = shipment.tolerance;

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
          order: shipment.order.orderCode,
          factory: shipment.factory.code,
          quantity: format.number(shipment.quantity),
          cartons: shipment.cartons,
        })}
        actions={
          <>
            <Button
              variant="ghost"
              iconStart="document"
              loading={documents.isPending && documents.variables === "packing_list"}
              onClick={() => documents.mutate("packing_list")}
            >
              {t("packingList")}
            </Button>
            <Button
              variant="secondary"
              iconStart="tag"
              loading={documents.isPending && documents.variables === "labels"}
              onClick={() => documents.mutate("labels")}
            >
              {t("labels")}
            </Button>
            {can("split") ? (
              <Button variant="secondary" onClick={() => open("split")}>
                {t("split")}
              </Button>
            ) : null}
            {can("book-carrier") ? <Button onClick={() => open("book")}>{t("book")}</Button> : null}
            {can("resolve-exception") ? <Button onClick={() => open("exception")}>{t("resolve")}</Button> : null}
          </>
        }
      />

      {shipment.blockedByPayment ? <Callout tone="warning" title={t("blockedByPayment")} /> : null}
      {shipment.exception ? <Callout tone="danger" title={shipment.exception} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          {shipment.pod ? (
            <Section
              title={
                <>
                  {t("pod")}
                  <StatusChip map={POD_REVIEW_STATUS} value={shipment.pod.review} />
                </>
              }
              description={t("podNote")}
              actions={
                canManage && shipment.pod.review === "pending" ? (
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
                  { term: t("receiver"), description: shipment.pod.receiverName },
                  { term: t("deliveredQuantity"), description: format.number(shipment.pod.deliveredQuantity) },
                  { term: t("capturedAt"), description: <When at={shipment.pod.capturedAt} /> },
                  { term: t("podKind"), description: t(`podKinds.${shipment.pod.kind}`) },
                  ...(shipment.pod.reviewedBy
                    ? [{ term: t("reviewedBy"), description: shipment.pod.reviewedBy.displayName }]
                    : []),
                  ...(shipment.pod.reviewNote ? [{ term: t("reviewNote"), description: shipment.pod.reviewNote }] : []),
                ]}
              />
              <ul className="mt-3 flex flex-wrap gap-2">
                {[...shipment.pod.photos, ...(shipment.pod.signature ? [shipment.pod.signature] : [])].map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary bg-surface-subtle flex h-16 w-24 items-center justify-center rounded-md border text-xs hover:underline"
                    >
                      {file.originalName}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {tolerance ? (
            <Section title={t("tolerance")} description={t("toleranceNote")}>
              <Callout
                tone={
                  tolerance.outcome === "exact" ? "success" : tolerance.outcome.endsWith("outside") ? "danger" : "info"
                }
                title={t(`outcomes.${tolerance.outcome}`, {
                  delivered: format.number(tolerance.delivered),
                  ordered: format.number(tolerance.ordered),
                })}
              >
                {t("toleranceBand", {
                  shortage: format.percent(tolerance.shortagePct),
                  overage: format.percent(tolerance.overagePct),
                })}
                {tolerance.claimId ? (
                  <>
                    {" · "}
                    <Link href={`/claims/${tolerance.claimId}`} className="text-primary hover:underline">
                      {t("openClaim")}
                    </Link>
                  </>
                ) : null}
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
                {[
                  shipment.destination.line1,
                  shipment.destination.line2,
                  shipment.destination.subdistrict,
                  shipment.destination.district,
                  shipment.destination.province,
                  shipment.destination.postcode,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </address>
          </Section>
          <Section title={t("contents")}>
            <ul className="text-sm">
              {shipment.items.map((item) => (
                <li key={`${item.orderId}-${item.destinationLabel}`} className="flex justify-between gap-2 py-1">
                  <Link href={`/orders/${item.orderId}`} className="text-primary font-mono hover:underline">
                    {item.orderCode}
                  </Link>
                  <span className="tabular-nums">{format.number(item.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted mt-2 text-xs">
              {t("cartons", {
                count: shipment.cartons,
                weight: shipment.weightG === null ? "–" : format.number(Math.round(shipment.weightG / 1000)),
              })}
            </p>
          </Section>
          {shipment.economics ? (
            <Section title={t("economics")} description={t("economicsNote")}>
              <DescriptionList
                items={[
                  { term: t("customerCharge"), description: format.thb(shipment.economics.customerCharge) },
                  { term: t("factoryPayout"), description: format.thb(shipment.economics.factoryPayout) },
                  { term: t("carrierCost"), description: format.thb(shipment.economics.carrierCost) },
                ]}
              />
            </Section>
          ) : null}
        </div>
      </div>

      {dialog?.kind === "split" ? (
        <FormDialog
          title={t("splitTitle")}
          description={t("splitBody", { no: shipment.shipmentNo, quantity: format.number(shipment.quantity) })}
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
              settle(result.shipment);
              toast.success(t("splitDone", { no: result.created.shipmentNo }));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          <Field
            label={t("splitQuantity")}
            hint={t("splitHint", { quantity: format.number(shipment.quantity) })}
            required
          >
            <NumberInput
              min={1}
              max={shipment.quantity - 1}
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
          description={t("bookBody", { no: shipment.shipmentNo, province: shipment.destination.province })}
          submitLabel={t("book")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!quoteId) throw new FormError(t("needQuote"));
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const { etag } = await readShipment(shipmentId);
              const updated = await browserRequests().call(
                "POST /v1/admin/shipments/{shipmentId}/actions/book-carrier",
                {
                  path: { shipmentId },
                  body: { quoteId, reason: reason.trim() },
                  etag: etag ?? undefined,
                  idempotencyKey: dialog.key,
                },
              );
              settle(updated);
              toast.success(t("booked", { tracking: updated.trackingNo ?? "" }));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          {quotes.isPending ? <p className="text-muted text-sm">{t("quoting")}</p> : null}
          {quotes.data ? (
            <RadioCards
              aria-label={t("quotes")}
              columns={1}
              value={quoteId}
              onValueChange={setQuoteId}
              options={quotes.data.map((quote: CarrierQuote) => ({
                value: quote.quoteId,
                label: `${tList(`carriers.${quote.carrier}`)} · ${quote.service}`,
                description: t("quote", { amount: format.thb(quote.amount), days: quote.etaDays }),
              }))}
            />
          ) : null}
          <Field label={t("reason")} hint={t("bookHint")} required>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
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
              const updated = await browserRequests().call(
                "POST /v1/admin/shipments/{shipmentId}/actions/resolve-exception",
                { path: { shipmentId }, body: { resolution, reason: reason.trim() }, etag: etag ?? undefined },
              );
              settle(updated);
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
            factory: shipment.factory.code,
          })}
          submitLabel={t(dialog.decision === "accept" ? "acceptPod" : "rejectPod")}
          destructive={dialog.decision === "reject"}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (dialog.decision === "reject" && reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const updated = await browserRequests().call(
                "POST /v1/admin/shipments/{shipmentId}/pod/actions/{decision}",
                {
                  path: { shipmentId, decision: dialog.decision! },
                  body: { note: reason.trim() || null },
                },
              );
              settle(updated);
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
