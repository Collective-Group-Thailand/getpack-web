import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getProgramme, getPublicProgramme } from "@/features/customer/agent/api.server";
import { ApplyForm } from "@/features/customer/agent/ApplyForm";
import { ApplySteps } from "@/features/customer/agent/ApplySteps";
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
 * An agent or a pending applicant goes to their account page; a closed programme (flag `agents.programme` off) or a
 * missing agreement says so plainly — nothing is promised.
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

  return (
    <div className={cn(HOME_WRAP, "max-w-3xl py-8 md:py-12")}>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em] md:text-[2.125rem]">{t("title")}</h1>
      <p className="text-muted mt-2 text-[15px]">{t("lede")}</p>
      <div className="mt-6">
        <ApplySteps current={1} />
      </div>
      <div className="mt-8">
        {!open.applyOpen ? (
          <Callout tone="info" title={t("closed")}>
            <p>{t("closedBody")}</p>
          </Callout>
        ) : programme.agreement ? (
          <ApplyForm
            agreement={programme.agreement}
            defaultName={me.displayName}
            defaultEmail={me.email}
            accountPhone={me.phone}
          />
        ) : (
          <Callout tone="info">{t("noAgreement")}</Callout>
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
