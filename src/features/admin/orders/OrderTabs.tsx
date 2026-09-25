"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

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
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { StatusChip, useSlaFormat } from "../console";
import type { Order } from "./resources";

type Slip = Order["payments"][number]["slips"][number];

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

function address(value: Order["destinations"][number]) {
  return [value.line1, value.line2, value.subdistrict, value.district, value.province, value.postcode]
    .filter(Boolean)
    .join(" ");
}

export function SummaryTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail");
  const format = useFormat();
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("summary.title")}>
        <DescriptionList
          columns={3}
          items={[
            {
              term: t("summary.customer"),
              description: (
                <Link href={`/customers/${order.customer.id}`} className="text-primary hover:underline">
                  {order.customer.displayName}
                </Link>
              ),
            },
            {
              term: t("summary.customerCode"),
              description: <span className="font-mono">{order.customer.customerCode}</span>,
            },
            { term: t("summary.channel"), description: t(`channels.${order.channel}`) },
            {
              term: t("summary.group"),
              description: (
                <Link href={`/orders/groups/${order.group.id}`} className="text-primary font-mono hover:underline">
                  {order.group.groupCode}
                </Link>
              ),
            },
            { term: t("summary.productType"), description: order.productType.name },
            { term: t("summary.quantity"), description: `${format.number(order.quantity)} ${order.unit}` },
            { term: t("summary.leadTime"), description: t("summary.days", { days: order.leadTimeDays }) },
            { term: t("summary.promised"), description: format.date(order.promisedShipDate) },
            {
              term: t("summary.tolerance"),
              description: t("summary.toleranceValue", {
                shortage: format.percent(order.tolerance.shortagePct),
                overage: format.percent(order.tolerance.overagePct),
              }),
            },
            { term: t("summary.design"), description: t(`designOptions.${order.designOption}`) },
            { term: t("summary.mockup"), description: t(`mockupOptions.${order.mockupOption}`) },
            ...(order.factory ? [{ term: t("summary.factory"), description: order.factory.name }] : []),
            ...(order.poNumber ? [{ term: t("summary.po"), description: order.poNumber }] : []),
            ...(order.startMode
              ? [{ term: t("summary.startMode"), description: t(`startModes.${order.startMode}`) }]
              : []),
            ...(order.csRemarks ? [{ term: t("summary.remarks"), description: order.csRemarks, wide: true }] : []),
            ...(order.cancelReason
              ? [{ term: t("summary.cancelReason"), description: order.cancelReason, wide: true }]
              : []),
          ]}
        />
      </Section>
      <Section title={t("summary.specs")}>
        <DescriptionList
          columns={3}
          items={order.specs.map((spec) => ({ term: spec.label, description: spec.value }))}
        />
      </Section>
      <Section title={t("summary.destinations")}>
        <ul className="divide-border divide-y text-sm">
          {order.destinations.map((destination) => (
            <li key={destination.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{destination.recipientName}</span>
                <span className="text-muted"> · {destination.phone}</span>
                <span className="block">{address(destination)}</span>
              </span>
              <span className="tabular-nums">
                {format.number(destination.quantity)} {order.unit}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {order.taxProfile ? (
        <Section title={t("summary.taxProfile")}>
          <DescriptionList
            items={[
              { term: t("summary.taxName"), description: order.taxProfile.name },
              { term: t("summary.taxId"), description: <span className="font-mono">{order.taxProfile.taxId}</span> },
              { term: t("summary.branch"), description: order.taxProfile.branch },
              {
                term: t("summary.withholds"),
                description: order.taxProfile.withholdsTax ? t("summary.yes") : t("summary.no"),
              },
              { term: t("summary.taxAddress"), description: order.taxProfile.address, wide: true },
            ]}
          />
        </Section>
      ) : null}
    </div>
  );
}

export function ItemsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.items");
  const format = useFormat();
  const lineColumns: DataTableColumn<Order["lines"][number]>[] = [
    { id: "lineNo", header: t("lineNo"), numeric: true, cell: (line) => line.lineNo },
    {
      id: "description",
      header: t("description"),
      cell: (line) => (
        <div>
          <p>{line.description}</p>
          <p className="text-muted text-xs">{t(`lineTypes.${line.lineType}`)}</p>
          {line.waivedReason ? <p className="text-success text-xs">{line.waivedReason}</p> : null}
        </div>
      ),
    },
    {
      id: "quantity",
      header: t("quantity"),
      numeric: true,
      cell: (line) => `${line.quantity.replace(/\.?0+$/, "")} ${line.unit}`,
    },
    { id: "unitPrice", header: t("unitPrice"), numeric: true, cell: (line) => format.thb(line.unitPrice) },
    { id: "net", header: t("net"), numeric: true, cell: (line) => format.thb(line.netAmount) },
    { id: "vat", header: t("vat"), numeric: true, cell: (line) => format.thb(line.vatAmount) },
    { id: "gross", header: t("gross"), numeric: true, cell: (line) => format.thb(line.grossAmount) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("parts")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {order.parts.map((part) => (
            <li key={part.name} className="border-border rounded-lg border p-3 text-sm">
              <p className="font-medium">{part.name}</p>
              <p className="text-muted text-xs">
                {part.specs.map((spec) => `${spec.label}: ${spec.value}`).join(" · ")}
              </p>
              <p className="mt-1 tabular-nums">
                {t("partPrice", { unit: format.thb(part.unitPrice), total: format.thb(part.netAmount) })}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("lines")}>
        <DataTable
          caption={t("lines")}
          columns={lineColumns}
          rows={order.lines}
          getRowId={(line) => String(line.lineNo)}
          density="compact"
        />
        {/* Totals as the API computed them — the UI adds nothing up. */}
        <dl className="ms-auto mt-4 grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("totals.net")}</dt>
          <dd className="text-end tabular-nums">{format.thb(order.netAmount)}</dd>
          {order.discountAmount !== "0.00" ? (
            <>
              <dt className="text-muted">{t("totals.discount")}</dt>
              <dd className="text-end tabular-nums">
                {"-"}
                {format.thb(order.discountAmount)}
              </dd>
            </>
          ) : null}
          <dt className="text-muted">{t("totals.shipping")}</dt>
          <dd className="text-end tabular-nums">{format.thb(order.shippingAmount)}</dd>
          <dt className="text-muted">{t("totals.vat")}</dt>
          <dd className="text-end tabular-nums">{format.thb(order.vatAmount)}</dd>
          <dt className="font-medium">{t("totals.gross")}</dt>
          <dd className="text-end font-semibold tabular-nums">{format.thb(order.grossAmount)}</dd>
        </dl>
      </Section>
      {order.margin ? (
        <Section title={t("margin.title")}>
          <p className="text-muted mb-3 text-xs">{t("margin.hint")}</p>
          <DescriptionList
            columns={3}
            items={[
              {
                term: t("margin.buyCost"),
                description: <span className="tabular-nums">{format.thb(order.margin.buyCostNet)}</span>,
              },
              {
                term: t("margin.amount"),
                description: <span className="tabular-nums">{format.thb(order.margin.marginAmount)}</span>,
              },
              {
                term: t("margin.pct"),
                description: (
                  <span className={cn("tabular-nums", order.margin.belowMarginFloor && "text-danger font-medium")}>
                    {format.percent(order.margin.marginPct)}
                    {order.margin.belowMarginFloor ? ` · ${t("margin.belowFloor")}` : null}
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

function SlipCard({ slip, onApprove, onReject }: { slip: Slip; onApprove?: () => void; onReject?: () => void }) {
  const t = useTranslations("orders.detail.payments");
  const format = useFormat();
  const sla = useSlaFormat();
  const check = (ok: boolean, label: string) => (
    <li className={cn("flex items-center gap-1", ok ? "text-success" : "text-danger")}>
      <Icon name={ok ? "check" : "close"} size={14} />
      {label}
      <span className="sr-only">{ok ? t("checkPassed") : t("checkFailed")}</span>
    </li>
  );
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Icon name="receipt" size={16} className="text-muted" />
          {slip.file.originalName}
        </span>
        <StatusChip map={SLIP_STATUS} value={slip.verificationStatus} />
      </div>
      <p className="tabular-nums">
        {t("declared", { amount: format.thb(slip.declaredAmount), at: format.dateTime(slip.declaredTransferredAt) })}
      </p>
      {slip.checks ? (
        <ul className="flex flex-wrap gap-3 text-xs" aria-label={t("checks")}>
          {check(slip.checks.receiverMatched, t("receiver"))}
          {check(slip.checks.amountMatched, t("amount"))}
          {check(slip.checks.dateMatched, t("date"))}
          {check(!slip.checks.duplicate, t("notDuplicate"))}
        </ul>
      ) : (
        <p className="text-muted text-xs">{t("notChecked")}</p>
      )}
      {slip.verificationStatus === "manual_review" ? (
        <SlaTimer
          dueAt={slip.slaDueAt}
          format={sla}
          absolute={slip.slaDueAt ? format.dateTime(slip.slaDueAt) : undefined}
        />
      ) : null}
      {slip.reviewNote ? (
        <p className="text-muted text-xs">
          {t("reviewNote", { note: slip.reviewNote, by: slip.reviewedBy?.displayName ?? "—" })}
        </p>
      ) : null}
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

export function PaymentsTab({
  order,
  onApproveSlip,
  onRejectSlip,
}: {
  order: Order;
  onApproveSlip?: (slip: Slip) => void;
  onRejectSlip?: (slip: Slip) => void;
}) {
  const t = useTranslations("orders.detail.payments");
  const format = useFormat();
  const instalmentColumns: DataTableColumn<Order["instalments"][number]>[] = [
    { id: "seq", header: t("seq"), numeric: true, cell: (row) => row.seq },
    { id: "label", header: t("instalment"), cell: (row) => row.label },
    { id: "trigger", header: t("trigger"), cell: (row) => t(`triggers.${row.dueTrigger}`) },
    {
      id: "required",
      header: t("requiredBefore"),
      cell: (row) => (row.requiredBefore === "none" ? "—" : t(`requiredBeforeValues.${row.requiredBefore}`)),
    },
    { id: "dueAt", header: t("dueAt"), cell: (row) => <When at={row.dueAt} absoluteOnly /> },
    { id: "gross", header: t("gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "paid", header: t("paid"), numeric: true, cell: (row) => format.thb(row.paidAmount) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={INSTALMENT_STATUS} value={row.status} /> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("schedule")}>
        <p className="text-muted mb-3 text-xs">{t("scheduleHint")}</p>
        <DataTable
          caption={t("schedule")}
          columns={instalmentColumns}
          rows={order.instalments}
          getRowId={(row) => row.id}
          density="compact"
        />
      </Section>
      <Section title={t("payments")}>
        {order.payments.length === 0 ? (
          <EmptyState icon="wallet" title={t("noPayments")} />
        ) : (
          <ul className="flex flex-col gap-4">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{t(`methods.${payment.method}`)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{format.thb(payment.amount)}</span>
                    <StatusChip map={PAYMENT_STATUS} value={payment.status} />
                  </span>
                </div>
                {payment.providerRef ? (
                  <p className="text-muted text-xs">{t("reference", { ref: payment.providerRef })}</p>
                ) : null}
                {payment.slips.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {payment.slips.map((slip) => (
                      <SlipCard
                        key={slip.id}
                        slip={slip}
                        onApprove={
                          slip.verificationStatus === "manual_review" && onApproveSlip
                            ? () => onApproveSlip(slip)
                            : undefined
                        }
                        onReject={
                          slip.verificationStatus === "manual_review" && onRejectSlip
                            ? () => onRejectSlip(slip)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function ArtworkTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.artwork");
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("title")} actions={<StatusChip map={ARTWORK_STATUS} value={order.artwork.status} size="md" />}>
        {order.artwork.submissions.length === 0 ? (
          <EmptyState icon="upload" title={t("noSubmissions")} description={t("noSubmissionsBody")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {order.artwork.submissions.map((submission) => (
              <li key={submission.id} className="border-border rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t("version", { no: submission.versionNo })}</span>
                  <StatusChip map={PREFLIGHT_STATUS} value={submission.preflightStatus} />
                </div>
                <p className="text-muted text-xs">
                  {t(`sources.${submission.source}`)} · <When at={submission.submittedAt} />
                </p>
                {submission.findings.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {submission.findings.map((finding, index) => (
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
                          name={finding.severity === "block" ? "ban" : finding.severity === "warn" ? "warning" : "info"}
                          size={14}
                        />
                        <span>
                          <span className="font-medium">{t(`checks.${finding.check}`)}</span>
                          {finding.page ? ` · ${t("page", { page: finding.page })}` : null} — {finding.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        title={t("proofs")}
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/prepress?order=${order.id}`}>{t("openPrepress")}</Link>
          </Button>
        }
      >
        {order.artwork.proofs.length === 0 ? (
          <p className="text-muted text-sm">{t("noProofs")}</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {order.artwork.proofs.map((proof) => (
              <li key={proof.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {t("proofVersion", { no: proof.versionNo })}
                  <span className="text-muted"> · </span>
                  <When at={proof.sentAt} />
                  {proof.openAnnotations > 0 ? (
                    <Badge size="sm" tone="warning" className="ms-2">
                      {t("openAnnotations", { count: proof.openAnnotations })}
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
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function ProductionTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.production");
  const format = useFormat();
  if (order.jobs.length === 0) return <EmptyState icon="factory" title={t("noJobs")} description={t("noJobsBody")} />;
  return (
    <div className="flex flex-col gap-4">
      {order.jobs.map((job) => (
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
              job.factory?.name,
              t(`kinds.${job.kind}`),
              job.promisedShipDate ? t("promised", { date: format.date(job.promisedShipDate) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {job.milestones.length === 0 ? (
            <p className="text-muted text-sm">
              {job.acceptDueAt ? t("awaitingAcceptance", { at: format.dateTime(job.acceptDueAt) }) : t("noMilestones")}
            </p>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {job.milestones.map((step) => (
                <li
                  key={step.seq}
                  className="border-border flex items-start justify-between gap-2 rounded-lg border p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {step.seq}
                      {". "}
                      {step.name}
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
        </Section>
      ))}
    </div>
  );
}

export function ShipmentsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.shipments");
  const format = useFormat();
  if (order.shipments.length === 0) return <EmptyState icon="truck" title={t("none")} description={t("noneBody")} />;
  return (
    <div className="flex flex-col gap-4">
      {order.shipments.map((shipment) => (
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
                description: `${format.number(shipment.quantity)} ${order.unit} · ${t("cartons", { count: shipment.cartons })}`,
              },
              {
                term: t("destination"),
                description: `${shipment.destination.recipientName} · ${address({ ...shipment.destination, id: "", quantity: 0 })}`,
                wide: true,
              },
              { term: t("deliveredAt"), description: <When at={shipment.deliveredAt} absoluteOnly /> },
            ]}
          />
          {shipment.pod ? (
            <Callout
              tone="success"
              title={t("pod", {
                name: shipment.pod.receiverName,
                quantity: format.number(shipment.pod.deliveredQuantity),
              })}
              className="mt-3"
            >
              <When at={shipment.pod.capturedAt} absoluteOnly />
            </Callout>
          ) : shipment.status === "delivered" ? (
            <Callout tone="warning" title={t("podMissing")} className="mt-3" />
          ) : null}
        </Section>
      ))}
    </div>
  );
}

export function DocumentsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.documents");
  const format = useFormat();
  const columns: DataTableColumn<Order["documents"][number]>[] = [
    { id: "type", header: t("type"), cell: (row) => t(`types.${row.type}`) },
    { id: "number", header: t("number"), cell: (row) => <span className="font-mono">{row.number}</span> },
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
        rows={order.documents}
        getRowId={(row) => row.id}
        density="compact"
        empty={<EmptyState icon="document" title={t("none")} />}
      />
    </Section>
  );
}

export function ClaimsTab({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.claims");
  if (order.claims.length === 0) return <EmptyState icon="flag" title={t("none")} description={t("noneBody")} />;
  return (
    <Section title={t("title")}>
      <ul className="divide-border divide-y text-sm">
        {order.claims.map((claim) => (
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
