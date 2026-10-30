import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReferralClaim } from "@/features/customer/account/ReferralClaim";
import { NextStep } from "@/features/customer/shell/NextStep";
import { Link } from "@/i18n/navigation";
import { readAccessToken } from "@/lib/auth/session";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { OpenBoxIllustration } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";

/** The shape getpack-api gives a referral code (`ReferralsService.attribute`: 6–12 letters and digits, any case). */
const CODE = /^[A-Z0-9]{6,12}$/;

/** A malformed escape is just an invalid code, never an error page. */
function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.referral.landing");
  // A personal invite, never a search result.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * A friend's invite (D-136): the share link `/r/{code}` lands here. There is no public endpoint that checks a code
 * or tells a guest the reward terms, so the page checks the code's shape only and names no amount. A guest signs in
 * (new or returning — the same phone step) and comes back here with `claim=1`; a signed-in customer then uses the
 * code with `store.referral.attribute`, which is where the API decides (own code, already used, not a new customer,
 * unknown code — its own wording is shown).
 */
export default async function ReferralLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const [{ locale, code: raw }, query, jar] = await Promise.all([params, searchParams, cookies()]);
  setRequestLocale(locale);
  const t = await getTranslations("account.referral.landing");
  const code = decoded(raw).trim().toUpperCase();
  const signedIn = Boolean(readAccessToken(jar));
  const here = `/referral/${encodeURIComponent(code)}`;
  const illustration = <OpenBoxIllustration className="mb-2 max-w-28" />;
  const invite = (
    <>
      {t("body")}
      <span className="border-border bg-surface-subtle text-fg rounded-control mt-4 flex items-center justify-center gap-2 border px-4 py-2.5 font-semibold tracking-wider tabular-nums">
        <Icon name="ticket" size={18} aria-hidden="true" className="text-primary" />
        <span className="sr-only">{t("codeLabel")} </span>
        {code}
      </span>
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-5 py-12 md:py-20">
      {CODE.test(code) ? (
        <EmptyState
          className="py-12"
          titleAs="h1"
          illustration={illustration}
          title={t("title")}
          description={invite}
          action={
            signedIn ? (
              <ReferralClaim code={code} auto={query.claim === "1"} />
            ) : (
              <Button asChild size="lg">
                <Link href={`/sign-in?returnTo=${encodeURIComponent(`${here}?claim=1`)}`}>{t("start")}</Link>
              </Button>
            )
          }
          secondary={
            <Link href="/products" className="text-primary font-medium underline-offset-4 hover:underline">
              {t("browse")}
            </Link>
          }
        />
      ) : (
        <EmptyState
          className="py-12"
          titleAs="h1"
          illustration={illustration}
          title={t("invalidTitle")}
          description={t("invalidBody")}
          action={<NextStep to="products" />}
          secondary={<NextStep to="help" variant="ghost" />}
        />
      )}
    </div>
  );
}
