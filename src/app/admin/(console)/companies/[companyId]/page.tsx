import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CompanyWorkspace } from "@/features/admin/companies";
import { COMPANY_TABS, type CompanyTab } from "@/features/admin/companies/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("companies.detail"))("title") };
}

type Props = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompanyPage({ params, searchParams }: Props) {
  const [{ companyId }, query] = await Promise.all([params, searchParams]);
  const tab = (COMPANY_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as CompanyTab) : "overview";
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <CompanyWorkspace companyId={companyId} tab={tab} />
    </ConsolePage>
  );
}
