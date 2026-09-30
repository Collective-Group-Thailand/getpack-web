import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyCompany } from "@/features/customer/business/api.server";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.apply");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Company sign-up (F3 3.7, D-120).
 *
 * CONTRACT-GAP store.geo-ids — `store.companies.apply` files the head office under a province
 * **id**, which no store geo read gives, so the sign-up cannot be sent from here yet; the page says
 * how to reach the team instead. The form returns with the published apply → KYC documents →
 * submit flow once the ids ship.
 */
export default async function Page() {
  await requireCustomer();
  const [t, company] = await Promise.all([getTranslations("business.apply"), getMyCompany()]);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2 max-w-3xl">{t("intro")}</p>
      </header>
      {company ? (
        <Callout tone="info" title={t("alreadyTitle", { name: company.legalName })}>
          <Link href="/business" className="underline underline-offset-4">
            {t("already")}
          </Link>
        </Callout>
      ) : (
        <Callout tone="info" title={t("blockedTitle")}>
          {t("blocked")}
        </Callout>
      )}
    </div>
  );
}
