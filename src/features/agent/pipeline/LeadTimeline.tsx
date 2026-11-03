import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Timeline, type TimelineItem } from "@/ui/components/Timeline";
import type { IconName } from "@/ui/icons";

type Activity = Schemas["AgentLeadActivityDto"];

const KIND_ICON: Record<Activity["kind"], IconName> = {
  call: "phone",
  line: "line",
  visit: "map-pin",
  email: "mail",
  note: "edit",
  quote_sent: "send",
  stage_change: "arrow-right",
  system: "info",
};
const EVENT_ICON: Partial<Record<NonNullable<Activity["event"]>, IconName>> = {
  converted: "user-plus",
  won: "star",
  quote_opened: "eye",
  quote_accepted: "check",
  quote_withdrawn: "undo",
  discount_requested: "percent",
  discount_options: "tag",
  discount_option_accepted: "check",
  deal_registered: "shield-check",
  deal_ended: "shield",
  lost: "ban",
};
const EVENT_TONE: Partial<Record<NonNullable<Activity["event"]>, TimelineItem["tone"]>> = {
  converted: "success",
  won: "success",
  quote_opened: "primary",
  quote_accepted: "success",
  discount_options: "warning",
  discount_option_accepted: "success",
  deal_registered: "success",
};

/**
 * The lead's timeline (D-468 §1): what the agent logged (calls, LINE, visits, e-mail, notes), the quotes sent, stage
 * moves, and what the system saw — the customer opening a quote, signing up, getpack answering a discount request,
 * a deal registered. Newest first, each with who and when.
 */
export async function LeadTimeline({ activities }: { activities: Activity[] }) {
  const [t, tStatus, format] = await Promise.all([
    getTranslations("agentSales.timeline"),
    getTranslations("status"),
    getFormat(),
  ]);
  const stage = (value: Activity["fromStage"]) => (value ? tStatus(AGENT_LEAD_STAGE[value].labelKey) : "");
  const items: TimelineItem[] = activities.map((entry) => {
    const title =
      entry.event && entry.event !== "lost"
        ? t(`events.${entry.event}`)
        : entry.kind === "stage_change"
          ? entry.fromStage
            ? t("stageMoved", { from: stage(entry.fromStage), to: stage(entry.toStage) })
            : t("stageSet", { to: stage(entry.toStage) })
          : t(`kinds.${entry.kind}`);
    const quoteLink = entry.agentQuoteId ? (
      <Link href={`/quotes/${entry.agentQuoteId}`} className="text-link underline-offset-2 hover:underline">
        {t("openQuote")}
      </Link>
    ) : null;
    return {
      id: entry.id,
      title,
      time: <time dateTime={entry.occurredAt}>{format.dateTime(entry.occurredAt)}</time>,
      actor: t(`authors.${entry.author}`),
      description:
        entry.body || quoteLink ? (
          <span className="flex flex-col gap-1">
            {entry.body ? <span className="whitespace-pre-line">{entry.body}</span> : null}
            {quoteLink}
          </span>
        ) : undefined,
      icon: (entry.event && EVENT_ICON[entry.event]) || KIND_ICON[entry.kind],
      tone: (entry.event && EVENT_TONE[entry.event]) || (entry.kind === "quote_sent" ? "primary" : "neutral"),
    };
  });
  return <Timeline items={items} label={t("label")} />;
}
