import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPreferences } from "@/features/customer/account/api.server";
import { NotificationSettings } from "@/features/customer/account/NotificationSettings";
import { requireCustomer } from "@/features/customer/auth/guard.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.notifications");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Notification preferences and linked accounts (F3 3.4, D-143, D-144, D-151). */
export default async function Page() {
  await requireCustomer();
  const [t, { preferences, consents, me }] = await Promise.all([
    getTranslations("account.notifications"),
    getPreferences(),
  ]);
  return (
    <div>
      <h1 className="text-title leading-tight">{t("title")}</h1>
      <p className="text-muted mt-1 mb-6">{t("intro")}</p>
      <NotificationSettings
        initial={preferences}
        identities={me.identities}
        lineMarketingConsent={consents.some(
          (consent) => consent.purpose === "marketing_line" && consent.granted === true,
        )}
      />
    </div>
  );
}
