import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SHIPMENT_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { addressLine } from "@/features/partner/address";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { CreateShipment } from "@/features/partner/ship/actions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const VIEWS = ["open", "in_transit", "delivered", "all"] as const;
type View = (typeof VIEWS)[number];
type Props = { searchParams: Promise<{ view?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerShip"))("title") };
}

/**
 * Shipping (F5 5.2): finished jobs with what each destination still needs — a shipment per
 * destination, several for a split (D-110) — and the factory's shipments by stage, each to its
 * labels, dispatch and proof of delivery (D-013).
 */
export default async function ShipPage({ searchParams }: Props) {
  const query = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(query.view ?? "") ? (query.view as View) : "open";
  const t = await getTranslations("partnerShip");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [plan, list] = await Promise.all([
    attempt(() => requests.call("GET /v1/partner/factories/{factoryId}/ship-plan", { path })),
    attempt(() =>
      requests.call("GET /v1/partner/factories/{factoryId}/shipments", { path, query: { view, perPage: 50 } }),
    ),
  ]);

  return (
    <PartnerPage title={t("title")} wide>
      <PartnerSection title={t("plan.title")} description={t("plan.body")}>
        {plan.data ? (
          plan.data.length ? (
            <ul className="flex flex-col gap-3">
              {plan.data.map((job) => (
                <li key={job.id} id={`job-${job.id}`}>
                  <Card padding="md" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/jobs/${job.id}`} className="font-mono font-semibold underline">
                        {job.jobNo}
                      </Link>
                      <span className="flex-1">{job.title}</span>
                      <span className="text-muted text-sm">
                        {t("plan.meta", {
                          good: format.number(job.quantityGood),
                          date: format.date(job.promisedShipDate),
                        })}
                      </span>
                    </div>
                    {job.blockedReason ? (
                      <Callout tone="warning" icon="warning">
                        {t(`plan.blocked.${job.blockedReason}`)}
                      </Callout>
                    ) : null}
                    <ul className="grid gap-3 md:grid-cols-2">
                      {job.destinations
                        .filter((destination) => destination.shippedQuantity < destination.quantity)
                        .map((destination) => (
                          <li key={destination.id} className="border-border rounded-lg border p-3">
                            <p className="font-medium">{destination.recipientName}</p>
                            <p className="text-muted text-sm">
                              {addressLine({ ...destination, line1: destination.address })}
                            </p>
                            <p className="mb-3 text-sm">
                              {t("plan.left", {
                                left: format.number(destination.quantity - destination.shippedQuantity),
                                total: format.number(destination.quantity),
                              })}
                            </p>
                            {job.blockedReason === "inspection_pending" ? null : (
                              <CreateShipment
                                jobId={job.id}
                                destination={{
                                  id: destination.id,
                                  recipientName: destination.recipientName,
                                  left: destination.quantity - destination.shippedQuantity,
                                }}
                              />
                            )}
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
              {list.data.data.map((shipment) => (
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
                        jobNo: shipment.job.jobNo,
                        quantity: format.number(shipment.quantity),
                        cartons: shipment.cartons,
                      })}
                    </span>
                    {shipment.podRequired &&
                    !shipment.hasPod &&
                    ["in_transit", "picked_up", "out_for_delivery"].includes(shipment.status) ? (
                      <span className="text-warning-subtle-fg text-sm font-medium">{t("list.podMissing")}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
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
