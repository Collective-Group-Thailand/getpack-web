import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPreferences } from "@/features/customer/account/api.server";
import { NotificationSettings } from "@/features/customer/account/NotificationSettings";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
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
      <AccountHeader className="mb-6" title={t("title")} lede={t("intro")} />
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
