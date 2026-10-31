"use client";

import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { StatsRow, type SummaryItem } from "@/ui/components/DeskPage";

import { listTotalQuery } from "../console/queues";
import type { ListResource } from "../console/resource";
import { applicationsList, commissionsList, leadsList, statementsList } from "./resources";

/**
 * What the agent programme is waiting on, above the agents list: applications to review, commissions on hold,
 * statements still in draft and leads under protection. Each figure is the `meta.total` of the list its card opens,
 * with the same filter — so the card and the list it opens can never disagree.
 */
export function AgentStats() {
  const t = useTranslations("agents.list.stats");
  const format = useFormat();
  const sources: {
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resource: ListResource<any>;
    status: string;
    href: string;
    attention: boolean;
  }[] = [
    {
      key: "applications",
      resource: applicationsList,
      status: "submitted",
      href: "/agents/applications",
      attention: true,
    },
    { key: "held", resource: commissionsList, status: "held", href: "/agents/commissions", attention: true },
    { key: "drafts", resource: statementsList, status: "draft", href: "/agents/statements", attention: true },
    { key: "leads", resource: leadsList, status: "registered", href: "/agents/leads", attention: false },
  ];
  const totals = useQueries({
    queries: sources.map(({ resource, status }) => listTotalQuery({ resource, query: { status } })),
  });
  const items: SummaryItem[] = sources.map((source, index) => {
    const count = totals[index]?.data;
    return {
      key: source.key,
      label: t(source.key),
      value: typeof count === "number" ? format.number(count) : "—",
      hint: t(`${source.key}Hint`),
      tone: source.attention && typeof count === "number" && count > 0 ? "warning" : "neutral",
      href: `${source.href}?status=${source.status}`,
    };
  });
  return <StatsRow label={t("label")} items={items} columns={4} />;
}
