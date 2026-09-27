import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { PartnerLoginForm } from "@/features/partner/auth/PartnerLoginForm";
import { safeReturnTo } from "@/features/shared/auth/return-to";
import { getActor } from "@/lib/auth/actor";
import { Card } from "@/ui/components/Card";
import { BRAND_NAME } from "@/ui/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("partner.title") };
}

export default async function PartnerLoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [t, params, actor] = await Promise.all([getTranslations("auth"), searchParams, getActor("partner")]);

  const returnTo = safeReturnTo(params.returnTo);
  if (actor) redirect(returnTo);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6">
        <p className="text-muted text-sm font-medium">{BRAND_NAME}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t("partner.title")}</h1>
        <p className="text-muted mt-1 text-base">{t("partner.subtitle")}</p>
      </div>

      <Card padding="lg" elevation="raised">
        <PartnerLoginForm returnTo={returnTo} />
      </Card>
    </main>
  );
}
