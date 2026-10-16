"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import {
  ARTWORK_STATUS,
  CLAIM_STATUS,
  DOCUMENT_STATUS,
  INSTALMENT_STATUS,
  JOB_STATUS,
  MILESTONE_STATUS,
  PAYMENT_STATUS,
  PREFLIGHT_STATUS,
  PROOF_STATUS,
  SHIPMENT_STATUS,
  SLIP_STATUS,
} from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Skeleton } from "@/ui/components/Skeleton";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, StatusChip, useCan, useSlaFormat } from "../console";
import { useGroupPayments, useGroupSchedule, type QueuedSlip } from "./data";
import type { Order, OrderGroup } from "./resources";
import { JobPanel } from "../production/JobPanel";

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {actions}
      </CardHeader>
      {children}
    </Card>
  );
}

/** A tab whose resource the actor's role may not read says so, rather than failing. */
function Unreadable({ icon }: { icon: "factory" | "truck" | "document" | "flag" | "image" }) {
  const t = useTranslations("orders.detail");
  return <EmptyState icon={icon} title={t("unreadable")} />;
}

function useLocalized() {
  const locale = useLocale();
  return (th: string, en: string | null | undefined) => (locale === "en" && en ? en : th);
}

/**
 * The group's tax profile as placed. The contract types it as a free object (CONTRACT-GAP
 * admin.orders — `AdminOrderGroupDto.taxProfile` has no schema of its own), so the tab shows the
 * documented fields it finds and nothing it would have to guess at.
 */
function taxProfileOf(snapshot: OrderGroup["taxProfile"]) {
  if (!snapshot) return null;
  const text = (key: string) => (typeof snapshot[key] === "string" ? (snapshot[key] as string) : null);
  return {
    name: text("name"),
    taxId: text("taxId"),
    branchCode: text("branchCode"),
    address: text("address"),
    withholdsTax: typeof snapshot.withholdsTax === "boolean" ? snapshot.withholdsTax : null,
  };
}

