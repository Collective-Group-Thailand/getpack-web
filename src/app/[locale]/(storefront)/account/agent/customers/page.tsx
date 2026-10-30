import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PortalTable } from "@/features/customer/account/PortalTable";
import { AgentFrame, AgentPager, pageOf } from "@/features/customer/agent/AgentPieces";
import { getMyCustomers, requireAgent } from "@/features/customer/agent/api.server";
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
  await requireAgent();
  const page = pageOf((await searchParams).page);
  const [t, tt, format, list] = await Promise.all([
    getTranslations("agent.customers"),
    getTranslations("agent.table"),
    getFormat(),
    getMyCustomers(page),
  ]);
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
        <PortalTable
          caption={t("title")}
          columns={[
            { key: "customer", label: tt("customer"), className: "md:w-[34%]" },
            { key: "source", label: tt("source") },
            { key: "orders", label: tt("orders"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "commission", label: tt("commission"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "status", label: tt("status"), className: "md:whitespace-nowrap" },
          ]}
          rows={list.data.map((link) => ({
            id: link.id,
            phoneSubtitle: t(`subjects.${link.subject}`),
            cells: {
              customer: (
                <span className="block min-w-0">
                  <span className="block font-semibold">{link.name}</span>
                  <span className="text-muted hidden text-xs font-normal md:block">
                    {t(`subjects.${link.subject}`)}
                  </span>
                </span>
              ),
              source: (
                <span className="block text-sm">
                  {t(`sources.${link.source}`)}
                  <span className="text-muted block text-xs">
                    {t("since", { date: format.date(link.attributedAt) })} ·{" "}
                    {link.status === "active"
                      ? t("until", { date: format.date(link.endsAt) })
                      : t("ended", { date: format.date(link.endedAt) })}
                  </span>
                </span>
              ),
              orders: format.number(link.orders),
              commission: <span className="font-semibold">{format.thb(link.commission)}</span>,
              status: <StatusChip map={AGENT_LINK_STATUS} value={link.status} />,
            },
          }))}
        />
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/customers" />
    </AgentFrame>
  );
}
