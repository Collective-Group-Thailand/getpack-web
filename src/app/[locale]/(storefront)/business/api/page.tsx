import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { ApiClients } from "@/features/customer/business/ApiClients";
import { requireMember } from "@/features/customer/business/guard.server";
import { serverApi } from "@/lib/api/server";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.api");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The company's API clients for its own systems (U2.F5, D-291): the Company Admin's to issue and revoke. */
export default async function Page() {
  const company = await requireMember();
  const t = await getTranslations("business.api");
  const clients = company.can.manageSettings
    ? ((
        await (
          await serverApi("customer")
        ).GET("/v1/store/companies/{companyId}/api-clients", {
          params: { path: { companyId: company.id } },
        })
      ).data ?? [])
    : [];
  return (
    <div className="flex flex-col gap-6">
      <AccountHeader title={t("title")} lede={t("intro")} />
      {company.can.manageSettings ? (
        <ApiClients companyId={company.id} initial={clients} />
      ) : (
        <Callout tone="info" title={t("adminOnly")} />
      )}
    </div>
  );
}
