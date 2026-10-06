import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { SignInPanel } from "@/features/customer/auth/SignInPanel";
import { SiteFooter, SiteHeader } from "@/features/customer/shell";
import { signInReturnTo } from "@/features/shared/auth/return-to";
import { routing } from "@/i18n/routing";
import { localePath, publicOrigin } from "@/lib/seo";
import { hasLocale } from "next-intl";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  // Not indexed: it is a step, not a destination, and it always carries someone else's returnTo.
  return { title: t("customer.title"), robots: { index: false, follow: true } };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string; provider?: string }>;
}) {
  const [{ locale }, query, t, origin] = await Promise.all([
    params,
    searchParams,
    getTranslations("auth"),
    publicOrigin(),
  ]);
  setRequestLocale(locale);
  const returnTo = signInReturnTo(query.returnTo);
  // Where LINE's login page sends the customer back to: this page, flagged to finish the flow.
  const lineReturnUrl = `${origin}${localePath("/sign-in", hasLocale(routing.locales, locale) ? locale : routing.defaultLocale)}?provider=line&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold">{t("customer.title")}</h1>
        <p className="text-muted mt-2">{t("customer.subtitle")}</p>
      </main>
      <SignInPanel
        returnTo={returnTo}
        resume={query.provider === "line" ? "line" : undefined}
        lineReturnUrl={lineReturnUrl}
      />
      <SiteFooter />
    </>
  );
}
