import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CopyButton } from "@/features/customer/account/CopyButton";
import { WithdrawApplication } from "@/features/customer/agent/AgentActions";
import { AgentFrame, PlanTerms } from "@/features/customer/agent/AgentPieces";
import { getAgent, getApplication, getProgramme } from "@/features/customer/agent/api.server";
import { ApplyForm } from "@/features/customer/agent/ApplyForm";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";
import { QRCode } from "@/ui/components/QRCode";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.home");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The sales agent programme in the customer's account (D-416 – D-422): for an agent, their link and
 * QR code, money by status and their plan; for anyone else, the programme — the agreement and the
 * standard plan as the API sends them — and the application, or where it stands.
 */
export default async function Page() {
  const me = await requireCustomer();
  const [t, programme] = await Promise.all([getTranslations("agent.home"), getProgramme()]);

  if (programme.state === "agent") {
    const [agent, format] = await Promise.all([getAgent(), getFormat()]);
    const { totals } = agent;
    return (
      <AgentFrame title={t("title")} intro={t("introAgent")}>
        {agent.status !== "active" ? (
          <Callout tone="warning" title={t(`status.${agent.status}`)}>
            {agent.statusReason}
          </Callout>
        ) : null}
        <section
          aria-labelledby="agent-link"
          className="bg-surface border-border flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
        >
          <QRCode value={agent.link} size={144} label={t("qrLabel")} className="shrink-0 self-center" />
          <div className="flex min-w-0 flex-col gap-2">
            <h2 id="agent-link" className="text-muted text-sm font-medium">
              {t("yourCode")}
            </h2>
            <p className="font-mono text-3xl font-bold tracking-wider">{agent.code}</p>
            <p className="text-muted text-sm break-all">{agent.link}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={agent.code} label={t("copyCode")} />
              <CopyButton value={agent.link} label={t("shareLink")} share={{ title: t("shareTitle") }} />
            </div>
            <p className="text-muted text-xs">{t("linkHint", { days: programme.linkCookieDays })}</p>
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("pending")} value={format.thb(totals.pending)} hint={t("pendingHint")} />
          <Stat label={t("earned")} value={format.thb(totals.earned)} hint={t("earnedHint")} tone="success" />
          <Stat label={t("statemented")} value={format.thb(totals.statemented)} hint={t("statementedHint")} />
          <Stat label={t("paidThisYear")} value={format.thb(totals.paidThisYear)} />
        </div>
        {Number(totals.held) > 0 ? (
          <Callout tone="warning">{t("held", { amount: format.thb(totals.held) })}</Callout>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label={t("customers")}
            value={format.number(totals.activeLinks)}
            href="/account/agent/customers"
            as={Link}
          />
          <Stat label={t("leads")} value={format.number(totals.openLeads)} href="/account/agent/leads" as={Link} />
          <Stat label={t("factories")} value={format.number(totals.factories)} />
        </div>
        {agent.terms ? (
          <section aria-labelledby="agent-plan" className="flex flex-col gap-2">
            <h2 id="agent-plan" className="text-lg font-semibold">
              {t("plan", { name: agent.plan.nameTh })}
            </h2>
            <PlanTerms terms={agent.terms} />
          </section>
        ) : null}
        <section aria-labelledby="agent-how" className="flex flex-col gap-2">
          <h2 id="agent-how" className="text-lg font-semibold">
            {t("howTitle")}
          </h2>
          <ol className="text-muted flex list-decimal flex-col gap-1 ps-5 text-sm">
            <li>{t("how1")}</li>
            <li>{t("how2", { days: programme.leadProtectionDays })}</li>
            <li>{t("how3")}</li>
            <li>{t("how4", { days: programme.paymentTermsDays })}</li>
          </ol>
        </section>
      </AgentFrame>
    );
  }

  const application = programme.state === "none" ? null : await getApplication();
  const format = await getFormat();
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-title leading-tight">{t("joinTitle")}</h1>
        <p className="text-muted mt-1">{t("joinIntro")}</p>
      </div>
      {programme.plan ? (
        <section
          aria-labelledby="agent-offer"
          className="bg-surface border-border flex flex-col gap-2 rounded-2xl border p-5"
        >
          <h2 id="agent-offer" className="text-lg font-semibold">
            {t("offer")}
          </h2>
          <PlanTerms terms={programme.plan} />
        </section>
      ) : null}
      {programme.state === "applied" && application ? (
        <Callout tone="info" title={t("applied", { date: format.date(application.submittedAt) })}>
          <p>{t("appliedBody")}</p>
          <div className="mt-2">
            <WithdrawApplication />
          </div>
        </Callout>
      ) : (
        <>
          {programme.state === "rejected" && application ? (
            <Callout tone="warning" title={t("rejected")}>
              {application.decisionReason}
            </Callout>
          ) : null}
          {programme.agreement ? (
            // The form behind one step: most customers come to read the offer, not to fill in a
            // bank account (customer walkthrough 2026-10-16). A rejected applicant sees it open.
            <details open={programme.state === "rejected"} className="group">
              <summary className="bg-primary text-primary-fg rounded-control inline-flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 text-sm font-semibold group-open:hidden [&::-webkit-details-marker]:hidden">
                {t("applyOpen")}
              </summary>
              <p className="text-muted mt-2 text-sm group-open:hidden">{t("applyOpenHint")}</p>
              <ApplyForm agreement={programme.agreement} defaultName={me.displayName} />
            </details>
          ) : (
            <Callout tone="info">{t("noAgreement")}</Callout>
          )}
        </>
      )}
    </div>
  );
}
