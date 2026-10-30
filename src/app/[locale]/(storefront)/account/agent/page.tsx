import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { CopyButton } from "@/features/customer/account/CopyButton";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
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
        {/* Project B4: the link and QR on the tint beside the two counts that lead to their lists; the money by
            status as summary cards; the plan and how to sell as two cards. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="agent-link"
            className="bg-primary-subtle text-primary-subtle-fg rounded-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
          >
            <span className="bg-surface rounded-control shrink-0 self-center p-2">
              <QRCode value={agent.link} size={136} label={t("qrLabel")} />
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <h2 id="agent-link" className="text-sm font-medium">
                {t("yourCode")}
              </h2>
              <p className="border-primary bg-surface text-fg rounded-control self-start border border-dashed px-3 py-1.5 text-2xl font-bold tracking-wider tabular-nums">
                {agent.code}
              </p>
              <p className="text-sm break-all">{agent.link}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={agent.code} label={t("copyCode")} />
                <CopyButton value={agent.link} label={t("shareLink")} share={{ title: t("shareTitle") }} />
              </div>
              <p className="text-xs">{t("linkHint", { days: programme.linkCookieDays })}</p>
            </div>
          </section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Stat
              icon="users"
              label={t("customers")}
              value={format.number(totals.activeLinks)}
              href="/account/agent/customers"
              as={Link}
              className="rounded-card justify-center"
            />
            <Stat
              icon="user-plus"
              label={t("leads")}
              value={format.number(totals.openLeads)}
              href="/account/agent/leads"
              as={Link}
              className="rounded-card justify-center"
            />
          </div>
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
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {agent.terms ? (
            <section aria-labelledby="agent-plan" className="border-border bg-surface rounded-card border p-4 sm:p-5">
              <h2 id="agent-plan" className="mb-3 text-lg font-semibold">
                {t("plan", { name: agent.plan.nameTh })}
              </h2>
              <PlanTerms terms={agent.terms} />
            </section>
          ) : null}
          <section aria-labelledby="agent-how" className="border-border bg-surface rounded-card border p-4 sm:p-5">
            <h2 id="agent-how" className="text-lg font-semibold">
              {t("howTitle")}
            </h2>
            <ol className="mt-3 flex flex-col gap-3 text-sm">
              {[
                t("how1"),
                t("how2", { days: programme.leadProtectionDays }),
                t("how3"),
                t("how4", { days: programme.paymentTermsDays }),
              ].map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="border-primary text-primary grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-pretty">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </AgentFrame>
    );
  }

  const application = programme.state === "none" ? null : await getApplication();
  const format = await getFormat();
  return (
    <div className="flex flex-col gap-6">
      <AccountHeader title={t("joinTitle")} lede={t("joinIntro")} />
      {/* Project B4: the offer on the tint beside how selling works, then the application. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {programme.plan ? (
          <section aria-labelledby="agent-offer" className="border-primary bg-surface rounded-card border p-4 sm:p-5">
            <h2 id="agent-offer" className="mb-3 text-lg font-semibold">
              {t("offer")}
            </h2>
            <PlanTerms terms={programme.plan} />
          </section>
        ) : null}
        <section aria-labelledby="agent-how" className="border-border bg-surface rounded-card border p-4 sm:p-5">
          <h2 id="agent-how" className="text-lg font-semibold">
            {t("howTitle")}
          </h2>
          <ol className="mt-3 flex flex-col gap-3 text-sm">
            {[
              t("how1"),
              t("how2", { days: programme.leadProtectionDays }),
              t("how3"),
              t("how4", { days: programme.paymentTermsDays }),
            ].map((step, index) => (
              <li key={index} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="border-primary text-primary grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5 text-pretty">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
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
