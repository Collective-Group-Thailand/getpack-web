import { getLocale, getTranslations } from "next-intl/server";

import { CUSTOMER_ORDER_STAGE, ORDER_STAGES, type OrderStage } from "@/domain/status";
import { pick } from "@/features/customer/catalog/localize";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { OrderDetail } from "../api.server";
import { EvidencePhotos } from "./EvidencePhotos";

type Timeline = Schemas["TimelineEntryDto"][];

/** When a stage was done, from the API's timestamps (`OrderProgressDto`) and timeline. */
function doneAt(stage: OrderStage, detail: OrderDetail): string | null {
  const { progress, timeline, order } = detail;
  const first = (type: string) => timeline.find((entry) => entry.type === type)?.occurredAt ?? null;
  switch (stage) {
    case "payment":
      return progress?.paidForProductionAt ?? null;
    case "artwork":
      return first("artwork.submitted") ?? progress?.artworkApprovedAt ?? null;
    case "approval":
      return progress?.artworkApprovedAt ?? null;
    case "production":
      return progress?.shippedAt ? (progress.productionStartedAt ?? null) : null;
    case "delivery":
      return progress?.shippedAt ?? null;
    case "receipt":
      return order.receipt.deliveredAt ?? progress?.deliveredAt ?? null;
  }
}

const photosOf = (timeline: Timeline, types: string[]) =>
  timeline.filter((entry) => types.includes(entry.type)).flatMap((entry) => entry.photoFileIds);

/**
 * "ความคืบหน้า" of the order page (account pack Phase 3 item 2): the six stages — ชำระเงิน → ไฟล์งาน → อนุมัติแบบ →
 * ผลิต → จัดส่ง → รับของ — where the customer status puts them (`CUSTOMER_ORDER_STAGE`, the list's tracker), each with
 * its time and a plain sentence; under ผลิต the production steps (รับงาน → พิมพ์ → … from `progress.steps`) and the
 * photos the team shared; under จัดส่ง the shipment; under รับของ what arrived and the proof-of-delivery photo. A
 * cancelled order shows where it stopped. Times and words come from the API; nothing is estimated.
 */
export async function OrderJourney({ detail }: { detail: OrderDetail }) {
  const [t, format, locale] = await Promise.all([getTranslations("myOrders.detail.journey"), getFormat(), getLocale()]);
  const { order, progress, timeline, shipments } = detail;
  const current = CUSTOMER_ORDER_STAGE[order.customerStatus] ?? null;
  const cancelled = order.customerStatus === "cancelled";
  const overdue = order.payment.overdue;
  const shipment = shipments[0] ?? null;
  const outcome = order.toleranceOutcome;
  const productionPhotos = photosOf(timeline, ["production.milestone_reached"]);
  const deliveryPhotos = [
    ...photosOf(timeline, ["shipment.delivered"]),
    ...shipments.flatMap((entry) => entry.proofOfDelivery?.photoFileIds ?? []),
  ].filter((id, index, all) => all.indexOf(id) === index);

  return (
    <ol aria-label={t("label")} className="flex flex-col">
      {ORDER_STAGES.map((stage, index) => {
        const at = doneAt(stage, detail);
        const done = cancelled ? Boolean(at) : current !== null && (index < current || Boolean(at && index <= current));
        const now = !cancelled && current === index;
        const late = now && overdue && stage === "payment";
        const state = done ? "done" : now ? "now" : "todo";
        const last = index === ORDER_STAGES.length - 1;
        return (
          <li
            key={stage}
            aria-current={now ? "step" : undefined}
            className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-[1.125rem] last:pb-0"
          >
            {!last ? (
              <span
                aria-hidden="true"
                className={cn("absolute start-[0.9375rem] top-8 bottom-0.5 w-0.5", done ? "bg-primary" : "bg-border")}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "z-[1] grid size-8 place-items-center rounded-full border-2",
                done
                  ? "bg-primary border-primary text-primary-fg"
                  : late
                    ? "border-danger text-danger bg-surface"
                    : now
                      ? "border-primary text-primary bg-surface ring-primary-subtle ring-4"
                      : "border-border-strong bg-surface text-muted",
              )}
            >
              <Icon name={done ? "check" : late ? "clock" : "circle"} size={done ? 16 : 10} />
            </span>
            <div className="min-w-0 pt-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <b className="font-semibold">{t(`stages.${stage}`)}</b>
                <span className="sr-only">{t(`state.${state}`)}</span>
                {at && done ? (
                  <time dateTime={at} className="text-muted text-[0.78125rem] tabular-nums">
                    {format.dateTime(at)}
                  </time>
                ) : null}
              </p>
              <p className="text-muted mt-0.5 text-[0.84375rem]">{late ? t("overdue") : t(`text.${stage}.${state}`)}</p>

              {stage === "production" && progress && progress.steps.length > 0 ? (
                // Under "ผลิต", the production steps in the customer's words (D-440).
                <ol
                  aria-label={t("productionSteps")}
                  className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem]"
                >
                  {progress.steps.map((step, n) => (
                    <li key={step.key} className="flex items-center gap-1.5">
                      {n > 0 ? <Icon name="arrow-right" size={12} aria-hidden="true" className="text-muted" /> : null}
                      <span className={cn(step.status === "completed" ? "text-fg" : "text-muted")}>
                        {step.status === "completed" ? (
                          <Icon name="check" size={12} aria-hidden="true" className="text-primary me-0.5 inline" />
                        ) : null}
                        {pick(locale, step.labelTh, step.labelEn)}
                        {step.status === "completed" ? <span className="sr-only"> {t("state.done")}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {stage === "production" ? <EvidencePhotos fileIds={productionPhotos} kind="production" /> : null}

              {stage === "delivery" && shipment ? (
                <p className="text-muted mt-1 text-[0.8125rem] tabular-nums">
                  {[
                    shipment.shipmentNo,
                    t(`carrier.${shipment.carrier}`),
                    shipment.cartonsCount ? t("cartons", { count: shipment.cartonsCount }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}

              {stage === "receipt" && outcome && order.receipt.deliveredAt ? (
                <p className="text-muted mt-1 text-[0.8125rem]">
                  {t(outcome.creditAmount && outcome.creditAmount !== "0.00" ? "receivedCredit" : "received", {
                    received: format.number(outcome.deliveredQuantity),
                    ordered: format.number(outcome.orderedQuantity),
                    credit: outcome.creditAmount ? format.thb(outcome.creditAmount) : "",
                  })}
                </p>
              ) : null}
              {stage === "receipt" ? <EvidencePhotos fileIds={deliveryPhotos} kind="delivery" /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
