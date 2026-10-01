import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPreferences, getPrivacyRequests } from "@/features/customer/account/api.server";
import { PrivacySettings } from "@/features/customer/account/PrivacySettings";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.privacy");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Consent and data rights (F3 3.4, PDPA). */
export default async function Page() {
  await requireCustomer();
  const [t, { consents }, requests] = await Promise.all([
    getTranslations("account.privacy"),
    getPreferences(),
    getPrivacyRequests(),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted mt-1 mb-6">
        {t("intro")}{" "}
        <Link href="/legal/privacy" className="text-primary underline underline-offset-4">
          {t("notice")}
        </Link>
      </p>
      <PrivacySettings consents={consents} requests={requests} />
    </div>
  );
}
