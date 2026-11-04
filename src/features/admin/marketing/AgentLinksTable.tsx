"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { refAgentP2Of } from "@/features/shared/loyalty-p2/read";
import type { Schemas } from "@/lib/api/types";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";
import { BarValue } from "@/ui/components/charts";

type RefAgent = Schemas["PromotionRefAgentDto"];

/**
 * Agents' share links in the promotion report (loyalty P2, D-495; `admin.promotions.report` `refAgents[]`): visitors
 * and visits from P1.5, and from P2 the sign-ups, paying customers, order groups, gross, discount and redemptions that
 * followed a first visit within the agent cookie's window. Every figure is the API's; money is formatted, never
 * summed. Before the API sends the P2 fields the row shows dashes. Gross carries a thin bar so the column reads as a
 * ranking without a chart (the admin tables' convention).
 */
export function AgentLinksTable({ rows, loading = false }: { rows: readonly RefAgent[]; loading?: boolean }) {
  const t = useTranslations("marketing.campaign.agents");
  const format = useFormat();
  const performance = (row: RefAgent) => refAgentP2Of(row);
  const grossMax = Math.max(0, ...rows.map((row) => Number(performance(row)?.grossAmount ?? 0)));
  const count = (value: number | undefined) => (value === undefined ? "—" : format.number(value));

  return (
    <DeskSection title={t("title")} description={t("description")}>
      <DataTable<RefAgent>
        caption={t("title")}
        density="compact"
        rows={[...rows]}
        loading={loading}
        getRowId={(row) => row.agentCode}
        empty={<EmptyState icon="link" title={t("empty")} />}
        columns={[
          {
            id: "agent",
            header: t("agent"),
            cell: (row) => <span className="font-medium tabular-nums">{row.agentCode}</span>,
          },
          { id: "visitors", header: t("visitors"), numeric: true, cell: (row) => format.number(row.visitors) },
          { id: "visits", header: t("visits"), numeric: true, cell: (row) => format.number(row.visits) },
          { id: "signups", header: t("signups"), numeric: true, cell: (row) => count(performance(row)?.signups) },
          { id: "customers", header: t("customers"), numeric: true, cell: (row) => count(performance(row)?.customers) },
          { id: "orders", header: t("orders"), numeric: true, cell: (row) => count(performance(row)?.orderGroups) },
          {
            id: "gross",
            header: t("gross"),
            numeric: true,
            cell: (row) => {
              const p2 = performance(row);
              return p2 ? (
                <BarValue value={Number(p2.grossAmount)} max={grossMax}>
                  {format.thb(p2.grossAmount)}
                </BarValue>
              ) : (
                "—"
              );
            },
          },
          {
            id: "discount",
            header: t("discount"),
            numeric: true,
            cell: (row) => {
              const p2 = performance(row);
              return p2 ? format.thb(p2.discountAmount) : "—";
            },
          },
          {
            id: "redemptions",
            header: t("redemptions"),
            numeric: true,
            cell: (row) => count(performance(row)?.redemptions),
          },
        ]}
      />
    </DeskSection>
  );
}
