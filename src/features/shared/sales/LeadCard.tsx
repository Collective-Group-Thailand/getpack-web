"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { bangkokTime, daysUntil, isDueToday, isPast } from "./dates";
import { LeadScore } from "./LeadScore";
import { StageMenu } from "./StageMenu";
import { LEAD_SURFACES, type LeadSurface } from "./surface";

type Lead = Schemas["AgentLeadDto"] | Schemas["AdminAgentLeadDto"];

/** The follow-up line: overdue and today read as such; a later one is its date and time. */
export function FollowUpText({ at, className }: { at: string | null; className?: string }) {
  const t = useTranslations("agentSales.list");
  const format = useFormat();
  if (!at) return <span className={cn("text-muted", className)}>{t("noFollowUp")}</span>;
  const overdue = isPast(at);
  const today = isDueToday(at);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        overdue ? "text-danger-subtle-fg font-medium" : today ? "text-warning-subtle-fg font-medium" : "",
        className,
      )}
    >
      <Icon name={overdue ? "flag" : "calendar"} size={14} aria-hidden="true" />
      {overdue
        ? t("overdue", { at: format.dateTime(at, { style: "dayMonth" }) })
        : today
          ? t("today", { time: bangkokTime(at) })
          : format.dateTime(at, { style: "dayMonth" })}
    </span>
  );
}

/**
 * How long the lead stays the agent's (D-417): "คุ้มครองอีก N วัน", warning-toned in the last week, plain once it is a
 * customer, and "หมดแล้ว" once released. Days are Bangkok calendar days.
 */
export function ProtectionText({
  lead,
  className,
}: {
  lead: Pick<Lead, "status" | "protectedUntil">;
  className?: string;
}) {
  const t = useTranslations("agentSales.list");
  if (lead.status === "converted") return <span className={cn("text-muted", className)}>{t("customerNow")}</span>;
  if (lead.status !== "registered") return <span className={cn("text-muted", className)}>{t("protectionOver")}</span>;
  const days = daysUntil(lead.protectedUntil);
  const ending = days <= 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        ending ? "text-warning-subtle-fg font-medium" : "text-muted",
        className,
      )}
    >
      <Icon name="shield" size={14} aria-hidden="true" />
      {days <= 0 ? t("protectionToday") : t("protectionDays", { days })}
    </span>
  );
}

/**
 * A lead as a card — the phone's list and the tablet's two columns (PROMPT <responsive>): who, which business, the
 * stage, when to follow up, how long it stays protected, and "ย้ายไปขั้น…". The whole name is the link to the lead.
 */
export function LeadCard({
  lead,
  draggable = false,
  headingLevel = 2,
  surface = "agent",
  readOnly = false,
}: {
  lead: Lead;
  draggable?: boolean;
  surface?: LeadSurface;
  /** Shown without "ย้ายไปขั้น…" (a freelance agent's lead seen from the sales desk). */
  readOnly?: boolean;
  /** h2 in the list (under the page's h1), h3 inside a board column. */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const t = useTranslations("agentSales.list");
  const format = useFormat();
  return (
    <article
      className="border-border bg-surface rounded-card flex h-full flex-col gap-3 border p-4"
      draggable={draggable || undefined}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData("text/x-getpack-lead", lead.id);
              event.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      data-lead-id={lead.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="text-base leading-snug font-semibold">
            <Link
              href={LEAD_SURFACES[surface].leadHref(lead.id)}
              className="focus-visible:ring-focus-ring rounded-sm outline-none hover:underline focus-visible:ring-2"
            >
              {lead.contactName}
            </Link>
          </Heading>
          {lead.organisationName ? <p className="text-muted truncate text-sm">{lead.organisationName}</p> : null}
          {"agent" in lead && surface === "admin" ? (
            <p className="text-muted truncate text-xs">
              {lead.agent.legalName} · <span className="tabular-nums">{lead.agent.code}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusChip map={AGENT_LEAD_STAGE} value={lead.stage} />
          {/* D-471: the reasons are for staff; the agent's own lead shows its score only. */}
          <LeadScore
            score={lead.score}
            reasons={surface === "admin" && "scoreReasons" in lead ? lead.scoreReasons : undefined}
            scoredAt={"scoredAt" in lead ? lead.scoredAt : null}
            name={lead.contactName}
            size="sm"
          />
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-1.5 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">{t("followUp")}</dt>
          <dd>
            <FollowUpText at={lead.nextFollowUpAt} />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">{t("protection")}</dt>
          <dd>
            <ProtectionText lead={lead} />
          </dd>
        </div>
        {lead.expectedValue ? (
          <div className="flex items-center gap-2">
            <dt className="text-muted">{t("expectedValue")}</dt>
            <dd className="font-medium tabular-nums">{format.thb(lead.expectedValue)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-muted text-xs">{t(`sources.${lead.source}`)}</span>
        {readOnly ? null : <StageMenu leadId={lead.id} name={lead.contactName} stage={lead.stage} surface={surface} />}
      </div>
    </article>
  );
}
