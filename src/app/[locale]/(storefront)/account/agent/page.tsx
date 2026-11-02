import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { WithdrawApplication } from "@/features/customer/agent/AgentActions";
import { getApplication, getProgramme, routeOldAgentPage } from "@/features/customer/agent/api.server";
import { ApplySteps } from "@/features/customer/agent/ApplySteps";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { HowItWorks, PlanTerms } from "@/features/shared/agent/PlanTerms";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.home");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The sales agent programme in the customer's account (D-416 – D-422): for anyone who is not an agent, the
 * programme — the agreement and the standard plan as the API sends them — and the application, or where it stands.
 * An agent's pages are in getpack Agent (D-467), where this URL sends them.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCustomer();
  const [t, programme] = await Promise.all([getTranslations("agent.home"), getProgramme()]);

  // D-467: the agent pages live in getpack Agent now — an agent is sent there (308, query kept).
  if (programme.state === "agent") return routeOldAgentPage([], await searchParams);

  const application = programme.state === "none" ? null : await getApplication();
  const format = await getFormat();
  return (
    <div className="flex flex-col gap-6">
      <AccountHeader title={t("joinTitle")} lede={t("joinIntro")} />
      {programme.state === "applied" && application ? (
        <>
          <ApplySteps current={1} />
          <Callout tone="info" title={t("applied", { date: format.date(application.submittedAt) })}>
            <p>{t("appliedBody")}</p>
            <div className="mt-2">
              <WithdrawApplication />
            </div>
          </Callout>
        </>
      ) : null}
      {programme.state === "rejected" && application ? (
        <Callout tone="warning" title={t("rejected")}>
          {application.decisionReason}
        </Callout>
      ) : null}
      {/* D-466: the compact version of getpack.co/agent — the offer and how it works, then one way to apply. */}
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
          <HowItWorks
            leadProtectionDays={programme.leadProtectionDays}
            paymentTermsDays={programme.paymentTermsDays}
          />
        </section>
      </div>
      {programme.state === "applied" ? null : programme.agreement ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/agent/apply">{t("applyOpen")}</Link>
          </Button>
          <Link href="/agent" className="text-muted hover:text-fg text-sm underline underline-offset-4">
            {t("moreAbout")}
          </Link>
        </div>
      ) : (
        <Callout tone="info">{t("noAgreement")}</Callout>
      )}
    </div>
  );
}
