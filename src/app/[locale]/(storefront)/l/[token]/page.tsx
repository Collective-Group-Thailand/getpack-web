import type { Metadata } from "next";
import { redirect as redirectTo } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { DeepLinkMiss } from "@/features/shared/deep-links/DeepLinkMiss";
import { resolveDeepLink, zoneOfToken } from "@/features/shared/deep-links/resolve.server";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/lib/auth/actor";
import { Button } from "@/ui/components/Button";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * A notification's link (U5.1 §2, D-299): `<web>/l/<token>` opens the exact page — for a customer
 * after signing in if needed, for staff and partners on their own zone's host.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const owner = zoneOfToken(token);
  if (owner === "customer" && !(await getActor("customer")))
    return redirect({ href: `/sign-in?returnTo=${encodeURIComponent(`/l/${token}`)}`, locale });

  const outcome = await resolveDeepLink("customer", token);
  if (outcome.kind === "elsewhere") redirectTo(outcome.url);
  if (outcome.kind === "go") return redirect({ href: outcome.path, locale });

  const t = await getTranslations("common.deepLink");
  return (
    <DeepLinkMiss
      reason={outcome.kind}
      actions={
        <>
          <Button asChild>
            <Link href="/account">{t("account")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/account/messages">{t("messages")}</Link>
          </Button>
        </>
      }
    />
  );
}
