import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { SignInPanel } from "@/features/customer/auth/SignInPanel";
import { SiteFooter, SiteHeader } from "@/features/customer/shell";
import { safeReturnTo } from "@/features/shared/auth/return-to";

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
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ locale }, query, t] = await Promise.all([params, searchParams, getTranslations("auth")]);
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold">{t("customer.title")}</h1>
        <p className="text-muted mt-2">{t("customer.subtitle")}</p>
      </main>
      <SignInPanel returnTo={safeReturnTo(query.returnTo)} />
      <SiteFooter />
    </>
  );
}
