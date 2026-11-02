import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AgentSignIn } from "@/features/agent/auth/AgentSignIn";
import { AuthSplitLayout } from "@/features/shared/auth/AuthSplitLayout";
import { signInReturnTo } from "@/features/shared/auth/return-to";
import { getActor } from "@/lib/auth/actor";
import { zoneOrigin } from "@/lib/zones/origin.server";
import { BrandLogo } from "@/ui/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.signIn");
  return { title: t("title") };
}

/**
 * getpack Agent's sign-in (D-467): the shared sign-in layout with the agent app's panel, and the storefront's own
 * ways in — phone OTP, Google, Apple, LINE — recorded as an agent-zone session. Someone already signed in here goes
 * straight on. Terms, privacy and help are the storefront's pages, opened in a new tab.
 */
export default async function AgentSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; provider?: string }>;
}) {
  const [t, query, actor, agentOrigin, storefront] = await Promise.all([
    getTranslations("agentZone.signIn"),
    searchParams,
    getActor("agent"),
    zoneOrigin("agent"),
    zoneOrigin("customer"),
  ]);
  const returnTo = signInReturnTo(query.returnTo);
  if (actor) redirect(returnTo);
  const lineReturnUrl = `${agentOrigin}/sign-in?provider=line&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthSplitLayout
      tone="brand"
      headline={t.rich("headline", { em: (chunks) => <em>{chunks}</em>, br: () => <br /> })}
      lead={t("lead")}
      points={[t("point1"), t("point2"), t("point3")]}
      homeLink={(children) => (
        <Link href="/" aria-label={t("home")}>
          {children}
        </Link>
      )}
      topStart={
        // The panel steps aside below `md`; the mark stays, so a phone still says where it is.
        <span className="flex items-center gap-2 md:hidden">
          <BrandLogo height={20} />
          <span className="text-primary border-primary/30 rounded-md border px-1.5 py-0.5 text-xs font-semibold">
            {t("agent")}
          </span>
        </span>
      }
      topEnd={
        <span className="text-muted">
          {t("notAgent")}{" "}
          <a href={`${storefront}/agent`} className="text-primary font-semibold underline-offset-4 hover:underline">
            {t("apply")}
          </a>
        </span>
      }
    >
      <AgentSignIn
        returnTo={returnTo}
        resume={query.provider === "line" ? "line" : undefined}
        lineReturnUrl={lineReturnUrl}
        links={{
          help: `${storefront}/help/contact`,
          terms: `${storefront}/legal/terms`,
          privacy: `${storefront}/legal/privacy`,
        }}
        heading={{ title: t("title"), subtitle: t("subtitle") }}
      />
    </AuthSplitLayout>
  );
}