export function SummaryTab({ order, group }: { order: Order; group: OrderGroup | null }) {
  const t = useTranslations("orders.detail");
  const format = useFormat();
  const localized = useLocalized();
  const customer = group?.customer ?? null;
  const tax = taxProfileOf(group?.taxProfile ?? null);
  const { receipt, toleranceOutcome: outcome, summary } = order;
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("summary.title")}>
        {/* No factory name or start mode on the order (CONTRACT-GAP admin.orders): the Production tab names the factory's jobs. */}
        <DescriptionList
          columns={3}
          items={[
            {
              term: t("summary.customer"),
              description: customer ? (
                <Link href={`/customers/${customer.id}`} className="text-primary hover:underline">
                  {customer.displayName}
                </Link>
              ) : (
                "—"
              ),
            },
            {
              term: t("summary.customerCode"),
              description: <span className="font-mono">{customer?.customerCode ?? "—"}</span>,
            },
            ...(customer?.companyName ? [{ term: t("summary.company"), description: customer.companyName }] : []),
            { term: t("summary.placedBy"), description: group?.placedBy.displayName ?? "—" },
            { term: t("summary.channel"), description: group ? t(`channels.${group.channel}`) : "—" },
            {
              term: t("summary.group"),
              description: group ? (
                <Link href={`/orders/groups/${group.id}`} className="text-primary font-mono hover:underline">
                  {group.groupCode}
                </Link>
              ) : (
                "—"
              ),
            },
            {
              term: t("summary.productType"),
              description: summary.product
                ? localized(summary.product.nameTh, summary.product.nameEn)
                : localized(summary.productTypeNameTh, summary.productTypeNameEn),
            },
            {
              term: t("summary.quantity"),
              description: t("summary.quantityValue", {
                quantity: format.number(order.quantityOrdered),
                unit: t(`units.${summary.unit}`),
              }),
            },
            {
              term: t("summary.leadTime"),
              description: order.leadTimeDays === null ? "—" : t("summary.days", { days: order.leadTimeDays }),
            },
            { term: t("summary.promised"), description: format.date(order.promisedShipDate) },
            { term: t("summary.estimatedDelivery"), description: format.date(order.estimatedDeliveryDate) },
            {
              term: t("summary.tolerance"),
              description:
                order.toleranceShortagePct === null && order.toleranceOveragePct === null
                  ? "—"
                  : t("summary.toleranceValue", {
                      shortage: format.percent(order.toleranceShortagePct),
                      overage: format.percent(order.toleranceOveragePct),
                    }),
            },
            { term: t("summary.design"), description: t(`designOptions.${order.designOption}`) },
            { term: t("summary.mockup"), description: t(`mockupOptions.${order.mockupOption}`) },
            ...(group?.poNumber ? [{ term: t("summary.po"), description: group.poNumber }] : []),
            ...(order.cancelledAt
              ? [
                  {
                    term: t("summary.cancelReason"),
                    description: order.cancelReasonNameTh
                      ? localized(order.cancelReasonNameTh, order.cancelReasonNameEn)
                      : "—",
                  },
                ]
              : []),
            ...(group?.csRemarks ? [{ term: t("summary.remarks"), description: group.csRemarks, wide: true }] : []),
          ]}
        />
      </Section>
      {summary.specs.length > 0 ? (
        <Section title={t("summary.specs")}>
          <DescriptionList
            columns={3}
            items={summary.specs.map((spec) => ({
              term: localized(spec.labelTh, spec.labelEn),
              description: localized(spec.valueTh, spec.valueEn),
            }))}
          />
        </Section>
      ) : null}
      {receipt.deliveredAt || outcome ? (
        <Section title={t("summary.receipt.title")}>
          <DescriptionList
            columns={3}
            items={[
              { term: t("summary.receipt.delivered"), description: <When at={receipt.deliveredAt} absoluteOnly /> },
              { term: t("summary.receipt.confirmed"), description: <When at={receipt.confirmedAt} absoluteOnly /> },
              {
                term: t("summary.receipt.completed"),
                description: receipt.completedAt ? (
                  <span>
                    <When at={receipt.completedAt} absoluteOnly />
                    {receipt.completionMode ? ` · ${t(`summary.receipt.modes.${receipt.completionMode}`)}` : null}
                  </span>
                ) : receipt.autoCompleteAt ? (
                  <span>
                    {t("summary.receipt.autoComplete")} <When at={receipt.autoCompleteAt} absoluteOnly />
                  </span>
                ) : (
                  "—"
                ),
              },
              {
                term: t("summary.receipt.claimWindow"),
                description: <When at={receipt.claimWindowEndsAt} absoluteOnly />,
              },
              ...(outcome
                ? [
                    {
                      term: t("summary.receipt.tolerance"),
                      description: (
                        <span>
                          {t(`summary.receipt.outcomes.${outcome.outcome}`, {
                            delivered: format.number(outcome.deliveredQuantity),
                            ordered: format.number(outcome.orderedQuantity),
                          })}
                          {outcome.creditAmount
                            ? ` · ${t("summary.receipt.credit", { amount: format.thb(outcome.creditAmount) })}`
                            : null}
                        </span>
                      ),
                      wide: true,
                    },
                  ]
                : []),
            ]}
          />
        </Section>
      ) : null}
      {tax ? (
        <Section title={t("summary.taxProfile")}>
          <DescriptionList
            columns={3}
            items={[
              ...(tax.name ? [{ term: t("summary.taxName"), description: tax.name }] : []),
              ...(tax.taxId
                ? [{ term: t("summary.taxId"), description: <span className="font-mono">{tax.taxId}</span> }]
                : []),
              ...(tax.branchCode ? [{ term: t("summary.branch"), description: tax.branchCode }] : []),
              ...(tax.withholdsTax !== null
                ? [{ term: t("summary.withholds"), description: tax.withholdsTax ? t("summary.yes") : t("summary.no") }]
                : []),
              ...(tax.address ? [{ term: t("summary.taxAddress"), description: tax.address, wide: true }] : []),
            ]}
          />
        </Section>
      ) : null}
      <Section title={t("summary.destinations")}>
        <ul className="divide-border divide-y text-sm">
          {order.destinations.map((destination) => (
            <li key={destination.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{destination.address.recipientName}</span>
                <span className="text-muted"> · {destination.address.phone}</span>
                <span className="block">
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
                </span>
              </span>
              <span className="tabular-nums">{format.number(destination.quantity)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function ItemsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.items");
  const format = useFormat();
  const localized = useLocalized();
  const lineColumns: DataTableColumn<Order["lines"][number]>[] = [
    { id: "lineNo", header: t("lineNo"), numeric: true, cell: (line) => line.lineNo },
    {
      id: "description",
      header: t("description"),
      cell: (line) => (
        <div>
          <p>{localized(line.descriptionTh, line.descriptionEn)}</p>
          <p className="text-muted text-xs">{t(`lineTypes.${line.lineType}`)}</p>
        </div>
      ),
    },
    { id: "quantity", header: t("quantity"), numeric: true, cell: (line) => line.quantity.replace(/\.?0+$/, "") },
    { id: "unitPrice", header: t("unitPrice"), numeric: true, cell: (line) => format.thb(line.unitPrice) },
    { id: "net", header: t("net"), numeric: true, cell: (line) => format.thb(line.netAmount) },
    { id: "vat", header: t("vat"), numeric: true, cell: (line) => format.thb(line.vatAmount) },
    { id: "gross", header: t("gross"), numeric: true, cell: (line) => format.thb(line.grossAmount) },
  ];
  const { internal, totals } = order;
  // Masked for roles without cost visibility (D-141): the fields are there, their values null.
  const showMargin = internal.buyCostNet !== null || internal.marginPct !== null;
  return (
    <div className="flex flex-col gap-4">
      {/* Parts with per-part prices are not on the published order (CONTRACT-GAP admin.orders). */}
      <Section title={t("lines")}>
        <DataTable
          caption={t("lines")}
          columns={lineColumns}
          rows={order.lines}
          getRowId={(line) => line.id}
          density="compact"
        />
        {/* Totals as the API computed them — the UI adds nothing up. */}
        <dl className="ms-auto mt-4 grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("totals.net")}</dt>
          <dd className="text-end tabular-nums">{format.thb(totals.netAmount)}</dd>
          {totals.discountAmount !== "0.00" ? (
            <>
              <dt className="text-muted">{t("totals.discount")}</dt>
              <dd className="text-end tabular-nums">
                {"-"}
                {format.thb(totals.discountAmount)}
              </dd>
            </>
          ) : null}
          <dt className="text-muted">{t("totals.shipping")}</dt>
          <dd className="text-end tabular-nums">{format.thb(totals.shippingNetAmount)}</dd>
          <dt className="text-muted">{t("totals.vat")}</dt>
          <dd className="text-end tabular-nums">{format.thb(totals.vatAmount)}</dd>
          <dt className="font-medium">{t("totals.gross")}</dt>
          <dd className="text-end font-semibold tabular-nums">{format.thb(totals.grossAmount)}</dd>
        </dl>
      </Section>
      {showMargin ? (
        <Section title={t("margin.title")}>
          <p className="text-muted mb-3 text-xs">{t("margin.hint")}</p>
          <DescriptionList
            columns={3}
            items={[
              {
                term: t("margin.buyCost"),
                description: <span className="tabular-nums">{format.thb(internal.buyCostNet)}</span>,
              },
              {
                term: t("margin.amount"),
                description: <span className="tabular-nums">{format.thb(internal.marginAmount)}</span>,
              },
              {
                term: t("margin.pct"),
                description: (
                  <span className={cn("tabular-nums", internal.belowMarginFloor && "text-danger font-medium")}>
                    {format.percent(internal.marginPct)}
                    {internal.belowMarginFloor ? ` · ${t("margin.belowFloor")}` : null}
                  </span>
                ),
              },
            ]}
          />
        </Section>
      ) : null}
    </div>
  );
}

function SlipCard({ slip, onApprove, onReject }: { slip: QueuedSlip; onApprove?: () => void; onReject?: () => void }) {
  const t = useTranslations("orders.detail.payments");
  const tFinance = useTranslations("finance.common");
  const format = useFormat();
  const sla = useSlaFormat();
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Icon name="receipt" size={16} className="text-muted" />
          <span className="tabular-nums">
            {t("declared", {
              amount: format.thb(slip.declaredAmount),
              at: format.dateTime(slip.declaredTransferredAt),
            })}
          </span>
        </span>
        <StatusChip map={SLIP_STATUS} value={slip.status} />
      </div>
      <p className="text-muted text-xs">
        {t("expected", { amount: format.thb(slip.expectedAmount) })} · {tFinance(`checks.${slip.lastCheck ?? "none"}`)}
      </p>
      <SlaTimer
        dueAt={slip.slaDueAt}
        format={sla}
        absolute={slip.slaDueAt ? format.dateTime(slip.slaDueAt) : undefined}
      />
      {onApprove || onReject ? (
        <div className="flex gap-2">
          {onApprove ? (
            <Button size="sm" iconStart="check" onClick={onApprove}>
              {t("approve")}
            </Button>
          ) : null}
          {onReject ? (
            <Button size="sm" variant="secondary" iconStart="ban" onClick={onReject}>
              {t("reject")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The instalment states a payment can still be made against, and those a reminder is about. */
const OPEN_INSTALMENT = (status: string) => !["paid", "cancelled", "refunded"].includes(status);
const DUE_INSTALMENT = (status: string) => ["due", "overdue", "partially_paid"].includes(status);

/**
 * The group's payment schedule, its payments with their slips (`admin.payments.list?groupId`), and
 * the slips waiting for Finance. Reminding the customer and recording a slip they sent another way
 * act on the group's instalments, which getpack-api offers no action list for (no order-group
 * actions, U-B0.3): they are offered while an instalment is open, to `orders.manage`, and the API
 * refuses what does not apply (`payments.nothing_due`, `payments.reminder_recent`).
 */
export function PaymentsTab({
  order,
  group,
  slips,
  onApproveSlip,
  onRejectSlip,
  onRemind,
  onRecordSlip,
}: {
  order: Order;
  group: OrderGroup | null;
  slips: QueuedSlip[];
  onApproveSlip?: (slip: QueuedSlip) => void;
  onRejectSlip?: (slip: QueuedSlip) => void;
  onRemind: () => void;
  onRecordSlip: () => void;
}) {
  const t = useTranslations("orders.detail.payments");
  const tActions = useTranslations("orders.actions.labels");
  const format = useFormat();
  const localized = useLocalized();
  const canPayments = useCan("payments.read");
  const canManage = useCan("orders.manage");
  const schedule = useGroupSchedule(group?.id);
  const payments = useGroupPayments(group?.id);
  const instalments = schedule.data?.instalments ?? [];
  const live = order.status !== "cancelled";
  const instalmentColumns: DataTableColumn<Schemas["InstalmentDto"]>[] = [
    { id: "seq", header: t("seq"), numeric: true, cell: (row) => row.seq },
    { id: "label", header: t("instalment"), cell: (row) => localized(row.labelTh, row.labelEn) },
    { id: "trigger", header: t("trigger"), cell: (row) => t(`triggers.${row.dueTrigger}`) },
    {
      id: "required",
      header: t("requiredBefore"),
      cell: (row) => (row.requiredBefore === "none" ? "—" : t(`requiredBeforeValues.${row.requiredBefore}`)),
    },
    { id: "dueAt", header: t("dueAt"), cell: (row) => <When at={row.dueAt} absoluteOnly /> },
    { id: "gross", header: t("gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "paid", header: t("paid"), numeric: true, cell: (row) => format.thb(row.paidAmount) },
    { id: "open", header: t("open"), numeric: true, cell: (row) => format.thb(row.openAmount) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={INSTALMENT_STATUS} value={row.status} /> },
  ];
  const paymentColumns: DataTableColumn<Schemas["AdminPaymentDto"]>[] = [
    {
      id: "method",
      header: t("method"),
      cell: (row) => (
        <div>
          <p>{t.has(`methods.${row.method}`) ? t(`methods.${row.method}`) : row.method}</p>
          <p className="text-muted font-mono text-xs">{t("reference", { ref: row.referenceCode })}</p>
        </div>
      ),
    },
    { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={PAYMENT_STATUS} value={row.status} /> },
    {
      id: "slips",
      header: t("slips"),
      cell: (row) =>
        row.slips.length === 0 ? (
          "–"
        ) : (
          <ul className="space-y-1">
            {row.slips.map((slip) => (
              <li key={slip.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="tabular-nums">
                  {t("declared", {
                    amount: format.thb(slip.declaredAmount),
                    at: format.dateTime(slip.declaredTransferredAt),
                  })}
                </span>
                <StatusChip map={SLIP_STATUS} value={slip.status} />
              </li>
            ))}
          </ul>
        ),
    },
    {
      id: "paidAt",
      header: t("date"),
      cell: (row) => <When at={row.paidAt ?? row.createdAt} absoluteOnly />,
    },
  ];
  const canRemind = canManage && live && instalments.some((row) => DUE_INSTALMENT(row.status));
  const canRecord = canManage && live && instalments.some((row) => OPEN_INSTALMENT(row.status));
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("schedule")}
        actions={
          canRemind || canRecord ? (
            <span className="flex flex-wrap gap-2">
              {canRemind ? (
                <Button size="sm" variant="secondary" iconStart="send" onClick={onRemind}>
                  {tActions("send_payment_reminder")}
                </Button>
              ) : null}
              {canRecord ? (
                <Button size="sm" variant="secondary" iconStart="upload" onClick={onRecordSlip}>
                  {tActions("record_slip")}
                </Button>
              ) : null}
            </span>
          ) : undefined
        }
      >
        <p className="text-muted mb-3 text-xs">{t("scheduleHint")}</p>
        {schedule.isError ? <QueryError error={schedule.error} onRetry={() => void schedule.refetch()} /> : null}
        <DataTable
          caption={t("schedule")}
          columns={instalmentColumns}
          rows={instalments}
          getRowId={(row) => row.id}
          loading={!group || schedule.isPending}
          density="compact"
        />
      </Section>
      {slips.length > 0 ? (
        <Section title={t("slipsWaiting")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {slips.map((slip) => (
              <SlipCard
                key={slip.id}
                slip={slip}
                onApprove={onApproveSlip ? () => onApproveSlip(slip) : undefined}
                onReject={onRejectSlip ? () => onRejectSlip(slip) : undefined}
              />
            ))}
          </div>
        </Section>
      ) : null}
      {canPayments ? (
        <Section
          title={t("payments")}
          actions={
            group ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/finance/payments?q=${encodeURIComponent(group.groupCode)}`}>{t("openPayments")}</Link>
              </Button>
            ) : undefined
          }
        >
          {payments.isError ? <QueryError error={payments.error} onRetry={() => void payments.refetch()} /> : null}
          <DataTable
            caption={t("payments")}
            columns={paymentColumns}
            rows={payments.data?.data ?? []}
            getRowId={(row) => row.id}
            loading={!group || payments.isPending}
            density="compact"
            empty={<EmptyState icon="wallet" title={t("noPayments")} />}
          />
        </Section>
      ) : null}
    </div>
  );
}

export function ArtworkTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.artwork");
  const localized = useLocalized();
  const allowed = useCan("artwork.read");
  const path = { orderId: order.id };
  const submissions = useQuery({
    queryKey: queryKeys.related("admin", "order", order.id, "artwork"),
    enabled: allowed,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/artwork-submissions", { params: { path } }))
        .data!,
  });
  const proofs = useQuery({
    queryKey: queryKeys.related("admin", "order", order.id, "proofs"),
    enabled: allowed,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/proofs", { params: { path } })).data!,
  });
  if (!allowed) return <Unreadable icon="image" />;
  if (submissions.isError) return <QueryError error={submissions.error} onRetry={() => void submissions.refetch()} />;
  if (!submissions.data) return <Skeleton className="h-40" />;
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("title")} actions={<StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} size="md" />}>
        {submissions.data.length === 0 ? (
          <EmptyState icon="upload" title={t("noSubmissions")} description={t("noSubmissionsBody")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {submissions.data.map((submission) => {
              const findings = (submission.preflightReport?.files ?? []).flatMap((file) =>
                file.checks.filter((check) => check.outcome !== "pass"),
              );
              return (
                <li key={submission.id} className="border-border rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{t("version", { no: submission.versionNo })}</span>
                    <StatusChip map={PREFLIGHT_STATUS} value={submission.preflightStatus} />
                  </div>
                  <p className="text-muted text-xs">
                    {t(`sources.${submission.source}`)} · <When at={submission.submittedAt} />
                  </p>
                  {findings.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {findings.map((finding, index) => (
                        <li
                          key={index}
                          className={cn(
                            "flex items-start gap-2 text-xs",
                            finding.severity === "block"
                              ? "text-danger"
                              : finding.severity === "warn"
                                ? "text-warning-subtle-fg"
                                : "text-muted",
                          )}
                        >
                          <Icon
                            name={
                              finding.severity === "block" ? "ban" : finding.severity === "warn" ? "warning" : "info"
                            }
                            size={14}
                          />
                          <span>
                            <span className="font-medium">{t(`checks.${finding.check}`)}</span>
                            {finding.page ? ` · ${t("page", { page: finding.page })}` : null} —{" "}
                            {localized(finding.messageTh, finding.messageEn)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section
        title={t("proofs")}
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/prepress/${order.id}`}>{t("openPrepress")}</Link>
          </Button>
        }
      >
        {(proofs.data ?? []).length === 0 ? (
          <p className="text-muted text-sm">{t("noProofs")}</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {(proofs.data ?? []).map((proof) => {
              const open = proof.annotations.filter((note) => note.parentId === null && !note.resolvedAt).length;
              return (
                <li key={proof.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {t("proofVersion", { no: proof.versionNo })}
                    <span className="text-muted"> · </span>
                    <When at={proof.sentAt} />
                    {open > 0 ? (
                      <Badge size="sm" tone="warning" className="ms-2">
                        {t("openAnnotations", { count: open })}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    {proof.decisionChannel ? (
                      <span className="text-muted text-xs">{t(`channels.${proof.decisionChannel}`)}</span>
                    ) : null}
                    <StatusChip map={PROOF_STATUS} value={proof.status} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function ProductionTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.production");
  const tDetail = useTranslations("orders.detail");
  const format = useFormat();
  const localized = useLocalized();
  const allowed = useCan("production.read");
  const jobs = useQuery({
    queryKey: queryKeys.list("admin", "production_job", { orderId: order.id }),
    enabled: allowed,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/production-jobs", {
          params: { query: { orderId: order.id, perPage: 50 } },
        })
      ).data!,
    staleTime: STALE_TIME.transactional,
  });
  if (!allowed) return <Unreadable icon="factory" />;
  if (jobs.isError) return <QueryError error={jobs.error} onRetry={() => void jobs.refetch()} />;
  if (!jobs.data) return <Skeleton className="h-40" />;
  if (jobs.data.data.length === 0)
    return <EmptyState icon="factory" title={t("noJobs")} description={t("noJobsBody")} />;
  return (
    <div className="flex flex-col gap-4">
      {jobs.data.data.map((job) => (
        <Section
          key={job.id}
          title={t("job", { jobNo: job.jobNo })}
          actions={
            <span className="flex items-center gap-2">
              {job.atRisk ? (
                <Badge tone="danger" icon="warning">
                  {t("atRisk")}
                </Badge>
              ) : null}
              <StatusChip map={JOB_STATUS} value={job.status} size="md" />
            </span>
          }
        >
          <p className="text-muted mb-3 text-sm">
            {[
              job.factoryCode,
              t(`kinds.${job.kind}`),
              tDetail(`startModes.${job.releaseMode}`),
              job.promisedShipDate ? t("promised", { date: format.date(job.promisedShipDate) }) : null,
              job.riskReason ? t(`risks.${job.riskReason}`) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {job.milestones.length === 0 ? (
            <p className="text-muted text-sm">
              {job.acceptedAt ? t("noMilestones") : t("awaitingAcceptance", { at: format.dateTime(job.acceptDueAt) })}
            </p>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {job.milestones.map((step) => (
                <li
                  key={step.id}
                  className="border-border flex items-start justify-between gap-2 rounded-lg border p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {step.seq}
                      {". "}
                      {localized(step.nameTh, step.nameEn)}
                    </p>
                    <p className="text-muted text-xs">
                      {step.completedAt
                        ? t("doneAt", { at: format.dateTime(step.completedAt) })
                        : step.dueAt
                          ? t("dueAt", { at: format.dateTime(step.dueAt) })
                          : "—"}
                      {step.onTime === false ? <span className="text-danger"> · {t("late")}</span> : null}
                    </p>
                  </div>
                  <StatusChip map={MILESTONE_STATUS} value={step.status} />
                </li>
              ))}
            </ol>
          )}
          <div className="border-border mt-4 border-t pt-4">
            <JobPanel job={job} />
          </div>
        </Section>
      ))}
    </div>
  );
}

export function ShipmentsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.shipments");
  const format = useFormat();
  const allowed = useCan("shipments.read");
  const shipments = useQuery({
    queryKey: queryKeys.list("admin", "shipment", { orderId: order.id }),
    enabled: allowed,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/shipments", {
          params: { query: { orderId: order.id, perPage: 50 } },
        })
      ).data!,
  });
  if (!allowed) return <Unreadable icon="truck" />;
  if (shipments.isError) return <QueryError error={shipments.error} onRetry={() => void shipments.refetch()} />;
  if (!shipments.data) return <Skeleton className="h-40" />;
  if (shipments.data.data.length === 0)
    return <EmptyState icon="truck" title={t("none")} description={t("noneBody")} />;
  return (
    <div className="flex flex-col gap-4">
      {shipments.data.data.map((shipment) => {
        const quantity = shipment.items
          .filter((item) => item.orderCode === order.orderCode)
          .reduce((sum, item) => sum + item.quantity, 0);
        const pod = shipment.proofOfDelivery;
        return (
          <Section
            key={shipment.id}
            title={shipment.shipmentNo}
            actions={<StatusChip map={SHIPMENT_STATUS} value={shipment.status} size="md" />}
          >
            <DescriptionList
              columns={3}
              items={[
                { term: t("carrier"), description: t(`carriers.${shipment.carrier}`) },
                { term: t("tracking"), description: shipment.trackingNo ?? "—" },
                {
                  term: t("quantity"),
                  description: `${format.number(quantity)} · ${t("cartons", { count: shipment.cartonsCount })}`,
                },
                {
                  term: t("destination"),
                  description: [
                    shipment.destination.recipientName,
                    shipment.destination.line1,
                    shipment.destination.line2,
                    shipment.destination.postcode,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  wide: true,
                },
                { term: t("deliveredAt"), description: <When at={shipment.deliveredAt} absoluteOnly /> },
              ]}
            />
            {pod ? (
              <Callout
                tone="success"
                title={t("pod", { name: pod.receiverName, quantity: format.number(pod.deliveredQuantity) })}
                className="mt-3"
              >
                <When at={pod.capturedAt} absoluteOnly />
              </Callout>
            ) : shipment.status === "delivered" ? (
              <Callout tone="warning" title={t("podMissing")} className="mt-3" />
            ) : null}
          </Section>
        );
      })}
    </div>
  );
}

export function DocumentsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.documents");
  const format = useFormat();
  const allowed = useCan("receivables.read");
  const documents = useQuery({
    queryKey: queryKeys.list("admin", "customer-document", { orderId: order.id }),
    enabled: allowed,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customer-documents", {
          params: { query: { orderId: order.id, perPage: 50 } },
        })
      ).data!,
  });
  if (!allowed) return <Unreadable icon="document" />;
  if (documents.isError) return <QueryError error={documents.error} onRetry={() => void documents.refetch()} />;
  const columns: DataTableColumn<Schemas["CustomerDocumentDto"]>[] = [
    { id: "type", header: t("type"), cell: (row) => t(`types.${row.docType}`) },
    { id: "number", header: t("number"), cell: (row) => <span className="font-mono">{row.docNumber}</span> },
    { id: "issuedAt", header: t("issuedAt"), cell: (row) => <When at={row.issuedAt} absoluteOnly /> },
    { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={DOCUMENT_STATUS} value={row.status} /> },
  ];
  return (
    <Section title={t("title")}>
      <p className="text-muted mb-3 text-xs">{t("issuer")}</p>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={documents.data?.data ?? []}
        getRowId={(row) => row.id}
        loading={documents.isPending}
        density="compact"
        empty={<EmptyState icon="document" title={t("none")} />}
      />
    </Section>
  );
}

export function ClaimsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.claims");
  const allowed = useCan("claims.read");
  const claims = useQuery({
    queryKey: queryKeys.list("admin", "claim", { orderId: order.id }),
    enabled: allowed,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/claims", { params: { query: { orderId: order.id } } })).data!,
  });
  if (!allowed) return <Unreadable icon="flag" />;
  if (claims.isError) return <QueryError error={claims.error} onRetry={() => void claims.refetch()} />;
  if (!claims.data) return <Skeleton className="h-24" />;
  if (claims.data.data.length === 0) return <EmptyState icon="flag" title={t("none")} description={t("noneBody")} />;
  return (
    <Section title={t("title")}>
      <ul className="divide-border divide-y text-sm">
        {claims.data.data.map((claim) => (
          <li key={claim.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link href={`/claims/${claim.id}`} className="text-primary font-mono hover:underline">
              {claim.claimNo}
            </Link>
            <span className="text-muted">{t(`types.${claim.type}`)}</span>
            <When at={claim.submittedAt} />
            <StatusChip map={CLAIM_STATUS} value={claim.status} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
