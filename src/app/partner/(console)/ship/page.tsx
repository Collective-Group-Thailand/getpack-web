import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SHIPMENT_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { CreateShipment } from "@/features/partner/ship/actions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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
  const [t, format] = await Promise.all([getTranslations("partnerShip"), getFormat()]);
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
  const manage = canAt(context, "factory_shipments.manage");
  const trips = every.data?.data ?? [];
  const moving = ["picked_up", "in_transit", "out_for_delivery"];
  const glance = {
    gate: trips.filter((trip) => trip.status === "ready").length,
    road: trips.filter((trip) => moving.includes(trip.status)).length,
    pod: trips.filter((trip) => trip.carrier === "factory_fleet" && !trip.proofOfDelivery && moving.includes(trip.status))
      .length,
  };
  // A job every destination of which has had all its pieces sent is done here (round 2, B3): the
  // plan still lists it, with nothing left to create.
  const waiting = plan.data?.filter((job) => job.destinations.some((destination) => destination.remainingQuantity > 0));

  return (
    <PartnerPage title={t("title")} wide>
      {every.data ? (
        <ul className="grid grid-cols-3 gap-3" aria-label={t("glance.label")}>
          {(
            [
              ["gate", "open"],
              ["road", "in_transit"],
              ["pod", "in_transit"],
            ] as const
          ).map(([key, target]) => (
            <li key={key}>
              <Link
                href={`/ship?view=${target}`}
                className="border-border bg-surface hover:bg-surface-subtle flex min-h-20 flex-col justify-center rounded-xl border p-3"
              >
                <span className="text-2xl font-bold tabular-nums">{format.number(glance[key])}</span>
                <span className="text-muted text-sm">{t(`glance.${key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <PartnerSection title={t("plan.title")} description={t("plan.body")}>
        {waiting ? (
          waiting.length ? (
            <ul className="flex flex-col gap-3">
              {waiting.map((job) => (
                <li key={job.jobId} id={`job-${job.jobId}`}>
                  <Card padding="md" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/jobs/${job.jobId}`} className="font-mono font-semibold underline">
                        {job.jobNo}
                      </Link>
                      <span className="text-muted flex-1 font-mono text-sm">{job.orderCode}</span>
                      <span className="text-muted text-sm">
                        {job.quantityGood !== null
                          ? t("plan.meta", {
                              good: format.number(job.quantityGood),
                              ordered: format.number(job.quantityOrdered),
                            })
                          : t("plan.metaOrdered", { ordered: format.number(job.quantityOrdered) })}
                      </span>
                    </div>
                    {job.blockedReason ? (
                      <Callout tone="warning" icon="warning">
                        {t(`plan.blocked.${job.blockedReason}`)}
                      </Callout>
                    ) : null}
                    <ul className="grid gap-3 md:grid-cols-2">
                      {job.destinations
                        .filter((destination) => destination.remainingQuantity > 0)
                        .map((destination) => (
                          <li key={destination.destinationId} className="border-border rounded-lg border p-3">
                            <p className="font-medium">{destination.recipientName}</p>
                            <p className="text-muted text-sm">
                              {[destination.provinceNameTh, destination.postcode].join(" ")}
                            </p>
                            <p className="mb-3 text-sm">
                              {t("plan.left", {
                                left: format.number(destination.remainingQuantity),
                                total: format.number(destination.quantity),
                              })}
                            </p>
                            {manage && job.blockedReason !== "inspection_pending" ? (
                              <CreateShipment
                                jobId={job.jobId}
                                jobNo={job.jobNo}
                                destination={{
                                  id: destination.destinationId,
                                  recipientName: destination.recipientName,
                                  place: [destination.provinceNameTh, destination.postcode].join(" "),
                                  left: destination.remainingQuantity,
                                }}
                              />
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="package" title={t("plan.empty")} />
          )
        ) : (
          <PageError error={plan.error} />
        )}
      </PartnerSection>

      <PartnerSection title={t("list.title")}>
        <nav aria-label={t("list.viewsLabel")}>
          <ul className="flex flex-wrap gap-2">
            {VIEWS.map((key) => (
              <li key={key}>
                <Link
                  href={`/ship?view=${key}`}
                  aria-current={key === view ? "page" : undefined}
                  className={cn(
                    "border-border inline-flex min-h-12 items-center rounded-full border px-4 font-medium",
                    key === view ? "bg-primary text-primary-fg border-primary" : "bg-surface hover:bg-surface-subtle",
                  )}
                >
                  {t(`list.views.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {list.data ? (
          list.data.data.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {list.data.data.map((shipment) => {
                const pieces = shipment.items.reduce((total, item) => total + item.quantity, 0);
                const podDue =
                  shipment.carrier === "factory_fleet" &&
                  !shipment.proofOfDelivery &&
                  ["picked_up", "in_transit", "out_for_delivery"].includes(shipment.status);
                return (
                  <li key={shipment.id}>
                    <Link
                      href={`/ship/${shipment.id}`}
                      className="border-border bg-surface hover:bg-surface-subtle flex min-h-20 flex-col gap-1 rounded-xl border p-3"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{shipment.shipmentNo}</span>
                        <StatusChip map={SHIPMENT_STATUS} value={shipment.status} />
                        <Icon name="chevron-right" size={24} className="text-muted ms-auto" />
                      </span>
                      <span>{shipment.destination.recipientName}</span>
                      <span className="text-muted text-sm">
                        {t("list.meta", {
                          jobNo: [...new Set(shipment.items.map((item) => item.jobNo))].join(", "),
                          quantity: format.number(pieces),
                          cartons: shipment.cartonsCount,
                        })}
                      </span>
                      {podDue ? (
                        <span className="text-warning-subtle-fg text-sm font-medium">{t("list.podMissing")}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="truck" title={t(`list.empty.${view}`)} />
          )
        ) : (
          <PageError error={list.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
