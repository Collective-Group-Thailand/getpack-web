import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyCompany } from "@/features/customer/business/api.server";
import { CompanySignup } from "@/features/customer/business/CompanySignup";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.apply");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Company sign-up (F3 3.7, D-120): apply → KYC documents → submit for review. */
export default async function Page() {
  const me = await requireCustomer();
  const [t, company] = await Promise.all([getTranslations("business.apply"), getMyCompany()]);
  const body = (
    <div className="flex flex-col gap-6">
      <AccountHeader title={t("title")} lede={t("intro")} />
      {company ? (
        <Callout tone="info" title={t("alreadyTitle", { name: company.legalName })}>
          <Link href="/business" className="underline underline-offset-4">
            {t("already")}
          </Link>
        </Callout>
      ) : (
        <CompanySignup phone={me.phone ?? ""} />
      )}
    </div>
  );
  // A member sees it inside the company frame; a visitor gets the page column here (the layout frames members only).
  return company ? (
    body
  ) : (
    <div className="max-w-nav mx-auto w-full px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">{body}</div>
  );
}
