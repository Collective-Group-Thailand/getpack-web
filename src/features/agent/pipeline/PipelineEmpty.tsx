import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

const PATH = ["new", "contacted", "quoted", "negotiating", "won"] as const;

/**
 * The list's empty states teach the next step (PROMPT P3 Web 10) with the product's own UI, no illustration: the
 * first one shows the stage path a lead walks — the same chips the list uses — under one sentence and one action.
 */
export async function PipelineEmpty({
  view,
  filtered,
  clearHref,
  action,
}: {
  view: "all" | "today" | "ending" | "closed";
  filtered: boolean;
  clearHref: string;
  action: React.ReactNode;
}) {
  const t = await getTranslations("agentSales.empty");
  const tStatus = await getTranslations("status");
  if (filtered) {
    return (
      <EmptyState
        icon="search"
        title={t("filteredTitle")}
        description={t("filteredBody")}
        action={
          <Button asChild variant="secondary">
            <Link href={clearHref}>{t("clear")}</Link>
          </Button>
        }
      />
    );
  }
  if (view !== "all") {
    return (
      <EmptyState
        icon={view === "today" ? "calendar" : view === "ending" ? "shield" : "archive"}
        title={t(`${view}Title`)}
        description={t(`${view}Body`)}
        action={
          <Button asChild variant="secondary">
            <Link href="/leads">{t("toAll")}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon="user-plus"
      title={t("allTitle")}
      description={t("allBody")}
      illustration={
        <ol className="flex flex-wrap items-center justify-center gap-1.5" aria-label={t("pathLabel")}>
          {PATH.map((stage, index) => (
            <li key={stage} className="flex items-center gap-1.5">
              <StatusBadge meta={AGENT_LEAD_STAGE[stage]} label={tStatus(AGENT_LEAD_STAGE[stage].labelKey)} size="sm" />
              {index < PATH.length - 1 ? (
                <Icon name="chevron-right" size={14} className="text-muted rtl:rotate-180" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
      }
      action={action}
      secondary={
        <Link href="/leads/import" className="text-link text-sm underline-offset-2 hover:underline">
          {t("importInstead")}
        </Link>
      }
    />
  );
}
