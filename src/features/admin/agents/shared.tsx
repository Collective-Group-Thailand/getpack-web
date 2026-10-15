"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";

import { adminBrowserApis } from "../console";
import type { AgentKind, AgentPlan, AgentPlanTerms } from "./resources";

/** Every list and record the agent desk shows — refreshed together after any change on it. */
const RESOURCES = [
  "agent",
  "agent_application",
  "agent_link",
  "agent_lead",
  "agent_factory_link",
  "agent_commission",
  "agent_statement",
  "agent_plan",
] as const;

export function useRefreshAgents() {
  const queryClient = useQueryClient();
  return () => {
    for (const resource of RESOURCES) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
    }
  };
}

/** The commission plans with their versions (`admin.agentPlans.list`): a short list, read whole. */
export function usePlans() {
  return useQuery({
    queryKey: queryKeys.list("admin", "agent_plan"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/agent-plans")).data!,
    staleTime: STALE_TIME.reference,
  });
}

/** The plans an agent of this kind can be put on: not retired, with terms in force. */
export function planOptions(plans: readonly AgentPlan[] | undefined, kind: AgentKind) {
  return (plans ?? [])
    .filter((plan) => plan.agentKind === kind && !plan.retiredAt && plan.current)
    .map((plan) => ({ value: plan.id, label: `${plan.nameTh} (${plan.code})` }));
}

/** An agent named in a row, linking to their page. */
export function AgentCell({ agent }: { agent: Schemas["AgentRefDto"] }) {
  const t = useTranslations("agents.kinds");
  return (
    <div className="flex min-w-0 flex-col">
      <Link href={`/agents/${agent.id}`} className="text-primary truncate font-medium hover:underline">
        {agent.legalName}
      </Link>
      <span className="text-muted flex items-center gap-1 text-xs">
        <span className="font-mono">{agent.code}</span>
        <span aria-hidden>·</span>
        {t(agent.kind)}
      </span>
    </div>
  );
}

export function KindBadge({ kind }: { kind: AgentKind }) {
  const t = useTranslations("agents.kinds");
  return (
    <Badge size="sm" tone={kind === "employee" ? "info" : "neutral"} icon={kind === "employee" ? "building" : "user"}>
      {t(kind)}
    </Badge>
  );
}

/** A plan's terms as a short definition list. */
export function TermsList({ terms }: { terms: AgentPlanTerms }) {
  const t = useTranslations("agents.terms");
  const format = useFormat();
  const rows: [string, string][] = [
    [t("firstOrderPct"), format.percent(terms.firstOrderPct)],
    [t("repeatOrderPct"), format.percent(terms.repeatOrderPct)],
    [t("attributionMonths"), t("months", { count: terms.attributionMonths })],
    [t("marginCapPct"), format.percent(terms.marginCapPct)],
    [t("minBaseAmount"), format.thb(terms.minBaseAmount)],
    [
      t("factoryBounty"),
      Number(terms.factoryBountyAmount) > 0
        ? t("bountyValue", {
            amount: format.thb(terms.factoryBountyAmount),
            jobs: terms.factoryQualifyJobs,
            days: terms.factoryQualifyDays,
          })
        : t("none"),
    ],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map(([term, value]) => (
        <div key={term} className="flex justify-between gap-3 border-b py-1 last:border-b-0">
          <dt className="text-muted">{term}</dt>
          <dd className="text-end font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "2026-10" for the month before this one, in Bangkok — the month a statement run usually covers. */
export function previousMonth(now = new Date()): string {
  const bangkok = new Date(now.getTime() + 7 * 3_600_000);
  const year = bangkok.getUTCFullYear();
  const month = bangkok.getUTCMonth(); // 0-based: this is already "last month" as 1-based
  return month === 0 ? `${year - 1}-12` : `${year}-${String(month).padStart(2, "0")}`;
}

/** Today in Bangkok as `YYYY-MM-DD`. */
export function bangkokToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
