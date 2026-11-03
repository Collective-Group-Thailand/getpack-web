"use client";

import { useTranslations } from "next-intl";

import { LeadBoard } from "@/features/shared/sales/LeadBoard";
import { LeadTable } from "@/features/shared/sales/LeadTable";
import type { Schemas } from "@/lib/api/types";

type Lead = Schemas["AdminAgentLeadDto"];

/** The shared board (D-468 stage rules, drag as an enhancement, the menu as the way) bound to the sales desk. */
export function SalesBoard({ leads, readOnly }: { leads: Lead[]; readOnly: boolean }) {
  return <LeadBoard leads={leads} surface="admin" readOnly={() => readOnly} />;
}

/** The shared pipeline table bound to the sales desk; a manager also sees who works each lead. */
export function SalesLeadTable({
  showAgent,
  readOnly,
  ...props
}: Omit<React.ComponentProps<typeof LeadTable>, "surface" | "readOnly" | "extraColumn" | "leads"> & {
  leads: Lead[];
  showAgent: boolean;
  readOnly: boolean;
}) {
  const t = useTranslations("sales.pipeline");
  return (
    <LeadTable
      {...props}
      surface="admin"
      readOnly={() => readOnly}
      extraColumn={
        showAgent
          ? {
              header: t("agentColumn"),
              cell: (lead) =>
                "agent" in lead ? (
                  <span className="flex min-w-0 flex-col">
                    <span className="max-w-[12rem] truncate text-sm">{lead.agent.legalName}</span>
                    <span className="text-muted text-xs tabular-nums">{lead.agent.code}</span>
                  </span>
                ) : null,
            }
          : undefined
      }
    />
  );
}
