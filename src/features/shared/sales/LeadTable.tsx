"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { FollowUpText, ProtectionText } from "./LeadCard";
import { StageMenu } from "./StageMenu";
import { LEAD_SURFACES, type LeadSurface } from "./surface";

type Lead = Schemas["AgentLeadDto"] | Schemas["AdminAgentLeadDto"];
export type SortKey = Schemas["AgentLeadSort"];

/**
 * The desktop list (≥ 1024 px, PROMPT <responsive>): a real table with a caption, `scope`d headers and sortable
 * columns as links (`?sort=&order=`, so a sort survives a reload and can be shared), `aria-sort` on the sorted one,
 * and the stage menu in every row.
 */
export function LeadTable({
  leads,
  caption,
  sort,
  order,
  sortHrefs,
  surface = "agent",
  readOnly,
  extraColumn,
}: {
  leads: Lead[];
  surface?: LeadSurface;
  /** Rows the caller may only read: no stage menu. */
  readOnly?: (lead: Lead) => boolean;
  /** One more column after the lead (the sales desk's "who works it"). */
  extraColumn?: { header: string; cell: (lead: Lead) => React.ReactNode };
  caption: string;
  sort: SortKey;
  order: "asc" | "desc";
  /** For each sortable column, the URL that sorts by it (toggling the order when it is already the one). */
  sortHrefs: Record<"nextFollowUpAt" | "protectedUntil" | "expectedValue" | "updatedAt", string>;
}) {
  const t = useTranslations("agentSales.list");
  const format = useFormat();
  const header = (key: keyof typeof sortHrefs, label: string, numeric = false, className?: string) => {
    const active = sort === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (order === "asc" ? "ascending" : "descending") : undefined}
        className={cn("px-3 py-2.5 font-medium", numeric ? "text-end" : "text-start", className)}
      >
        <Link
          href={sortHrefs[key]}
          className={cn(
            "focus-visible:ring-focus-ring hover:text-fg inline-flex min-h-8 items-center gap-1 rounded-sm outline-none focus-visible:ring-2",
            active && "text-fg",
          )}
        >
          {label}
          <Icon
            name={active ? (order === "asc" ? "sort-asc" : "sort-desc") : "sort"}
            size={14}
            aria-hidden="true"
            className={active ? "" : "opacity-50"}
          />
          <span className="sr-only">{t("sortBy", { column: label })}</span>
        </Link>
      </th>
    );
  };
  return (
    <div className="border-border bg-surface rounded-card relative overflow-x-auto border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-subtle text-muted text-xs">
          <tr>
            <th scope="col" className="px-3 py-2.5 ps-4 text-start font-medium">
              {t("lead")}
            </th>
            {extraColumn ? (
              <th scope="col" className="px-3 py-2.5 text-start font-medium">
                {extraColumn.header}
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2.5 text-start font-medium">
              {t("stageColumn")}
            </th>
            {header("nextFollowUpAt", t("followUp"))}
            {header("protectedUntil", t("protection"), false, "hidden xl:table-cell")}
            {header("expectedValue", t("expectedValue"), true)}
            {header("updatedAt", t("updated"), false, "hidden xl:table-cell")}
            <th scope="col" className="px-3 py-2.5 pe-4 text-end font-medium">
              <span className="sr-only">{t("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-border hover:bg-surface-subtle/60 border-t align-middle">
              <td className="px-3 py-3 ps-4">
                <Link
                  href={LEAD_SURFACES[surface].leadHref(lead.id)}
                  className="focus-visible:ring-focus-ring block rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                >
                  {lead.contactName}
                </Link>
                {lead.organisationName ? (
                  <span className="text-muted block max-w-[22rem] truncate text-xs">{lead.organisationName}</span>
                ) : null}
                {/* Below 1280 px the protection column folds under the name. */}
                <span className="mt-1 block text-xs xl:hidden">
                  <ProtectionText lead={lead} />
                </span>
              </td>
              {extraColumn ? <td className="px-3 py-3">{extraColumn.cell(lead)}</td> : null}
              <td className="px-3 py-3 whitespace-nowrap">
                <StatusChip map={AGENT_LEAD_STAGE} value={lead.stage} />
              </td>
              <td className="px-3 py-3 xl:whitespace-nowrap">
                <FollowUpText at={lead.nextFollowUpAt} />
              </td>
              <td className="hidden px-3 py-3 whitespace-nowrap xl:table-cell">
                <ProtectionText lead={lead} />
              </td>
              <td className="px-3 py-3 text-end whitespace-nowrap tabular-nums">
                {lead.expectedValue ? format.thb(lead.expectedValue) : <span className="text-muted">—</span>}
              </td>
              <td className="text-muted hidden px-3 py-3 whitespace-nowrap xl:table-cell">
                {format.date(lead.updatedAt, { style: "dayMonth" })}
              </td>
              <td className="px-3 py-3 pe-4 text-end whitespace-nowrap">
                {readOnly?.(lead) ? null : (
                  <StageMenu leadId={lead.id} name={lead.contactName} stage={lead.stage} surface={surface} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
