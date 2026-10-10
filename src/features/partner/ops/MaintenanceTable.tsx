import { getTranslations } from "next-intl/server";

import { ERP_MAINTENANCE_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

type Row = Schemas["ErpMaintenanceOrderSummaryDto"];

const PRIORITY_TONE = { low: "neutral", normal: "neutral", high: "warning", urgent: "danger" } as const;

/** Maintenance orders as a table (D-355): number, machine, subject, kind, priority, window, status. */
export async function MaintenanceTable({
  rows,
  caption,
  empty,
  withMachine = true,
}: {
  rows: Row[];
  caption: string;
  empty?: React.ReactNode;
  withMachine?: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations("partnerOps.maintenance"), getFormat()]);
  return (
    <PartnerTable
      caption={caption}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/maintenance/${r.id}`}
      rowTone={(r) =>
        r.status === "done" || r.status === "cancelled"
          ? undefined
          : r.priority === "urgent"
            ? "danger"
            : r.priority === "high"
              ? "warning"
              : undefined
      }
      empty={empty}
      columns={[
        {
          key: "no",
          header: t("table.no"),
          primary: true,
          cell: (r) => <span className="font-mono whitespace-nowrap">{r.mtNo}</span>,
        },
        ...(withMachine ? [{ key: "machine", header: t("table.machine"), cell: (r: Row) => r.machine.name }] : []),
        { key: "subject", header: t("table.subject"), cell: (r) => r.title },
        { key: "kind", header: t("table.kind"), hideOnPhone: true, cell: (r) => t(`kinds.${r.kind}`) },
        {
          key: "priority",
          header: t("table.priority"),
          cell: (r) => <Badge tone={PRIORITY_TONE[r.priority]}>{t(`priorities.${r.priority}`)}</Badge>,
        },
        {
          key: "reported",
          header: t("table.reported"),
          hideOnPhone: true,
          className: "whitespace-nowrap",
          cell: (r) => format.dateTime(r.reportedAt),
        },
        {
          key: "window",
          header: t("table.window"),
          hideOnPhone: true,
          className: "whitespace-nowrap",
          cell: (r) => (r.scheduledStart ? format.dateTime(r.scheduledStart) : "—"),
        },
        {
          key: "status",
          header: t("table.status"),
          cell: (r) => <StatusChip map={ERP_MAINTENANCE_STATUS} value={r.status} />,
        },
      ]}
    />
  );
}
