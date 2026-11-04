import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getProgramme, getPublicProgramme } from "@/features/customer/agent/api.server";
import { ApplyForm } from "@/features/customer/agent/ApplyForm";
import { ApplySteps } from "@/features/customer/agent/ApplySteps";
import { WaitlistForm } from "@/features/customer/agent/WaitlistForm";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { HOME_WRAP } from "@/features/customer/home/parts";
import { Link, redirect } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.apply.page");
  return { title: t("title"), robots: { index: false, follow: true } };
}

/**
 * getpack.co/agent/apply (D-466 step 1): sign-in first (the application belongs to an account), then the short form.
 * An agent or a pending applicant goes to their account page. The form is for whoever may apply now
 * (`store.agent.programme.applyOpen`: the flag is on for them or they are on the pilot list, P7); anyone else gets the
 * waiting list when it takes sign-ups, else a plain closed note; a missing agreement says so — nothing is promised.
 */
export default async function AgentApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireCustomer();
  const [t, programme, open] = await Promise.all([
    getTranslations("agent.apply.page"),
    getProgramme(),
    getPublicProgramme(),
  ]);
  if (programme.state === "agent" || programme.state === "applied") redirect({ href: "/account/agent", locale });

  const mayApply = programme.applyOpen;
  const waitlist = !mayApply && open.waitlistOpen ? open.waitlistConsent : null;
  return (
    <div className={cn(HOME_WRAP, "max-w-3xl py-8 md:py-12")}>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em] md:text-[2.125rem]">
        {waitlist ? t("waitlistTitle") : t("title")}
      </h1>
      <p className="text-muted mt-2 text-[15px]">{waitlist ? t("waitlistLede") : t("lede")}</p>
      {mayApply ? (
        <div className="mt-6">
          <ApplySteps current={1} />
        </div>
      ) : null}
      <div className="mt-8">
        {mayApply ? (
          programme.agreement ? (
            <ApplyForm
              agreement={programme.agreement}
              defaultName={me.displayName}
              defaultEmail={me.email}
              accountPhone={me.phone}
            />
          ) : (
            <Callout tone="info">{t("noAgreement")}</Callout>
          )
        ) : waitlist ? (
          <WaitlistForm consent={waitlist} defaults={{ name: me.displayName, email: me.email, phone: me.phone }} />
        ) : (
          <Callout tone="info" title={t("closed")}>
            <p>{t("closedBody")}</p>
          </Callout>
        )}
      </div>
      <p className="mt-8 text-sm">
        <Link href="/agent" className="text-muted hover:text-fg underline underline-offset-4">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
