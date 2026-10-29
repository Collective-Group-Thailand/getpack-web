import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { getApprovals, getMyCompany, getSpend } from "@/features/customer/business/api.server";
import { BusinessDashboard } from "@/features/customer/business/BusinessDashboard";
import { BusinessLanding } from "@/features/customer/business/BusinessLanding";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { readAccessToken } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.landing");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** `/business`: the landing for everyone, the company's overview for its members (F3 3.7). */
export default async function Page({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const signedIn = Boolean(readAccessToken(await cookies()));
  const company = signedIn ? await getMyCompany() : null;
  if (!company) return <BusinessLanding signedIn={signedIn} />;
  const [{ applied }, spend, pending, typeNames] = await Promise.all([
    searchParams,
    // Company Admin and Accountant (D-125).
    company.can.viewFinance ? getSpend(company.id, 12) : Promise.resolve(null),
    getApprovals(company.id),
    getProductTypeNames(await getLocale()),
  ]);
  return (
    <BusinessDashboard
      company={company}
      spend={spend}
      pending={pending?.length ?? 0}
      applied={applied === "1"}
      typeNames={typeNames}
    />
  );
}
