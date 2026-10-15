import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentFrame, AgentPager, pageOf } from "@/features/customer/agent/AgentPieces";
import { getMyCustomers } from "@/features/customer/agent/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { AGENT_LINK_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/shared/status/StatusChip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.customers");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The customers and companies linked to the agent (D-417), with what they earned. Someone who came
 * through the link shows by first letter only (D-422, the API masks it).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireCustomer();
  const page = pageOf((await searchParams).page);
  const [t, format, list] = await Promise.all([getTranslations("agent.customers"), getFormat(), getMyCustomers(page)]);
  return (
    <AgentFrame title={t("title")} intro={t("intro")}>
      {list.data.length === 0 ? (
        <EmptyState
          icon="users"
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <Link href="/account/agent">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {list.data.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {link.name} <span className="text-muted text-xs">{t(`subjects.${link.subject}`)}</span>
                </p>
                <p className="text-muted text-xs">
                  {t(`sources.${link.source}`)} · {t("since", { date: format.date(link.attributedAt) })} ·{" "}
                  {link.status === "active"
                    ? t("until", { date: format.date(link.endsAt) })
                    : t("ended", { date: format.date(link.endedAt) })}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted">{t("orders", { count: link.orders })}</span>
                <span className="font-semibold tabular-nums">{format.thb(link.commission)}</span>
                <StatusChip map={AGENT_LINK_STATUS} value={link.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/customers" />
    </AgentFrame>
  );
}
