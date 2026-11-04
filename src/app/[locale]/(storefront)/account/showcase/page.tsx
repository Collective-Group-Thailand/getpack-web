import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getShowcaseConsent } from "@/features/customer/loyalty/api.server";
import { ShowcaseConsentForm } from "@/features/customer/loyalty/ShowcaseConsentForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.showcase");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Consent to show the customer's work (loyalty P2, D-490; checklist task `showcase_consent`). */
export default async function Page() {
  await requireCustomer();
  const [t, consent] = await Promise.all([getTranslations("account.showcase"), getShowcaseConsent()]);
  return (
    <div className="max-w-3xl">
      <AccountHeader className="mb-6" title={t("title")} lede={t("intro")} />
      <ShowcaseConsentForm initial={consent} />
    </div>
  );
}
