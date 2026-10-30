import type { Metadata } from "next";
import { redirect as redirectTo } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { DriverHandover } from "@/features/customer/handover/DriverHandover";
import { DeepLinkMiss } from "@/features/shared/deep-links/DeepLinkMiss";
import { resolveDeepLink, zoneOfToken } from "@/features/shared/deep-links/resolve.server";
import { isDriverToken } from "@/features/shared/deep-links/token";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/lib/auth/actor";
import { Button } from "@/ui/components/Button";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const robots = { index: false, follow: false };
  if (!isDriverToken(token)) return { robots };
  // A driver's link is passed around in chats: its preview names nothing (no recipient, no trip).
  const title = (await getTranslations("fulfilment.handover"))("metaTitle");
  return { title, robots, openGraph: { title }, referrer: "no-referrer" };
}

/**
 * A notification's link (U5.1 §2, D-299): `<web>/l/<token>` opens the exact page — for a customer
 * after signing in if needed, for staff and partners on their own zone's host.
 *
 * A driver handover link `<web>/l/d…` (D-462) is not a notification: it opens the trip's recipient for the carrier's
 * driver without signing in. The page is read in the browser (`DriverHandover`), never cached and never indexed
 * (`driverHandoverHeaders` in the proxy).
 */
export default async function Page({ params }: Props) {
  const { token } = await params;
  if (isDriverToken(token)) return <DriverHandover token={token} />;
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
