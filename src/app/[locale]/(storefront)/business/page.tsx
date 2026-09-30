import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getApprovals, getMyCompany, getSpend } from "@/features/customer/business/api.server";
import { BusinessDashboard } from "@/features/customer/business/BusinessDashboard";
import { BusinessLanding } from "@/features/customer/business/BusinessLanding";
import { readAccessToken } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.landing");
  return { title: t("metaTitle"), description: t("intro") };
}

/** `/business`: the landing for everyone, the company's overview for its members (F3 3.7). */
export default async function Page({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const signedIn = Boolean(readAccessToken(await cookies()));
  const company = signedIn ? await getMyCompany() : null;
  if (!company) return <BusinessLanding signedIn={signedIn} />;
  const [{ applied }, spend, pending] = await Promise.all([
    searchParams,
    company.can.viewFinance || company.can.order ? getSpend(12) : Promise.resolve(null),
    getApprovals(company.id),
  ]);
  return <BusinessDashboard company={company} spend={spend} pending={pending?.length ?? 0} applied={applied === "1"} />;
}
