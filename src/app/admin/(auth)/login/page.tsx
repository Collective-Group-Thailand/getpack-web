import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { StaffLoginForm } from "@/features/admin/auth/StaffLoginForm";
import { AuthSplitLayout } from "@/features/shared/auth/AuthSplitLayout";
import { signInReturnTo } from "@/features/shared/auth/return-to";
import { getActor } from "@/lib/auth/actor";
import { zoneHosts } from "@/lib/env/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("staff.title") };
}

/**
 * Staff sign-in (UX audit Flow 1, step 3): the storefront's sign-in layout and panel, the form on
 * the right, and the way to the partner factories' app below it.
 */
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [t, params, actor, requestHeaders] = await Promise.all([
    getTranslations("auth.staff"),
    searchParams,
    getActor("admin"),
    headers(),
  ]);

  // Already signed in: send them on, rather than offering a form that would sign them in again.
  const returnTo = signInReturnTo(params.returnTo);
  if (actor) redirect(returnTo);

  // The partner zone is another host of this same deployment, on the scheme this request came in on.
  const scheme = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const partnerLoginUrl = `${scheme}://${zoneHosts.partner}/login`;

  return (
    <AuthSplitLayout
      tone="brand"
      headline={t.rich("headlineRich", { em: (chunks) => <em>{chunks}</em>, br: () => <br /> })}
      lead={t("panelLead")}
      points={[t("point1"), t("point2"), t("point3")]}
      note={{ title: t("noteTitle"), body: t("noteBody") }}
      homeLink={(children) => <Link href="/">{children}</Link>}
    >
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted mt-2 mb-8 text-base">{t("subtitle")}</p>
      <StaffLoginForm returnTo={returnTo} partnerLoginUrl={partnerLoginUrl} />
    </AuthSplitLayout>
  );
}
