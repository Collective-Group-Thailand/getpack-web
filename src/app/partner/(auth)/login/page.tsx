import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { PartnerLoginForm } from "@/features/partner/auth/PartnerLoginForm";
import { AuthSplitLayout } from "@/features/shared/auth/AuthSplitLayout";
import { signInReturnTo } from "@/features/shared/auth/return-to";
import { getActor } from "@/lib/auth/actor";
import { zoneHosts } from "@/lib/env/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("partner.title") };
}

/**
 * Partner sign-in, in the sign-in layout every zone shares (the storefront's and the back office's):
 * the factory app's panel on the left, the form on the right — alone on a phone, where most
 * factories sign in. The way to become a partner is on the storefront's host.
 */
export default async function PartnerLoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [t, params, actor, requestHeaders] = await Promise.all([
    getTranslations("auth.partner"),
    searchParams,
    getActor("partner"),
    headers(),
  ]);

  const returnTo = signInReturnTo(params.returnTo);
  if (actor) redirect(returnTo);

  const scheme = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const applyUrl = `${scheme}://${zoneHosts.customer}/partner-with-us`;

  return (
    <AuthSplitLayout
      tone="brand"
      headline={t.rich("headlineRich", { em: (chunks) => <em>{chunks}</em>, br: () => <br /> })}
      lead={t("panelLead")}
      points={[t("point1"), t("point2"), t("point3")]}
      note={{ title: t("noteTitle"), body: t("noteBody") }}
      homeLink={(children) => <Link href="/">{children}</Link>}
      topEnd={
        <span className="text-muted">
          {t("notYet")}{" "}
          <a href={applyUrl} className="text-primary font-semibold underline-offset-4 hover:underline">
            {t("apply")}
          </a>
        </span>
      }
    >
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted mt-2 mb-8 text-base">{t("subtitle")}</p>
      <PartnerLoginForm returnTo={returnTo} />
    </AuthSplitLayout>
  );
}
