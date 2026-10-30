import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SHIPMENT_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { CreateShipment } from "@/features/partner/ship/actions";
import { codeOf, placeOf, shipmentCodeOf } from "@/features/partner/ship/destination";
import { WaybillBadge } from "@/features/partner/ship/WaybillBadge";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Meter } from "@/ui/components/Meter";
import { Icon } from "@/ui/icons";

/** `partner.shipments.list?view`, and everything. */
const VIEWS = ["open", "in_transit", "delivered", "exceptions", "all"] as const;
type View = (typeof VIEWS)[number];
type Props = { searchParams: Promise<{ view?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerShip"))("title") };
}

/**
 * Shipping (F5 5.2, `partner.shipments.*`): finished jobs with what each destination still needs
 * — a trip per destination, several for a split (D-110) — and the factory's trips by stage, each
 * to its labels, dispatch and proof of delivery (D-013).
 *
 * CONTRACT-GAP partner.shipments — the ship plan names a job by number and order code only (no
 * title, product type or promised date), and a destination by name, province and postcode.
 */
export default async function ShipPage({ searchParams }: Props) {
  const query = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(query.view ?? "") ? (query.view as View) : "open";
  const [t, tDest, tJobs, format] = await Promise.all([
    getTranslations("partnerShip"),
    getTranslations("partnerShip.destination"),
    getTranslations("partnerJobs"),
    getFormat(),
  ]);
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const [plan, list, every] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/ship-plan", {
            params: { path: { factoryId: context.factoryId } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/shipments", {
            params: {
              query: {
                perPage: 50,
                ...(view === "all" ? {} : { view: view satisfies Schemas["PartnerShipmentView"] }),
              },
            },
          })
        ).data!,
    ),
    // Today at a glance (round 2, Phase 1): what waits at the gate, what is on the road, which POD is due.
    attempt(async () => (await contract.GET("/v1/partner/shipments", { params: { query: { perPage: 100 } } })).data!),
  ]);
  // Each tab's count, read for its total only.
  const counts = Object.fromEntries(
    await Promise.all(
      VIEWS.map((key) =>
        attempt(
          async () =>
            (
              await contract.GET("/v1/partner/shipments", {
                params: {
                  query: {
                    perPage: 1,
                    ...(key === "all" ? {} : { view: key satisfies Schemas["PartnerShipmentView"] }),
                  },
                },
              })
            ).data!.meta.total,
        ).then((result) => [key, result.data ?? null] as const),
      ),
    ),
  ) as Record<View, number | null>;
  const manage = canAt(context, "factory_shipments.manage");
  const waybillLabels = { issued: t("waybill.issued"), pending: t("waybill.pending") };
  const trips = every.data?.data ?? [];
  const moving = ["picked_up", "in_transit", "out_for_delivery"];
  const glance = {
    gate: trips.filter((trip) => trip.status === "ready").length,
    road: trips.filter((trip) => moving.includes(trip.status)).length,
    pod: trips.filter(
      (trip) => trip.carrier === "factory_fleet" && !trip.proofOfDelivery && moving.includes(trip.status),
    ).length,
  };
  // A job every destination of which has had all its pieces sent is done here (round 2, B3): the
  // plan still lists it, with nothing left to create.
  const waiting = plan.data?.filter((job) => job.destinations.some((destination) => destination.remainingQuantity > 0));

  // A delivery by the factory's own fleet is not done until its proof of delivery is in.
  const podDue = (shipment: { carrier: string; proofOfDelivery: unknown; status: string }) =>
    shipment.carrier === "factory_fleet" &&
    !shipment.proofOfDelivery &&
    ["picked_up", "in_transit", "out_for_delivery"].includes(shipment.status);

  const planSection = waiting?.length ? (
    <PartnerSection id="plan" title={t("plan.title")} description={t("plan.body")}>
      <ul className="flex flex-col gap-4">
        {waiting.map((job) => (
          <li key={job.jobId} id={`job-${job.jobId}`} className="scroll-mt-20">
            <article className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 md:p-5">
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/jobs/${job.jobId}`}
                    className="text-lg font-semibold tabular-nums underline-offset-4 hover:underline"
                  >
                    {job.jobNo}
                  </Link>
                  <span className="text-muted text-sm tabular-nums">{job.orderCode}</span>
                </span>
                <span className="text-sm tabular-nums">
                  {job.quantityGood !== null
                    ? t("plan.meta", {
                        good: format.number(job.quantityGood),
                        ordered: format.number(job.quantityOrdered),
                      })
                    : t("plan.metaOrdered", { ordered: format.number(job.quantityOrdered) })}
                </span>
              </header>
              {job.blockedReason ? (
                <Callout tone="warning" icon="warning">
                  {t(`plan.blocked.${job.blockedReason}`)}
                </Callout>
              ) : null}
              {/* One tile per destination still to send: its code, where it goes, how many are left, the trip to create. */}
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {job.destinations
                  // The code is the destination's place in the job's list (P4-01), counted before filtering.
                  .map((destination, index) => ({ destination, code: codeOf(destination, index)! }))
                  .filter(({ destination }) => destination.remainingQuantity > 0)
                  .map(({ destination, code }) => {
                    const sent = destination.quantity - destination.remainingQuantity;
                    return (
                      <li
                        key={destination.destinationId}
                        className="border-border bg-surface rounded-control flex flex-col gap-3 border p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="bg-surface-subtle border-border-strong grid size-11 shrink-0 place-items-center rounded-lg border text-base font-semibold"
                          >
                            {code}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">{tDest("code", { code })}</span>
                            <span className="text-muted block text-sm">
                              {placeOf(destination.provinceNameTh, destination)}
                            </span>
                          </span>
                        </div>
                        <p className="-mb-1 text-sm font-medium tabular-nums">
                          {t("plan.left", {
                            left: format.number(destination.remainingQuantity),
                            total: format.number(destination.quantity),
                          })}
                        </p>
                        <Meter
                          label={t("plan.left", {
                            left: format.number(destination.remainingQuantity),
                            total: format.number(destination.quantity),
                          })}
                          value={destination.quantity ? (sent / destination.quantity) * 100 : 0}
                          valueText={t("plan.left", {
                            left: format.number(destination.remainingQuantity),
                            total: format.number(destination.quantity),
                          })}
                        />
                        {manage && job.blockedReason !== "inspection_pending" ? (
                          <div className="mt-auto">
                            <CreateShipment
                              jobId={job.jobId}
                              jobNo={job.jobNo}
                              destination={{
                                id: destination.destinationId,
                                label: tDest("code", { code }),
                                place: placeOf(destination.provinceNameTh, destination),
                                left: destination.remainingQuantity,
                              }}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </article>
          </li>
        ))}
      </ul>
    </PartnerSection>
  ) : null;

  return (
    <PartnerPage title={t("title")} description={tDest("confidential")} wide>
      {every.data ? (
        <PartnerStats
          label={t("glance.label")}
          items={(
            [
              ["gate", "open", "truck"],
              ["road", "in_transit", "route"],
              ["pod", "in_transit", "signature"],
            ] as const
          ).map(([key, target, icon]) => ({
            key,
            href: `/ship?view=${target}`,
            icon,
            label: t(`glance.${key}`),
            value: format.number(glance[key]),
            highlight: key === "gate" && glance.gate > 0,
            tone: key === "pod" && glance.pod > 0 ? ("warning" as const) : undefined,
          }))}
        />
      ) : null}
      {plan.error ? <PageError error={plan.error} /> : null}
      {planSection}
      {waiting && !waiting.length ? (
        <p className="text-muted -mt-2 flex items-start gap-2 text-sm">
          <Icon name="check" size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
          {t("plan.empty")}
        </p>
      ) : null}

      <PartnerSection id="trips" title={t("list.title")}>
        <ViewTabs
          label={t("list.viewsLabel")}
          current={view}
          items={VIEWS.map((key) => ({
            key,
            href: `/ship?view=${key}`,
            label: t(`list.views.${key}`),
            count: counts[key],
          }))}
        />
        {list.data ? (
          list.data.data.length ? (
            <PartnerTable
              caption={t("list.title")}
              rows={list.data.data}
              rowKey={(shipment) => shipment.id}
              rowHref={(shipment) => `/ship/${shipment.id}`}
              rowTone={(shipment) => (podDue(shipment) ? "warning" : undefined)}
              columns={[
                {
                  key: "no",
                  header: t("list.table.no"),
                  primary: true,
                  cell: (shipment) => <span className="whitespace-nowrap tabular-nums">{shipment.shipmentNo}</span>,
                },
                {
                  key: "to",
                  header: t("list.table.to"),
                  cell: (shipment) => (
                    <span>
                      {[shipmentCodeOf(shipment), placeOf(shipment.destination.province.nameTh, shipment.destination)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ),
                },
                {
                  key: "jobs",
                  header: t("list.table.jobs"),
                  cell: (shipment) => (
                    <span className="text-sm tabular-nums">
                      {[...new Set(shipment.items.map((item) => item.jobNo))].join(", ")}
                    </span>
                  ),
                },
                {
                  key: "pieces",
                  header: t("list.table.pieces"),
                  align: "end",
                  cell: (shipment) => format.number(shipment.items.reduce((total, item) => total + item.quantity, 0)),
                },
                {
                  key: "cartons",
                  header: t("list.table.cartons"),
                  align: "end",
                  cell: (shipment) => shipment.cartonsCount,
                },
                {
                  key: "status",
                  header: t("list.table.status"),
                  cell: (shipment) => (
                    <span className="flex flex-col items-start gap-1">
                      <StatusChip map={SHIPMENT_STATUS} value={shipment.status} />
                      {shipment.status !== "draft" && shipment.status !== "cancelled" ? (
                        <WaybillBadge issued={shipment.waybillIssued} labels={waybillLabels} />
                      ) : null}
                      {podDue(shipment) ? (
                        <span className="text-warning-subtle-fg text-sm font-medium">{t("list.podMissing")}</span>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState
              icon="truck"
              title={t(`list.empty.${view}`)}
              action={
                <Button asChild variant="secondary" size="nav" iconEnd="arrow-right">
                  {view === "all" ? (
                    <Link href="/jobs?view=ready_to_ship">{tJobs("views.ready_to_ship")}</Link>
                  ) : (
                    <Link href="/ship?view=all">{t("list.views.all")}</Link>
                  )}
                </Button>
              }
            />
          )
        ) : (
          <PageError error={list.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
