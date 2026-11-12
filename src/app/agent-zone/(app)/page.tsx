import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getMyPayoutProfile } from "@/features/agent/api.server";
import { AgentPage, Panel } from "@/features/agent/AgentPage";
import { requireActiveAgent } from "@/features/agent/context.server";
import { ShareLink } from "@/features/agent/share/ShareLink";
import { HowItWorks, PlanTerms } from "@/features/shared/agent/PlanTerms";
import { AGENT_ZONE_PATHS } from "@/features/shared/agent/zone-paths";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { QRCode } from "@/ui/components/QRCode";
import { Stat } from "@/ui/components/Stat";
import { SummaryCards } from "@/ui/components/SummaryCards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.nav");
  return { title: t("home") };
}

/**
 * ภาพรวม (D-467): the link and its QR with the ways to share it, the two counts that lead to their lists, the money
 * by status as the API sums it, the plan and how the programme works — and, until Finance has verified them, a
 * banner asking for the payout details.
 */
export default async function Page() {
  const { agent, programme } = await requireActiveAgent();
  const [t, tz, tp, format, payout] = await Promise.all([
    getTranslations("agent.home"),
    getTranslations("agentZone.home"),
    getTranslations("agent.payout"),
    getFormat(),
    getMyPayoutProfile(),
  ]);
  const { totals } = agent;
  const askPayout = payout.data.applicable && !payout.data.payoutReady && payout.data.profile?.status !== "submitted";

  return (
    <AgentPage title={tz("title", { name: agent.legalName })} intro={tz("intro")}>
      {agent.status !== "active" ? (
        <Callout tone="warning" title={t(`status.${agent.status}`)}>
          {agent.statusReason}
        </Callout>
      ) : null}
      {askPayout ? (
        <Callout tone="warning" title={tp("banner")}>
          <Link href={AGENT_ZONE_PATHS.payout} className="font-semibold underline underline-offset-4">
            {tp("bannerCta")}
          </Link>
        </Callout>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="agent-link"
          className="bg-primary-subtle text-primary-subtle-fg rounded-card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6"
        >
          <span className="bg-surface rounded-control shrink-0 self-center p-2 sm:self-start">
            <QRCode value={agent.link} size={144} label={t("qrLabel")} />
          </span>
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <h2 id="agent-link" className="text-sm font-medium">
                {t("yourCode")}
              </h2>
              <p className="text-fg mt-1 text-3xl font-bold tracking-wider tabular-nums">{agent.code}</p>
              <p className="mt-1 text-sm break-all">{agent.link}</p>
            </div>
            <ShareLink link={agent.link} code={agent.code} message={tz("shareMessage")} />
            <p className="text-xs">{t("linkHint", { days: programme.linkCookieDays })}</p>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Stat
            icon="users"
            label={t("customers")}
            value={format.number(totals.activeLinks)}
            href={AGENT_ZONE_PATHS.customers}
            as={Link}
            className="rounded-card justify-center"
          />
          <Stat
            icon="user-plus"
            label={t("leads")}
            value={format.number(totals.openLeads)}
            href={AGENT_ZONE_PATHS.leads}
            as={Link}
            className="rounded-card justify-center"
          />
        </div>
      </div>

      <section aria-labelledby="agent-money" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="agent-money" className="text-lg font-semibold">
            {tz("money")}
          </h2>
          <Link
            href={AGENT_ZONE_PATHS.commissions}
            className="text-link min-h-11 content-center text-sm font-medium underline-offset-4 hover:underline"
          >
            {tz("moneyAll")}
          </Link>
        </div>
        <SummaryCards
          items={[
            {
              key: "earned",
              label: t("earned"),
              value: format.thb(totals.earned),
              hint: t("earnedHint"),
              icon: "coins",
              highlight: true,
            },
            {
              key: "pending",
              label: t("pending"),
              value: format.thb(totals.pending),
              hint: t("pendingHint"),
              icon: "hourglass",
            },
            {
              key: "statemented",
              label: t("statemented"),
              value: format.thb(totals.statemented),
              hint: t("statementedHint"),
              icon: "document",
            },
            { key: "paid", label: t("paidThisYear"), value: format.thb(totals.paidThisYear), icon: "wallet" },
          ]}
        />
        {Number(totals.held) > 0 ? (
          <Callout tone="warning">{t("held", { amount: format.thb(totals.held) })}</Callout>
        ) : null}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {agent.terms ? (
          <Panel id="agent-plan" title={t("plan", { name: agent.plan.nameTh })}>
            <PlanTerms terms={agent.terms} />
          </Panel>
        ) : null}
        <Panel id="agent-how" title={t("howTitle")}>
          <HowItWorks
            leadProtectionDays={programme.leadProtectionDays}
            paymentTermsDays={programme.paymentTermsDays}
            className=""
          />
        </Panel>
      </div>
    </AgentPage>
  );
}
