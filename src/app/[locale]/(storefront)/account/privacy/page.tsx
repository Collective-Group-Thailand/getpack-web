import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPreferences, getPrivacyRequests } from "@/features/customer/account/api.server";
import { PrivacySettings } from "@/features/customer/account/PrivacySettings";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

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
      <AccountHeader
        className="mb-6"
        title={t("title")}
        lede={t("intro")}
        actions={
          <Button asChild variant="secondary" iconStart="document">
            <Link href="/legal/privacy">{t("notice")}</Link>
          </Button>
        }
      />
      <PrivacySettings consents={consents} requests={requests} />
    </div>
  );
}
